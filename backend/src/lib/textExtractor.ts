import logger from './logger';

// AdmZip is already a transitive dep (via @tensorflow/tfjs-node)
const AdmZip = require('adm-zip');

/**
 * Extracts plain text from a DOCX buffer by unzipping it and parsing
 * word/document.xml. This is 100% synchronous — no hanging, no ESM issues.
 */
const extractDocxText = (buffer: Buffer): string => {
  try {
    const zip = new AdmZip(buffer);
    const xmlEntry = zip.getEntry('word/document.xml');
    if (!xmlEntry) return '';

    const xml = xmlEntry.getData().toString('utf-8');

    // Insert newlines at paragraph boundaries before stripping tags
    const withNewlines = xml
      .replace(/<\/w:p>/g, '\n')     // paragraph end → newline
      .replace(/<w:br[^>]*\/>/g, '\n') // line break → newline
      .replace(/<\/w:r>/g, ' ');      // run end → space

    // Strip all remaining XML tags
    const text = withNewlines
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, ' ')       // collapse multiple spaces
      .replace(/\n\s*\n+/g, '\n')    // collapse multiple blank lines
      .trim();

    return text;
  } catch (e: any) {
    logger.warn(`[TEXT EXTRACTOR] AdmZip DOCX parse failed: ${e.message}`);
    return '';
  }
};

/**
 * Extracts plain text directly from a PDF buffer using a lightweight regex-based
 * parser. Works for typed/exported PDFs (not scanned images).
 */
const extractPdfText = (buffer: Buffer): string => {
  try {
    const content = buffer.toString('latin1');
    const lines: string[] = [];

    // Strategy 1: Extract text from BT...ET blocks
    const btEtMatches = [...content.matchAll(/BT([\s\S]*?)ET/g)];

    for (const match of btEtMatches) {
      const block = match[1];

      // Tj operator: (text) Tj
      const tjMatches = [...block.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g)];
      for (const tj of tjMatches) {
        const decoded = tj[1]
          .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
        if (decoded.trim()) lines.push(decoded);
      }

      // TJ array operator: [(text) spacing (text)] TJ
      const tjArrayMatches = [...block.matchAll(/\[((?:[^\[\]]|\\.)*)\]\s*TJ/g)];
      for (const tjArr of tjArrayMatches) {
        const parts = [...tjArr[1].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)];
        const text = parts.map(p => p[1]).join('');
        if (text.trim()) lines.push(text);
      }
    }

    let result = lines.join(' ').trim();

    // Strategy 2: Fallback ASCII runs from stream content
    if (result.length < 20) {
      const streamMatches = [...content.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
      for (const sm of streamMatches) {
        const textRuns = sm[1].match(/[ -~]{4,}/g) || [];
        for (const run of textRuns) {
          if (!run.startsWith('%') && !/^\d+(\s+\d+)*$/.test(run)) lines.push(run);
        }
      }
      result = lines.join(' ').trim();
    }

    return result;
  } catch (e: any) {
    return '';
  }
};

/**
 * Extracts plain text from any student submission buffer.
 * Supports: PDF (typed), DOCX, DOC (via zip), TXT — all synchronous.
 */
export const extractTextFromBuffer = async (
  buffer: Buffer,
  mimeType: string,
  originalName: string = ''
): Promise<string> => {
  const name = originalName.toLowerCase();

  // ─── PDF ─────────────────────────────────────────────────────────
  const isPDF = mimeType === 'application/pdf' || name.endsWith('.pdf');
  if (isPDF) {
    logger.info(`[TEXT EXTRACTOR] Parsing PDF: ${originalName}`);
    const text = extractPdfText(buffer);
    if (text && text.length > 20) {
      logger.info(`[TEXT EXTRACTOR] PDF OK: ${text.length} chars`);
      return text;
    }
    logger.warn('[TEXT EXTRACTOR] PDF has no text layer (scanned image PDF).');
    return '[PDF_SCANNED: This PDF is a scanned image. No text could be extracted. Please ask the student to submit a typed PDF or DOCX.]';
  }

  // ─── DOCX ────────────────────────────────────────────────────────
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx');
  if (isDocx) {
    logger.info(`[TEXT EXTRACTOR] Parsing DOCX: ${originalName}`);
    const text = extractDocxText(buffer);
    if (text && text.length > 10) {
      logger.info(`[TEXT EXTRACTOR] DOCX OK: ${text.length} chars`);
      return text;
    }
    return '[DOCX_EMPTY: The Word document appears to be blank or could not be parsed.]';
  }

  // ─── DOC (legacy) ────────────────────────────────────────────────
  const isDoc = mimeType === 'application/msword' || name.endsWith('.doc');
  if (isDoc) {
    // Older .doc files are not zip-based — try AdmZip anyway, may work for some
    logger.info(`[TEXT EXTRACTOR] Attempting legacy DOC: ${originalName}`);
    const text = extractDocxText(buffer);
    if (text && text.length > 10) return text;
    return '[DOC_UNSUPPORTED: Legacy .doc format could not be read. Please ask student to save as .docx or PDF.]';
  }

  // ─── Plain Text ──────────────────────────────────────────────────
  const isText =
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    name.endsWith('.txt') ||
    name.endsWith('.md');
  if (isText) {
    return buffer.toString('utf-8').trim();
  }

  // ─── Images ──────────────────────────────────────────────────────
  if (mimeType.startsWith('image/')) {
    logger.warn(`[TEXT EXTRACTOR] Image submitted: ${originalName}`);
    return '[IMAGE_SUBMITTED: Student submitted an image. Cannot extract text. Please grade manually or ask student to resubmit as PDF/DOCX.]';
  }

  // ─── Unknown ─────────────────────────────────────────────────────
  logger.warn(`[TEXT EXTRACTOR] Unsupported type: ${mimeType}`);
  return `[UNKNOWN_FORMAT: "${mimeType}" is not supported for text extraction.]`;
};
