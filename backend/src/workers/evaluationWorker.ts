import { getSupabaseAdminClient } from '../lib/supabase';
import { runNativeFilePipeline } from '../lib/NativeFilePipeline';
import { runGroqPipeline } from '../lib/groqPipeline';
import { config } from '../config';
import { NotificationService } from '../lib/notifications';
import logger from '../lib/logger';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

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
  if (isProcessing) return; // Wait until current iteration finishes completely
  isProcessing = true;

  try {
    const supabase = getSupabaseAdminClient();
    
    // 1. Fetch exactly ONE pending assignment
    const { data: pending, error: fetchErr } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('status', 'submitted')
        .is('marks_attained', null)
        .order('submitted_at', { ascending: true })
        .limit(1)
        .single();
        
    if (fetchErr || !pending) {
      // Nothing to process, go back to sleep
      isProcessing = false;
      return;
    }

    const { id, assignment_id, student_id, file_url } = pending;
    logger.info(`[DAEMON] Found ungraded submission. Student ID: ${student_id} | Activity ID: ${assignment_id}`);

    // 2. Fetch required context (from strictly correct tables)
    // Here we must query the actual 'assignments' table to get the description context.
    const { data: activityData } = await supabase.from('assignments').select('*').eq('id', assignment_id).single();
    const { data: studentData } = await supabase.from('students').select('name').eq('id', student_id).single();
    
    if (!activityData || !studentData) {
        logger.warn(`[DAEMON] Missing context for submission ${id}. Marking as broken.`);
        await supabase.from('assignment_submissions').update({ status: 'broken' }).eq('id', id);
        isProcessing = false;
        return;
    }
    
    const { data: courseData } = await supabase.from('courses').select('teacher_id, name').eq('id', activityData.course_id).single();

    // 3. Download the actual student file from Supabase Storage
    //    IMPORTANT: Do NOT use response Content-Type — Supabase returns 'text/plain'
    //    for many files. We infer the correct MIME type from the file URL extension.
    const inferMimeType = (url: string): string => {
      const path = url.split('?')[0].toLowerCase();
      if (path.endsWith('.pdf'))  return 'application/pdf';
      if (path.endsWith('.png'))  return 'image/png';
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
      if (path.endsWith('.gif'))  return 'image/gif';
      if (path.endsWith('.webp')) return 'image/webp';
      if (path.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (path.endsWith('.doc'))  return 'application/msword';
      if (path.endsWith('.txt'))  return 'text/plain';
      return 'application/pdf'; // Safe default for academic submissions
    };

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) throw new Error(`[DAEMON] Failed to download student file: ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const mimeType = inferMimeType(file_url);
    logger.info(`[DAEMON] File MIME type resolved as: ${mimeType}`);

    // 4. Download Question Context (Optional)
    let questionFileData = undefined;
    if (activityData.question_file_url) {
      try {
        const qRes = await fetch(activityData.question_file_url);
        questionFileData = {
          buffer: Buffer.from(await qRes.arrayBuffer()),
          mimeType: inferMimeType(activityData.question_file_url),
          originalName: 'question_context'
        };
      } catch (e) {
        logger.warn('[DAEMON] Could not fetch question context file.');
      }
    }

    // 5. 🚀 Trigger Pipeline 4.0 or Groq 
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

    // 6. Save directly to Evaluations Master View safely without guessing constraint names
    const evalData = {
      teacher_id: courseData?.teacher_id || 'system',
      student_id,
      activity_id: assignment_id,
      type: 'assignment',
      grade: evaluation.grade,
      marks_attained: Number(evaluation.score),
      feedback: evaluation.feedback,
      file_name: file_url
    };

    const { data: existingEval } = await supabase.from('evaluations')
      .select('id').eq('student_id', student_id).eq('activity_id', assignment_id).single();

    if (existingEval) {
       const { error } = await supabase.from('evaluations').update(evalData).eq('id', existingEval.id);
       if (error) throw error;
    } else {
       const { error } = await supabase.from('evaluations').insert(evalData);
       if (error) throw error;
    }

    // 7. Update Submission Table (This officially removes it from the Queue)
    await supabase.from('assignment_submissions').update({
      marks_attained: Number(evaluation.score),
      grade: evaluation.grade,
      feedback: evaluation.feedback
    }).eq('id', id);

    logger.info(`[DAEMON] ✅ Successfully graded student ${student_id}. Grade: ${evaluation.grade}`);

    // Notification (Muted failure)
    try {
      await NotificationService.notifyUser(student_id, {
        title: `Evaluation Ready: ${activityData.title}`,
        body: `Your submission has been graded. Grade: ${evaluation.grade}.`,
      });
    } catch {}

  } catch (err: any) {
    if (err.message?.includes('429') || err.message?.includes('Quota') || err.message?.includes('Status 5')) {
        logger.error('[DAEMON] Quota wall or API error hit. Keeping in queue.');
        // We do NOTHING to the database. It stays 'submitted' and will be picked up next loop.
    } else {
        logger.error('[DAEMON] Unhandled Worker Failure:', err.message);
    }
  } finally {
    isProcessing = false;
  }
};
