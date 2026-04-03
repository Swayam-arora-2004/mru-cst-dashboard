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

/**
 * LIGHTWEIGHT PDF GENERATION (No Puppeteer/Chromium)
 * Uses pdfkit — pure JS, memory-efficient, fast. 
 */
async function buildPdfBuffer(sections: DocumentSection[], title: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 72, // 1 inch
      bufferPages: true 
    });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title / Heading 1
    doc.font('Times-Bold').fontSize(14).text(title.toUpperCase(), { align: 'center', underline: true });
    doc.moveDown(1.5);

    for (const section of sections) {
      switch (section.type) {
        case 'heading1':
          if (section.content.toUpperCase() !== title.toUpperCase()) {
            doc.font('Times-Bold').fontSize(14).text(section.content, { align: 'center' });
            doc.moveDown(1);
          }
          break;

        case 'heading2':
          doc.font('Times-Bold').fontSize(12).text(section.content);
          doc.moveDown(0.5);
          break;

        case 'paragraph':
          doc.font('Times-Roman').fontSize(12).text(section.content, { align: 'justify', lineGap: 2 });
          doc.moveDown(0.8);
          break;

        case 'list':
          if (section.items?.length) {
            section.items.forEach(item => {
              doc.font('Times-Roman').fontSize(12).text(`  •  ${item}`, { indent: 10 });
            });
            doc.moveDown(0.8);
          }
          break;

        case 'table':
          if (section.rows?.length) {
            const startX = doc.x;
            const startY = doc.y;
            const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / section.rows[0].length;
            const rowHeight = 25;

            section.rows.forEach((row, ri) => {
              // Add page if needed
              if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
              }

              const y = doc.y;
              row.forEach((cell, ci) => {
                const x = startX + (ci * colWidth);
                
                // Cell Border
                doc.rect(x, y, colWidth, rowHeight).stroke();
                
                // Cell Fill for Header
                if (ri === 0) {
                  doc.save().fillColor('#1a1a2e').rect(x + 0.5, y + 0.5, colWidth - 1, rowHeight - 1).fill().restore();
                  doc.fillColor('white').font('Times-Bold').fontSize(10);
                } else {
                  doc.fillColor('black').font('Times-Roman').fontSize(10);
                }

                doc.text(String(cell), x + 5, y + 7, { width: colWidth - 10, align: 'center' });
              });
              doc.y = y + rowHeight;
            });
            doc.moveDown(1);
          }
          break;
      }
    }

    doc.end();
  });
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

      // 🚀 Performance: Using lightweight PDFKit (No Chromium/Puppeteer)
      const pdfBuffer = await buildPdfBuffer(sections, title || 'document');

      const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('PDF generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate PDF file. Deployment limit reached?' });
    }
  }
);

export default router;
