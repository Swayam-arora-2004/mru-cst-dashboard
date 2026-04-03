import { getGenAI, aiLock } from './gemini';
import logger from './logger';

export interface NativeEvalParams {
  activityTitle: string;
  activityType: 'assignment' | 'document';
  courseName: string;
  studentName: string;
  description?: string;
  maxMarks?: number;
  fileData: { buffer: Buffer; mimeType: string; originalName: string };
  questionFileData?: { buffer: Buffer; mimeType: string; originalName: string };
}

export interface EvaluationResult {
  grade: string;
  score: number;
  feedback: string;
  source: 'ai' | 'system';
}

const NATIVE_MODELS = [
  'models/gemini-2.0-flash',     // Best intelligence
  'models/gemini-1.5-pro',       // Highly reasoning capable
  'models/gemini-1.5-flash',     // Fast fallback
];

/**
 * HIGH-RELIABILITY AI EVALUATION Alternative Pipeline
 * Replaced Google File Manager with Direct Inline Data for maximum stability.
 */
export const runNativeFilePipeline = async (params: NativeEvalParams): Promise<EvaluationResult> => {
    const ai = getGenAI();
    const maxMarks = params.maxMarks || 100;

    logger.info(`[GRADING PIPELINE] Initializing reliable evaluation for ${params.studentName}...`);
    
    const systemPrompt = `You are a Strict University Professor grading a student's ${params.activityType}.
Student Name: ${params.studentName}
Topic: ${params.activityTitle}
Course: ${params.courseName}
Max Marks: ${maxMarks}

=== ASSIGNMENT CONTEXT ===
${params.description ? `Assignment Description / Rubric:\n${params.description}\n` : 'No explicit textual description provided.'}
${params.questionFileData ? 'Attached Question/Context file provided below for reference.' : ''}

=== GRADING IMPERATIVES ===
You MUST grade this submission with ABSOLUTE MATHEMATICAL PRECISION.
1. ZERO TOLERANCE: If the submission is BLANK, COMPLETELY IRRELEVANT to the assignment context, or a corrupted file, you MUST assign a score of 0 and grade F.
2. PERFECT ACCURACY: You must thoroughly read the Assignment Context. Then, analyze step-by-step how well the student's submission met those exact requirements in your "chainOfThought".
3. FINAL SCORE: Score strictly between 0 and ${maxMarks}. Ensure the score mathematically justifies the chain of thought.
4. FINAL GRADE: Must be exactly one of: A, B, C, D, or F.
   - A: ${Math.round(maxMarks * 0.9)}-${maxMarks} marks (Excellent completion)
   - B: ${Math.round(maxMarks * 0.75)}-${Math.round(maxMarks * 0.89)} marks (Good completion)
   - C: ${Math.round(maxMarks * 0.6)}-${Math.round(maxMarks * 0.74)} marks (Average completion)
   - D: ${Math.round(maxMarks * 0.45)}-${Math.round(maxMarks * 0.59)} marks (Below Average)
   - F: 0-${Math.round(maxMarks * 0.44)} marks (Fail / Blank / Irrelevant)

You must return ONLY a JSON object (do not include markdown \`\`\` wrappers). The JSON must have the following keys:
- "chainOfThought": "Your step-by-step reasoning comparing the student's submission to the assignment context."
- "grade": "The letter grade"
- "score": The numeric score
- "reason": "A concise 1-2 sentence summary of feedback for the student based on your reasoning."`;

    // Fast and highly-reliable inline data approach
    const promptParts: any[] = [{ text: systemPrompt }];
    if (params.questionFileData) {
        promptParts.push({ inlineData: { data: params.questionFileData.buffer.toString('base64'), mimeType: params.questionFileData.mimeType } });
    }
    promptParts.push({ inlineData: { data: params.fileData.buffer.toString('base64'), mimeType: params.fileData.mimeType } });

    // Lock required for pacing API limits
    const release = await aiLock.acquire();
    let hitQuotaError = false;
    try {
        for (const modelName of NATIVE_MODELS) {
            try {
                const model = ai.getGenerativeModel({ model: modelName });

                // Calling Standard GenerateContent
                const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }] });
                const rawText = result.response.text();
                
                // Robustly extract JSON object ignoring conversational wrapper text
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                     logger.warn(`[GRADING PIPELINE] Failed to find JSON in response payload from ${modelName}`);
                     continue; // Try next model
                }
                
                let evaluation;
                try {
                     evaluation = JSON.parse(jsonMatch[0]);
                } catch (parseErr: any) {
                     logger.warn(`[GRADING PIPELINE] JSON Syntax Error from ${modelName}: ${parseErr.message}`);
                     continue;
                }

                const rawScore = Number(evaluation.score);
                const score = isNaN(rawScore) ? 0 : Math.min(Math.max(Math.round(rawScore), 0), maxMarks);
                const grade = ['A', 'B', 'C', 'D', 'F'].includes(evaluation.grade) ? evaluation.grade : 'F';

                logger.info(`[GRADING PIPELINE] ✅ Success with ${modelName}: ${grade} (${score}/${maxMarks})`);
                return { grade, score, feedback: String(evaluation.reason), source: 'ai' };
            } catch (err: any) {
                logger.warn(`[GRADING PIPELINE] Model ${modelName} encountered warning: ${err.message}`);
                if (err.message && err.message.includes('429')) {
                     hitQuotaError = true;
                     logger.info('[GRADING PIPELINE] Rate limit hit. Cooling down for 30s...');
                     await new Promise(r => setTimeout(r, 30000));
                }
            }
        }
        
        // If they hit quota, we throw so the worker retries later.
        if (hitQuotaError) {
            throw new Error('Google AI Quota Exceeded (429). Please retry later.');
        }

        // If all AI fails for other reasons, return the systemic fallback.
        logger.error(`[GRADING PIPELINE] ALL AI MODELS FAILED.`);
        const fallbackFeedback = 'AI Grading failed due to unreadable file formatting or model error. Please grade manually.';
           
        return { grade: 'F', score: 0, feedback: fallbackFeedback, source: 'system' };
        
    } finally {
        release();
    }
};
