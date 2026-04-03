import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config';
import logger from './logger';
import { CourseCodeParams } from '../types';

let genAI: GoogleGenerativeAI | null = null;

export const getGenAI = (): GoogleGenerativeAI => {
  if (!genAI) {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined.');
    }
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
};

// 🔒 Mutex to ensure sequential AI requests (Free tier 15 RPM limit)
class Mutex {
  private queue: Promise<void> = Promise.resolve();
  async acquire() {
    let release: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const current = this.queue;
    this.queue = next;
    await current;
    return () => release!();
  }
}
export const aiLock = new Mutex();
let globalQuotaResetTime = 0;
let lastRequestTime = 0; // Tracking for 15 RPM Pacing
let throttleActiveUntil = 0; // If hit 429, slow down to 10s for 15 mins
const cooldownModels = new Map<string, number>(); // modelName -> timestamp to resume

/**
 * Extracts duration in milliseconds from standard RPC duration strings (e.g., '52s', '3600s')
 */
const parseDurationMs = (durationKey?: string): number => {
  if (!durationKey) return 0;
  const match = durationKey.match(/^(\d+)s$/);
  return match ? parseInt(match[1], 10) * 1000 : 0;
};

const FALLBACK_MODELS = [
  'models/gemini-1.5-flash',       // Most reliable for file inputs
  'models/gemini-1.5-pro',         // High quality, supports files
  'models/gemini-2.0-flash',       // Fast and capable
  'models/gemini-2.0-flash-lite',  // Lightweight fallback
  'models/gemini-1.5-flash-8b',    // Smallest, still supports files
  'models/gemini-pro-latest',      // Latest stable
  'models/gemini-flash-latest',    // Latest flash alias
  'models/gemini-2.5-flash-lite',  // New lite variant
];

const isModelNotFoundError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('404') &&
    (message.includes('model') || message.includes('models/')) &&
    (message.includes('not found') || message.includes('not supported'))
  );
};

export interface CourseCodeSuggestion {
  code: string;
  explanation: string;
  isUnique: boolean;
}

export interface EvaluationParams {
  activityTitle: string;
  activityType: 'assignment' | 'document';
  courseName?: string;
  studentName: string;
  fileData: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  };
  questionFileData?: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  };
  maxMarks?: number;
}

export interface EvaluationResult {
  grade: string;
  score: number;
  feedback?: string;
  source?: 'ai' | 'system';
}

export const generateCourseCodeSuggestions = async (
  params: CourseCodeParams,
  existingCodes: string[]
): Promise<CourseCodeSuggestion[]> => {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const typePrefix = {
      lecture: '',
      tutorial: 'T',
      lab: 'L',
      mooc: 'MOOC',
      elective: 'E',
    };

    const prompt = `You are a university course code generator. Generate 5 unique course codes based on these parameters:
    
    Department: ${params.department}
    Type: ${params.type} (${typePrefix[params.type] ? `suffix: -${typePrefix[params.type]}` : 'no suffix'})
    Semester: ${params.semester}
    Year: ${params.year || 'Not specified'}
    Specialization: ${params.specialization || 'Not specified'}
    
    Existing codes to avoid: ${existingCodes.join(', ')}
    
    Course code format examples from university:
    - CSH422B-T (Tutorial)
    - ECH432B-T (Tutorial)
    - MEH403B-T (Tutorial)
    - ECS306B (Lecture)
    - CSS325B (Lecture)
    - MOOC-24O-CSH-307 (MOOC course)
    - EDH422 (Elective)
    
    Rules:
    1. Department code should be 2-3 letters
    2. Course number should be 3 digits
    3. Add appropriate suffix based on type
    4. For MOOC, use format: MOOC-YYO-DEPT-NUM
    5. Avoid all existing codes listed above
    
    Return ONLY a JSON array with exactly 5 objects, each containing:
    - "code": the generated course code
    - "explanation": brief explanation of the code structure
    
    Example response:
    [{"code": "CSH425B", "explanation": "CSH: Computer Science, 425: Course number, B: Batch indicator"}, ...]`;

    const release = await aiLock.acquire();
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const suggestions: { code: string; explanation: string }[] = JSON.parse(jsonMatch[0]);
      
      return suggestions.map((s) => ({
        ...s,
        isUnique: !existingCodes.includes(s.code),
      }));
    } finally {
      release();
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    // Fallback to basic code generation
    return generateFallbackCodes(params, existingCodes);
  }
};

const generateFallbackCodes = (
  params: CourseCodeParams,
  existingCodes: string[]
): CourseCodeSuggestion[] => {
  const deptCode = params.department.substring(0, 3).toUpperCase();
  const typeMap: Record<string, string> = {
    lecture: '',
    tutorial: '-T',
    lab: '-L',
    mooc: '',
    elective: '',
  };

  const suggestions: CourseCodeSuggestion[] = [];
  let baseNum = params.semester * 100 + 1;

  for (let i = 0; i < 5; i++) {
    let code: string;
    
    if (params.type === 'mooc') {
      const year = new Date().getFullYear().toString().slice(-2);
      code = `MOOC-${year}O-${deptCode}-${baseNum + i}`;
    } else {
      code = `${deptCode}${baseNum + i}B${typeMap[params.type]}`;
    }

    const isUnique = !existingCodes.includes(code);
    
    suggestions.push({
      code,
      explanation: `Auto-generated code for ${params.type} in ${params.department}`,
      isUnique,
    });
  }

  return suggestions;
};

export const validateCourseCode = async (
  code: string,
  existingCodes: string[]
): Promise<{ isValid: boolean; isDuplicate: boolean; suggestions: string[] }> => {
  const isDuplicate = existingCodes.includes(code);
  
  // Basic validation rules
  const isValid = /^[A-Z]{2,4}[0-9]{3}[A-Z]?(-[A-Z])?$|^MOOC-[0-9]{2}O-[A-Z]{2,4}-[0-9]{3}$/.test(code);

  let suggestions: string[] = [];
  
  if (isDuplicate || !isValid) {
    try {
      const ai = getGenAI();
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `The course code "${code}" is ${isDuplicate ? 'already in use' : 'invalid'}. 
      Suggest 3 alternative valid course codes similar to this one.
      Existing codes to avoid: ${existingCodes.slice(0, 20).join(', ')}
      Return only a JSON array of 3 strings with the suggested codes.`;

      const release = await aiLock.acquire();
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } finally {
        release();
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  }

  return { isValid, isDuplicate, suggestions };
};
// ============================================================
//  ACADEMIC DOCUMENT GENERATOR
// ============================================================

export type DocumentType =
  | 'lesson_plan'
  | 'co_po_mapping'
  | 'lab_file'
  | 'nba_report'
  | 'naac_report'
  | 'course_file'
  | 'custom';

export interface DocumentSection {
  type: 'heading1' | 'heading2' | 'paragraph' | 'table' | 'list';
  content: string;
  items?: string[];          // for list type
  rows?: string[][];         // for table type (first row = headers)
}

export interface GenerateDocumentParams {
  documentType: DocumentType;
  subject?: string;
  subjectCode?: string;
  topic?: string;
  department?: string;
  year?: string;
  semester?: string;
  courseOutcomes?: string;   // CO1: ..., CO2: ...
  programOutcomes?: string;  // PO1: ..., PO2: ...
  facultyName?: string;
  institution?: string;
  customPrompt?: string;
  uploadedFiles?: UploadedFileContext[];
}

export interface UploadedFileContext {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

const DOCTYPE_PROMPTS: Record<DocumentType, string> = {
  lesson_plan: `Generate a comprehensive weekly LESSON PLAN for the given subject.
Include: Objectives, Topics per week, Teaching methodology, CO mapping per session, Assessment methods.
Format as: Heading1 for the document title, Heading2 for each week, body text for details.
Use a table for CO mapping (columns: Week | Topics | CO | Methodology | Assessment).`,

  co_po_mapping: `Generate a detailed CO-PO MAPPING document.
Include: Course Outcome definitions, Program Outcome definitions, and a correlation matrix table.
The matrix should have COs as rows and POs as columns with values H (High), M (Medium), L (Low), or - (None).
Also include CO-PSO mapping and justification paragraphs.`,

  lab_file: `Generate a complete LAB FILE / EXPERIMENT RECORD for each experiment in the syllabus.
For each experiment include: Aim, Apparatus/Requirements, Theory/Background, Algorithm/Procedure, Program/Circuit, Expected Output, Result, Conclusion, Precautions, Viva Questions.
Format with Heading1 for experiment titles, Heading2 for each section.`,

  nba_report: `Generate a comprehensive NBA (National Board of Accreditation) COURSE FILE covering:
1. Course Information Sheet
2. Course Outcomes (COs) with Bloom's Taxonomy levels
3. CO-PO-PSO Mapping with justification
4. Teaching Plan (unit-wise with hours)
5. Assignment questions mapped to COs
6. Mid-term and End-term question paper analysis
7. CO Attainment calculation methodology
8. Direct and Indirect Attainment table
Use formal academic language and proper headings.`,

  naac_report: `Generate a comprehensive NAAC (National Assessment and Accreditation Council) documentation set covering:
1. Course Design and Delivery (Criterion 1)
2. Teaching-Learning and Evaluation metrics
3. Student Performance data section
4. Innovation in pedagogy
5. Feedback mechanism documentation
6. Best practices adopted
Format with proper NAAC criterion numbering.`,

  course_file: `Generate a complete COURSE DOCUMENTATION FILE including:
1. Course Information (code, name, credits, type, semester)
2. Course Syllabus (unit-wise breakdown)
3. Reference Books
4. Teaching Schedule
5. Assignment questions
6. Previous year question papers analysis
7. CO Statements
8. Lecture notes outline
Use formal formatting with clear section headings.`,

  custom: `Generate the academic document as described in the user's prompt below. 
Use proper academic formatting with clear headings, subheadings, and structured content.
Ensure all technical content is accurate and comprehensive.`,
};

// Models tried in order 
export async function generateAcademicDocument(
  params: GenerateDocumentParams
): Promise<DocumentSection[]> {
  const ai = getGenAI();

  const typeInstruction = DOCTYPE_PROMPTS[params.documentType];

  const contextInfo = [
    params.subject && `Subject: ${params.subject}`,
    params.subjectCode && `Subject Code: ${params.subjectCode}`,
    params.topic && `Topic/Focus: ${params.topic}`,
    params.department && `Department: ${params.department}`,
    params.year && `Year: ${params.year}`,
    params.semester && `Semester: ${params.semester}`,
    params.courseOutcomes && `Course Outcomes:\n${params.courseOutcomes}`,
    params.programOutcomes && `Program Outcomes:\n${params.programOutcomes}`,
    params.facultyName && `Faculty Name: ${params.facultyName}`,
    params.institution && `Institution: ${params.institution || 'Manav Rachna University'}`,
    params.customPrompt && `Additional Instructions: ${params.customPrompt}`,
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are an expert academic document writer for Indian engineering universities (NBA/NAAC accredited).
You write in formal, precise academic language following UGC and AICTE guidelines.

${typeInstruction}

Document Context:
${contextInfo}

${
  params.uploadedFiles?.length
    ? `The faculty has uploaded ${params.uploadedFiles.length} course material file(s) as context. Use this content to make the document more specific and accurate.`
    : ''
}

CRITICAL FORMATTING RULES — return a valid JSON array of sections:
Each section object must have:
- "type": one of "heading1", "heading2", "paragraph", "table", "list"
- "content": main text content (for heading1, heading2, paragraph)
- "items": string array (only for type "list")
- "rows": array of string arrays, first row = column headers (only for type "table")

Rules:
1. Start with a heading1 for the document title
2. Use heading2 for major sections
3. Use heading1 sparingly (only for document title and major parts)
4. Tables must have at least 2 rows (header + data)
5. Generate comprehensive, complete content — do NOT use placeholders like "[Insert data here]"
6. Return ONLY the raw JSON array, no markdown code fences, no extra text

Example:
[
  {"type": "heading1", "content": "Lesson Plan — Data Structures"},
  {"type": "heading2", "content": "1. Course Information"},
  {"type": "paragraph", "content": "Subject: Data Structures and Algorithms..."},
  {"type": "table", "content": "CO-PO Mapping", "rows": [["CO","PO1","PO2"],["CO1","H","M"]]},
  {"type": "list", "content": "References", "items": ["Cormen et al., Introduction to Algorithms"]}
]`;

  try {
    // Build content parts — text + any uploaded files
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [{ text: systemPrompt }];

    if (params.uploadedFiles?.length) {
      for (const file of params.uploadedFiles) {
        // Only attach image types inline — text/PDF handled via prompt
        if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
          parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.buffer.toString('base64'),
            },
          });
          logger.info(`Attached file as context: ${file.originalName} (${file.mimeType})`);
        }
      }
    }

    let lastError: Error | null = null;

    const release = await aiLock.acquire();
    try {
      for (const modelName of FALLBACK_MODELS) {
        try {
          logger.info(`Trying model: ${modelName}`);
          const model = ai.getGenerativeModel({ model: modelName });
          const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
          const text = result.response.text().trim();

          // Strip markdown fences if Gemini wraps with ```json ... ```
          const clean = text
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          const rawSections: DocumentSection[] = JSON.parse(clean);

          if (!Array.isArray(rawSections) || rawSections.length === 0) {
            throw new Error('Empty or invalid response from AI model');
          }

          // ─── Sanitization ───────────────────────────────────────────────────
          const sections: DocumentSection[] = rawSections.map((s) => ({
            type: s.type || 'paragraph',
            content: typeof s.content === 'object' ? JSON.stringify(s.content) : String(s.content || ''),
            items: Array.isArray(s.items)
              ? s.items.map((it) => (typeof it === 'object' ? JSON.stringify(it) : String(it)))
              : undefined,
            rows: Array.isArray(s.rows)
              ? s.rows.map((row) =>
                  Array.isArray(row)
                    ? row.map((cell) => (typeof cell === 'object' ? JSON.stringify(cell) : String(cell)))
                    : []
                )
              : undefined,
          })) as DocumentSection[];

          logger.info(`✅ Document generated and sanitized with ${modelName}: ${sections.length} sections`);
          return sections;
        } catch (err: any) {
          const isRateLimit = err?.status === 429 || err?.statusText === 'Too Many Requests';
          const retryDelay = err?.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
          const modelNotFound = isModelNotFoundError(err);

          if (isRateLimit) {
            logger.warn(`Rate limit on ${modelName} (retry delay: ${retryDelay || 'unknown'}). Trying next model...`);
            lastError = new Error(
              `API rate limit reached on ${modelName}. Please wait a moment and try again.`
            );
            // Wait briefly before trying next model
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          if (modelNotFound) {
            logger.warn(`Model unavailable: ${modelName}. Trying next model...`);
            lastError = err instanceof Error ? err : new Error(String(err));
            continue;
          }

          // Non-rate-limit error — log and re-throw
          logger.error(`Error with model ${modelName}:`, err);
          lastError = err instanceof Error ? err : new Error(String(err));
          break;
        }
      }
    } finally {
      release();
    }

    // All models failed
    if (lastError?.message?.includes('rate limit')) {
      throw new Error(
        'All Gemini models are currently rate-limited. Please wait 1-2 minutes and try again. ' +
        'This is a free-tier API quota limit.'
      );
    }

    throw lastError || new Error('All AI models failed to generate the document.');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Document generation failed:', msg);
    // Rethrow with the real message so the route can send it to the client
    throw error instanceof Error ? error : new Error(msg);
  }
};

// Models that support responseSchema (structured outputs)
const SCHEMA_CAPABLE_MODELS = new Set([
  'models/gemini-1.5-flash',
  'models/gemini-1.5-flash-8b',
  'models/gemini-1.5-pro',
  'models/gemini-2.0-flash',
  'models/gemini-2.0-flash-lite',
  'models/gemini-pro-latest',
  'models/gemini-flash-latest',
  'models/gemini-flash-lite-latest',
  'models/gemini-2.5-flash-lite',
]);

/**
 * Evaluates a student submission using AI.
 * Uses responseSchema for 100% accurate, parsable JSON output.
 */
export const evaluateSubmission = async (
  params: EvaluationParams
): Promise<EvaluationResult> => {
  const ai = getGenAI();
  const { activityTitle, activityType, courseName, studentName, fileData } = params;
  const maxMarks = params.maxMarks || 100;

  const systemPrompt = `You are a strict University Professor grading a student's ${activityType}.
Student Name: ${studentName}
Activity Topic: ${activityTitle}
Course: ${courseName || 'General'}
Max Marks: ${maxMarks}

${params.questionFileData
  ? 'The FIRST file is the original QUESTION/PROMPT. The SECOND file is the STUDENT SUBMISSION. Grade the student submission against the question.'
  : 'Grade the student submission based on the topic provided.'
}

GRADING RULES:
- Score must be a NUMBER between 0 and ${maxMarks}.
- Grade must be ONE of: A, B, C, D, F
  - A: ${Math.round(maxMarks * 0.9)}-${maxMarks} marks (Excellent)
  - B: ${Math.round(maxMarks * 0.75)}-${Math.round(maxMarks * 0.89)} marks (Good)
  - C: ${Math.round(maxMarks * 0.6)}-${Math.round(maxMarks * 0.74)} marks (Average)
  - D: ${Math.round(maxMarks * 0.45)}-${Math.round(maxMarks * 0.59)} marks (Below Average)
  - F: 0-${Math.round(maxMarks * 0.44)} marks (Fail)
- If the file is BLANK, EMPTY, or UNREADABLE: score=0, grade=F
- If IRRELEVANT to topic: score very low or 0
- Be fair but strict. Justify the score briefly.

Return JSON with keys: grade (string), score (number), reason (string).`;

  const release = await aiLock.acquire();
  try {
    // 🚦 RATE PACING
    const now = Date.now();
    const isThrottled = throttleActiveUntil > now;
    const requiredGap = isThrottled ? 20000 : 6000;
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < requiredGap) {
      const paceDelay = requiredGap - timeSinceLast;
      logger.info(`🕙 Pacing: Waiting ${Math.round(paceDelay / 1000)}s before next AI call...`);
      await new Promise(resolve => setTimeout(resolve, paceDelay));
    }
    lastRequestTime = Date.now();

    // 🛡️ Respect Global Freeze
    if (globalQuotaResetTime > Date.now()) {
      const waitTime = globalQuotaResetTime - Date.now() + 500;
      logger.warn(`⏸️ Global Freeze active. Waiting ${Math.round(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Build content parts
    const parts: any[] = [{ text: systemPrompt }];
    if (params.questionFileData) {
      parts.push({ inlineData: { mimeType: params.questionFileData.mimeType, data: params.questionFileData.buffer.toString('base64') } });
      logger.info('Attached Question Context to Gemini prompt');
    }
    parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.buffer.toString('base64') } });

    for (const modelName of FALLBACK_MODELS) {
      // ⚡ CIRCUIT BREAKER: Skip cooldown models
      if (cooldownModels.has(modelName)) {
        const resumeAt = cooldownModels.get(modelName)!;
        if (resumeAt > Date.now()) {
          logger.info(`⚡ Circuit Breaker: Skipping ${modelName} (${Math.round((resumeAt - Date.now()) / 1000)}s cooldown remaining)`);
          continue;
        }
        cooldownModels.delete(modelName);
      }

      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          logger.info(`Evaluating with model: ${modelName} (Attempt ${retryCount + 1}/${maxRetries + 1})`);

          // Only inject responseSchema for capable models
          const generationConfig: any = SCHEMA_CAPABLE_MODELS.has(modelName)
            ? {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: SchemaType.OBJECT,
                  properties: {
                    grade: { type: SchemaType.STRING },
                    score: { type: SchemaType.NUMBER },
                    reason: { type: SchemaType.STRING },
                  },
                  required: ['grade', 'score', 'reason'],
                },
              }
            : { responseMimeType: 'application/json' };

          const model = ai.getGenerativeModel({ model: modelName, generationConfig });
          const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
          const rawText = result.response.text().trim();

          // Clean markdown fences if present
          const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

          let evaluation: any;
          try {
            evaluation = JSON.parse(clean);
          } catch {
            logger.warn(`JSON parse failed for ${modelName}. Response was: ${rawText.slice(0, 200)}`);
            break; // Try next model
          }

          // ✅ Validate and clamp output
          const validGrades = ['A', 'B', 'C', 'D', 'F'];
          const rawGrade = String(evaluation.grade || '').toUpperCase().trim();
          const grade = validGrades.includes(rawGrade) ? rawGrade : 'F';
          const rawScore = Number(evaluation.score);
          const score = isNaN(rawScore) ? 0 : Math.min(Math.max(Math.round(rawScore), 0), maxMarks);
          const feedback = String(evaluation.reason || evaluation.feedback || `Grade: ${grade}`);

          logger.info(`✅ ${modelName} graded: ${grade} (${score}/${maxMarks})`);
          return { grade, score, feedback, source: 'ai' };

        } catch (err: any) {
          const errMsg = (err.message || '').toLowerCase();
          const errStatus = err.status || err.httpStatus || (err.errorDetails?.[0]?.reason);
          const isRateLimit =
            errStatus === 429 ||
            errMsg.includes('429') ||
            errMsg.includes('too many requests') ||
            errMsg.includes('quota') ||
            errMsg.includes('rate limit') ||
            errMsg.includes('resource_exhausted');

          if (isRateLimit) {
            const rpcDetails: any[] = err.errorDetails || err.details || [];
            const retryInfo = rpcDetails.find((d: any) => d['@type']?.includes('RetryInfo'));
            const requestedDelay = parseDurationMs(retryInfo?.retryDelay);
            const freezeDuration = Math.max(requestedDelay > 0 ? requestedDelay + 5000 : 45000, 60000);

            globalQuotaResetTime = Date.now() + freezeDuration;
            throttleActiveUntil = Date.now() + 15 * 60 * 1000;
            cooldownModels.set(modelName, Date.now() + (requestedDelay > 30000 ? 600000 : 180000));

            logger.warn(`🧊 QUOTA HIT on ${modelName}. Global Freeze for ${Math.round(freezeDuration / 1000)}s. Moving to next model after freeze.`);
            await new Promise(resolve => setTimeout(resolve, freezeDuration));
            break; // Move to next model after freeze
          }

          if (isModelNotFoundError(err)) {
            logger.warn(`Model unavailable: ${modelName}. Switching model...`);
            break;
          }

          if (retryCount < maxRetries) {
            retryCount++;
            logger.warn(`Retrying ${modelName} after non-quota error (${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }

          logger.error(`AI failure with ${modelName}:`, err.message);
          break;
        }
      }
    }

    // All models exhausted
    throw new Error('All Gemini models failed. The submission will be retried by the worker on next cycle.');
  } finally {
    release();
  }
};



/**
 * [SYSTEM FALLBACK] Generates a realistic grade when the AI is busy.
 * This ensures the instructor's UI remains reactive even if the Gemini quota is exhausted.
 */
export const generateSimulatedEvaluation = (maxMarks: number = 100): EvaluationResult => {
  // Defaulting to a safe 'PENDING' state to avoid overestimating scores
  // This requires the instructor to perform a manual review
  return { 
    grade: 'PENDING', 
    score: 0, 
    source: 'system',
    feedback: 'AI is currently at capacity or timed out. Please retry this specific student.'
  };
};
