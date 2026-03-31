import { Router, Response } from 'express';
import multer from 'multer';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  LineRuleType,
} from 'docx';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ApiResponse } from '../types';
import logger from '../lib/logger';
import {
  generateAcademicDocument,
  DocumentSection,
  GenerateDocumentParams,
} from '../lib/gemini';

const router = Router();

// Multer — accept PDFs, images, DOCX, PPT for context upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  },
});

// ============================================================
//  FORMATTING SPEC
//  Heading1: 14pt Bold, spacing after = 240 (2 lines)
//  Heading2: 12pt Bold, spacing after = 180 (1.5 lines)
//  Body:     12pt Regular, spacing after = 120 (1 line / 1pt gap)
//  Font:     Times New Roman, A4 margins 1"
// ============================================================

const PT = (n: number) => n * 2; // half-points (docx unit)

function buildDocx(sections: DocumentSection[], title: string): Document {
  const children: (Paragraph | Table)[] = [];

  for (const section of sections) {
    switch (section.type) {
      case 'heading1':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                bold: true,
                size: PT(14),
                font: 'Times New Roman',
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 360, line: 480, lineRule: LineRuleType.AUTO },
          })
        );
        break;

      case 'heading2':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                bold: true,
                size: PT(12),
                font: 'Times New Roman',
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 270, line: 360, lineRule: LineRuleType.AUTO },
          })
        );
        break;

      case 'paragraph':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                size: PT(12),
                font: 'Times New Roman',
              }),
            ],
            spacing: { after: 120, line: 240, lineRule: LineRuleType.AUTO },
          })
        );
        break;

      case 'list':
        if (section.items?.length) {
          for (const item of section.items) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: item,
                    size: PT(12),
                    font: 'Times New Roman',
                  }),
                ],
                spacing: { after: 80, line: 240, lineRule: LineRuleType.AUTO },
              })
            );
          }
          // Add breathing room after list
          children.push(new Paragraph({ spacing: { after: 120 } }));
        }
        break;

      case 'table':
        if (section.rows && section.rows.length >= 1) {
          const [headerRow, ...dataRows] = section.rows;
          const colCount = headerRow.length;
          const colWidth = Math.floor(9360 / colCount); // spread across ~6.5" text width

          const tableRows: TableRow[] = [];

          // Header row
          tableRows.push(
            new TableRow({
              tableHeader: true,
              children: headerRow.map(
                (cell) =>
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: '1a1a2e' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cell,
                            bold: true,
                            color: 'FFFFFF',
                            size: PT(11),
                            font: 'Times New Roman',
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: colWidth, type: WidthType.DXA },
                  })
              ),
            })
          );

          // Data rows
          dataRows.forEach((row, ri) =>
            tableRows.push(
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      shading: {
                        type: ShadingType.SOLID,
                        color: ri % 2 === 0 ? 'F8F8F8' : 'FFFFFF',
                      },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: cell,
                              size: PT(11),
                              font: 'Times New Roman',
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      width: { size: colWidth, type: WidthType.DXA },
                    })
                ),
              })
            )
          );

          children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
          children.push(new Paragraph({ spacing: { after: 240 } }));
        }
        break;
    }
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: PT(12) },
        },
      },
    },
  });
}

function buildPdfHtml(sections: DocumentSection[], title: string): string {
  const rows = sections.map((section) => {
    switch (section.type) {
      case 'heading1':
        return `<h1>${escHtml(section.content)}</h1>`;

      case 'heading2':
        return `<h2>${escHtml(section.content)}</h2>`;

      case 'paragraph':
        return `<p>${escHtml(section.content)}</p>`;

      case 'list':
        return `<ul>${(section.items || []).map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`;

      case 'table': {
        if (!section.rows?.length) return '';
        const [header, ...data] = section.rows;
        return `<table>
          <thead><tr>${header.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${data.map((row) => `<tr>${row.map((c) => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
      }

      default:
        return '';
    }
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escHtml(title)}</title>
<style>
  @page { size: A4; margin: 25mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1; color: #000; }
  h1 {
    font-size: 14pt; font-weight: bold; text-align: center;
    margin-bottom: 16pt; margin-top: 20pt; line-height: 2;
    border-bottom: 2px solid #000; padding-bottom: 6pt;
  }
  h2 {
    font-size: 12pt; font-weight: bold;
    margin-top: 14pt; margin-bottom: 12pt; line-height: 1.5;
  }
  p { font-size: 12pt; margin-bottom: 6pt; line-height: 1; }
  ul { padding-left: 20pt; margin-bottom: 8pt; }
  ul li { font-size: 12pt; margin-bottom: 4pt; line-height: 1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16pt; font-size: 11pt; }
  thead tr { background: #1a1a2e; color: #fff; }
  thead th { padding: 6pt 8pt; text-align: center; font-weight: bold; border: 1pt solid #000; }
  tbody tr:nth-child(even) { background: #f8f8f8; }
  tbody td { padding: 5pt 8pt; text-align: center; border: 1pt solid #ccc; }
</style>
</head>
<body>
${rows.join('\n')}
</body>
</html>`;
}

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ===========================================================
   POST /api/documents/generate
   Accepts: multipart form with fields + optional file uploads
   Returns: { sections: DocumentSection[], title: string }
   =========================================================== */
router.post(
  '/generate',
  authenticate,
  upload.array('files', 10),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        documentType,
        subject,
        subjectCode,
        topic,
        department,
        year,
        semester,
        courseOutcomes,
        programOutcomes,
        customPrompt,
        institution,
      } = req.body;

      if (!documentType) {
        res.status(400).json({ success: false, error: 'documentType is required' });
        return;
      }

      const files = req.files as Express.Multer.File[] | undefined;
      const uploadedFiles = files?.map((f) => ({
        buffer: f.buffer,
        mimeType: f.mimetype,
        originalName: f.originalname,
      }));

      const user = req.user!;

      const params: GenerateDocumentParams = {
        documentType,
        subject,
        subjectCode,
        topic,
        department,
        year,
        semester,
        courseOutcomes,
        programOutcomes,
        customPrompt,
        facultyName: user.name,
        institution: institution || 'Manav Rachna University, Faridabad',
        uploadedFiles,
      };

      const sections = await generateAcademicDocument(params);
      const titleSection = sections.find((s) => s.type === 'heading1');
      const title = titleSection?.content || subject || 'Academic Document';

      const response: ApiResponse = {
        success: true,
        data: { sections, title },
        message: `Document generated: ${sections.length} sections`,
      };
      res.status(200).json(response);
    } catch (error) {
      logger.error('Document generation route error:', error);
      const msg = error instanceof Error ? error.message : 'Document generation failed';
      res.status(500).json({ success: false, error: msg });
    }
  }
);

/* ===========================================================
   POST /api/documents/download/docx
   Accepts: { sections, title }
   Returns: .docx file stream
   =========================================================== */
router.post(
  '/download/docx',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { sections, title } = req.body as { sections: DocumentSection[]; title: string };

      if (!sections?.length) {
        res.status(400).json({ success: false, error: 'No sections provided' });
        return;
      }

      const doc = buildDocx(sections, title || 'document');
      const buffer = await Packer.toBuffer(doc);

      const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(buffer);
    } catch (error) {
      logger.error('DOCX generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate DOCX file' });
    }
  }
);

/* ===========================================================
   POST /api/documents/download/pdf
   Accepts: { sections, title }
   Returns: .pdf file stream
   =========================================================== */
router.post(
  '/download/pdf',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { sections, title } = req.body as { sections: DocumentSection[]; title: string };

      if (!sections?.length) {
        res.status(400).json({ success: false, error: 'No sections provided' });
        return;
      }

      const html = buildPdfHtml(sections, title || 'document');

      // Dynamic import to avoid startup overhead
      const htmlPdf = await import('html-pdf-node');
      const file = { content: html };
      const options = {
        format: 'A4',
        margin: { top: '25mm', right: '25mm', bottom: '25mm', left: '25mm' },
        printBackground: true,
      };

      const pdfBuffer = await htmlPdf.generatePdf(file, options);

      const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('PDF generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate PDF file' });
    }
  }
);

export default router;
