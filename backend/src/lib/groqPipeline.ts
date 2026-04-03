import { config } from '../config';
import logger from './logger';
import { NativeEvalParams, EvaluationResult } from './NativeFilePipeline';
import { extractTextFromBuffer } from './textExtractor';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'llama-3.3-70b-versatile'; // Incredibly fast and natively generous

// Simple local mutex to space out groq calls
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
export const groqLock = new Mutex();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Alternative grading engine using Groq API (Llama 3).
 * Extracts text from the buffer before sending to avoid binary ingestion limits.
 */
export const runGroqPipeline = async (params: NativeEvalParams): Promise<EvaluationResult> => {
    const maxMarks = params.maxMarks || 100;
    
    if (!config.groq.apiKey) {
      throw new Error("GROQ_API_KEY is not defined.");
    }

    logger.info(`[GROQ PIPELINE] Initializing reliable text extraction for ${params.studentName}...`);
    
    // 1. Text Extraction
    const studentText = await extractTextFromBuffer(params.fileData.buffer, params.fileData.mimeType, params.fileData.originalName);
    
    let questionText = '';
    if (params.questionFileData) {
        questionText = await extractTextFromBuffer(params.questionFileData.buffer, params.questionFileData.mimeType, params.questionFileData.originalName);
    }

    // Only hard-fail if the student text is a raw binary/completely unreadable blob
    const isCompletelyUnreadable =
      studentText.startsWith('[EXTRACTION_ERROR') &&
      studentText.includes('encoding') ;

    if (isCompletelyUnreadable) {
        return { 
           grade: 'F', 
           score: 0, 
           feedback: 'The submission file is corrupted or unreadable. Please ask the student to resubmit as a PDF or DOCX file.',
           source: 'system' 
        };
    }

    // 2. Strict Semantic Prompting
    const systemPrompt = `You are a Strict University Professor grading a student's ${params.activityType}.
Student Name: ${params.studentName}
Topic: ${params.activityTitle}
Course: ${params.courseName}
Max Marks: ${maxMarks}

=== ASSIGNMENT CONTEXT ===
${params.description ? `Assignment Description / Rubric:\n${params.description}\n` : 'No explicit textual description provided.'}
${questionText ? `Original Assignment Questions/Context:\n"""\n${questionText}\n"""` : ''}

=== STUDENT SUBMISSION TEXT TRACT ===
"""
${studentText}
"""

=== GRADING IMPERATIVES ===
You MUST grade this submission with ABSOLUTE MATHEMATICAL PRECISION.
1. ZERO TOLERANCE: If the submission text is BLANK or COMPLETELY IRRELEVANT to the assignment context, assign score 0 and grade F.
2. FILE FORMAT ISSUES: If the submission text contains a message like [DOCX_EMPTY], [PDF_EMPTY], or [IMAGE_SUBMITTED], this means the file was unreadable. Give a score of 0 and explain the issue clearly in "reason". Do NOT penalize for file issues if the assignment context has no question to compare against.
3. PERFECT ACCURACY: Analyze step-by-step how well the student's submission meets the exact requirements in your "chainOfThought".
4. FINAL SCORE: Score strictly between 0 and ${maxMarks}. Ensure the score mathematically justifies the chain of thought.
5. FINAL GRADE: Must be exactly one of: A, B, C, D, or F.
   - A: ${Math.round(maxMarks * 0.9)}-${maxMarks} marks (Excellent)
   - B: ${Math.round(maxMarks * 0.75)}-${Math.round(maxMarks * 0.89)} marks (Good)
   - C: ${Math.round(maxMarks * 0.6)}-${Math.round(maxMarks * 0.74)} marks (Average)
   - D: ${Math.round(maxMarks * 0.45)}-${Math.round(maxMarks * 0.59)} marks (Below Average)
   - F: 0-${Math.round(maxMarks * 0.44)} marks (Fail / Blank / Irrelevant)

You must return ONLY a JSON object (do not include markdown \`\`\` wrappers). The JSON must have the following keys:
- "chainOfThought": "Your step-by-step reasoning comparing the student's submission to the assignment context."
- "grade": "The letter grade"
- "score": The numeric score
- "reason": "A concise 1-2 sentence summary of feedback for the student based on your reasoning."`;

    const release = await groqLock.acquire();
    try {
        let attempts = 0;
        const maxAttempts = 3;
        let lastError: any;

        while (attempts < maxAttempts) {
            try {
                if (attempts > 0) {
                    logger.info(`[GROQ PIPELINE] Retry #${attempts} for ${params.studentName}...`);
                    await sleep(15000); // 15s backoff for retries
                }

                logger.info(`[GROQ PIPELINE] Firing request to Groq Engine (${MODEL_NAME})...`);
                const response = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.groq.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: MODEL_NAME,
                        messages: [{ role: 'system', content: systemPrompt }],
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_completion_tokens: 1500
                    })
                });

                if (!response.ok) {
                    const errorDetails = await response.text();
                    const status = response.status;
                    
                    if (status === 429 || status >= 500) {
                        logger.warn(`[GROQ PIPELINE] Transient Error ${status}: ${errorDetails}`);
                        attempts++;
                        lastError = new Error(`Groq API Status ${status}`);
                        continue;
                    }
                    throw new Error(`Groq API Error: ${status} - ${errorDetails}`);
                }

                const json = await response.json() as any;
                const rawText = json.choices[0].message.content;
                
                let evaluation;
                try {
                     evaluation = JSON.parse(rawText);
                } catch (parseErr: any) {
                     logger.warn(`[GROQ PIPELINE] JSON Syntax Error: ${parseErr.message}`);
                     throw new Error("Failed to parse Groq structured response.");
                }

                const rawScore = Number(evaluation.score);
                const score = isNaN(rawScore) ? 0 : Math.min(Math.max(Math.round(rawScore), 0), maxMarks);
                const grade = ['A', 'B', 'C', 'D', 'F'].includes(evaluation.grade) ? evaluation.grade : 'F';

                logger.info(`[GROQ PIPELINE] ✅ Success with Groq: ${grade} (${score}/${maxMarks})`);
                return { grade, score, feedback: String(evaluation.reason), source: 'ai' };

            } catch (innerErr: any) {
                lastError = innerErr;
                attempts++;
                if (attempts < maxAttempts) {
                    await sleep(10000);
                }
            }
        }
        
        throw lastError || new Error("Unknown Groq pipeline failure after retries.");

    } catch (err: any) {
        const realError = err?.message || String(err);
        logger.error(`[GROQ PIPELINE] FATAL ERROR: ${realError}`);
        
        // If it's a permanent text extraction or logic error, return system F.
        // If it's a network/quota error, we throw so the worker retries later.
        if (realError.includes('Quota') || realError.includes('429') || realError.includes('Status 5')) {
            throw err; 
        }

        return { 
           grade: 'F', 
           score: 0, 
           feedback: `Groq Error: ${realError}. Please grade manually.`, 
           source: 'system' 
        };
    } finally {
        await sleep(10000); // MANDATORY 10s cooling period inside the lock
        release();
    }
};
