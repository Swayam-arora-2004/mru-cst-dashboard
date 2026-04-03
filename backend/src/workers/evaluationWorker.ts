import { getSupabaseAdminClient } from '../lib/supabase';
import { runNativeFilePipeline } from '../lib/NativeFilePipeline';
import { runGroqPipeline } from '../lib/groqPipeline';
import { config } from '../config';
import { NotificationService } from '../lib/notifications';
import logger from '../lib/logger';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let heartbeatCounter = 0;

/**
 * Starts the background polling sequence.
 * Detaches AI processing entirely from the HTTP request lifecycle.
 */
export const startEvaluationWorker = () => {
  if (workerInterval) return;
  logger.info('🚀 True Daemon Worker: Evaluation process started.');
  
  // We check the database every 10 seconds.
  workerInterval = setInterval(processNextSubmission, 10000);
};

const processNextSubmission = async () => {
  if (isProcessing) return; 
  isProcessing = true;

  try {
    const supabase = getSupabaseAdminClient();
    
    // Heartbeat for logs (every ~1 minute)
    heartbeatCounter++;
    if (heartbeatCounter >= 6) {
      logger.debug('[DAEMON_HEARTBEAT] Worker is alive and polling queue.');
      heartbeatCounter = 0;
    }

    // 1. Fetch exactly ONE pending assignment
    // Use .limit(1) instead of .single() to avoid 406/No-Row errors when queue is empty
    const { data: queue, error: fetchErr } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('status', 'submitted')
        .is('marks_attained', null)
        .order('submitted_at', { ascending: true })
        .limit(1);
        
    if (fetchErr) {
      logger.error('[DAEMON] Queue fetch error:', fetchErr.message);
      isProcessing = false;
      return;
    }

    if (!queue || queue.length === 0) {
      // Nothing to process, go back to sleep
      isProcessing = false;
      return;
    }

    const pending = queue[0];
    const { id, assignment_id, student_id, file_url } = pending;
    logger.info(`[DAEMON] 🔍 Processing ${student_id}'s submission for AI evaluation...`);

    // 2. Fetch required context
    const { data: activityData } = await supabase.from('assignments').select('*').eq('id', assignment_id).maybeSingle();
    const { data: studentData } = await supabase.from('students').select('name').eq('id', student_id).maybeSingle();
    
    if (!activityData || !studentData) {
        logger.warn(`[DAEMON] Missing context for submission ${id}. Marking as broken.`);
        await supabase.from('assignment_submissions').update({ status: 'broken' }).eq('id', id);
        isProcessing = false;
        return;
    }
    
    const { data: courseData } = await supabase.from('courses').select('teacher_id, name').eq('id', activityData.course_id).maybeSingle();

    // 3. Download the actual student file from Supabase Storage
    const inferMimeType = (url: string): string => {
      const path = url.split('?')[0].toLowerCase();
      if (path.endsWith('.pdf'))  return 'application/pdf';
      if (path.endsWith('.png'))  return 'image/png';
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
      if (path.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (path.endsWith('.doc'))  return 'application/msword';
      if (path.endsWith('.txt'))  return 'text/plain';
      return 'application/pdf';
    };

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) throw new Error(`Student file inaccessible (${fileRes.status})`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const mimeType = inferMimeType(file_url);

    // 4. Download Question Context (Optional)
    let questionFileData = undefined;
    if (activityData.question_file_url) {
      try {
        const qRes = await fetch(activityData.question_file_url);
        if (qRes.ok) {
          questionFileData = {
            buffer: Buffer.from(await qRes.arrayBuffer()),
            mimeType: inferMimeType(activityData.question_file_url),
            originalName: 'question_context'
          };
        }
      } catch (e) {
        logger.warn('[DAEMON] Question context fetch failed (Non-critical)');
      }
    }

    // 5. 🚀 Trigger Pipeline
    let evaluation;
    const gradingParams = {
      studentName: studentData.name,
      activityTitle: activityData.title,
      activityType: 'assignment' as const,
      courseName: courseData?.name || 'General',
      description: activityData.description || undefined,
      maxMarks: activityData.max_marks || 100,
      fileData: { buffer, mimeType, originalName: 'submission' },
      questionFileData
    };

    if (config.groq.apiKey) {
       evaluation = await runGroqPipeline(gradingParams);
    } else {
       evaluation = await runNativeFilePipeline(gradingParams);
    }

    // 6. Save directly to Evaluations Master (Always INSERT to preserve portfolio history)
    const evalData = {
      teacher_id: courseData?.teacher_id || 'system',
      student_id,
      activity_id: assignment_id,
      type: 'assignment',
      grade: evaluation.grade,
      marks_attained: Number(evaluation.score),
      feedback: evaluation.feedback,
      file_name: file_url,
      source: 'ai'
    };

    // 🚀 NEW: We perform a blind insert to ensure ALL graded attempts are preserved in the master transcript.
    // This enables the "Portfolio" view where a student can have multiple graded files for a single lab/assignment.
    const { error: evalInsertErr } = await supabase.from('evaluations').insert(evalData);
    if (evalInsertErr) {
        // If there's a unique constraint on (student_id, activity_id), we fall back to upsert based on those keys.
        // This ensures the worker never "fails" but tries its best to keep history if the DB schema allows it.
        logger.warn(`[DAEMON] Evaluation Insert Conflict: ${evalInsertErr.message}. Attempting update instead.`);
        await supabase.from('evaluations')
          .upsert(evalData, { onConflict: 'student_id,activity_id' });
    }

    // 7. Update Submission Table
    await supabase.from('assignment_submissions').update({
      marks_attained: Number(evaluation.score),
      grade: evaluation.grade,
      feedback: evaluation.feedback
    }).eq('id', id);

    logger.info(`[DAEMON] AI Grading Complete: ${studentData.name} | Result: ${evaluation.grade}`);

    // Notification (Muted failure)
    try {
      await NotificationService.notifyUser(student_id, {
        title: `Evaluation Ready: ${activityData.title}`,
        body: `Your submission has been graded. Grade: ${evaluation.grade}.`,
      });
    } catch {}

  } catch (err: any) {
    if (err.message?.includes('429') || err.message?.includes('Quota') || err.message?.includes('status 5')) {
        logger.error('[DAEMON] API Quota reached. Submission remains in queue for retry.');
    } else {
        logger.error('[DAEMON] Worker processing failure:', err.message);
    }
  } finally {
    isProcessing = false;
  }
};
