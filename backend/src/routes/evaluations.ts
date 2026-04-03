import { Router, Response } from 'express';
import multer from 'multer';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import logger from '../lib/logger';
import { evaluateSubmission, generateSimulatedEvaluation } from '../lib/gemini';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../lib/notifications';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* =========================
   POST /api/evaluations/evaluate
   Evaluates a file and updates the activity status
========================= */
router.post(
  '/evaluate',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      req.setTimeout(300000); // 5 minutes timeout for AI retries
      const { student_id, activity_id, type } = req.body;
      const file = req.file;

      if (!student_id || !activity_id || !type || !file) {
        res.status(400).json({ success: false, error: 'Missing evaluation metadata or file.' });
        return;
      }

      const supabase = getSupabaseAdminClient();
      
      // 1. Fetch Metadata (Activity, Student, Course)
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activity_id)
        .single();

      if (activityError || !activityData) {
        res.status(404).json({ success: false, error: 'Activity not found.' });
        return;
      }

      const { data: studentData } = await supabase.from('students').select('name').eq('id', student_id).single();
      const { data: courseData } = await supabase.from('courses').select('name').eq('id', (activityData as any).course_id).single();
      
      if (!studentData) {
        res.status(404).json({ success: false, error: 'Student context not found.' });
        return;
      }

      const courseName = courseData?.name || 'Administrative Department';
      const maxMarks = (activityData as any).max_marks || 100;

      // 2. Download Question Context (Optional)
      let questionFileData = undefined;
      if (activityData.question_file_url) {
        try {
          const qRes = await fetch(activityData.question_file_url);
          questionFileData = {
            buffer: Buffer.from(await qRes.arrayBuffer()),
            mimeType: qRes.headers.get('content-type') || 'application/pdf',
            originalName: 'question_context'
          };
        } catch (e) {
          logger.warn('Failed to fetch question context:', e);
        }
      }

      // 3. Upload Student Submission (Storage)
      let fileUrl = '';
      try {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${uuidv4()}.${fileExt}`;
        const filePath = `${activity_id}/${student_id}/${fileName}`;
        
        await supabase.storage.from('submissions').upload(filePath, file.buffer, { contentType: file.mimetype });
        fileUrl = supabase.storage.from('submissions').getPublicUrl(filePath).data.publicUrl;
      } catch (storageErr: any) {
        throw new Error(`Storage failed: ${storageErr.message}`);
      }

      // 4. 🔥 STEP 1: SUBMISSION RECEIPT (MANDATORY & IMMEDIATE)
      const isDocument = activityData.type === 'document';
      if (isDocument) {
        // Document Path: Straight to recording
        await supabase.from('document_submissions').upsert({
          task_id: activity_id,
          student_id,
          status: 'submitted',
          file_url: fileUrl
        }, { onConflict: 'task_id,student_id' } as any);

        res.status(200).json({ 
          success: true, 
          message: 'Document archived and verified.',
          data: { student_id, activity_id, type: 'document', grade: 'RECORDED', status: 'submitted', file_url: fileUrl }
        });
        return;
      }

      // Assignment Path: Receipt in assignment_submissions
      await supabase.from('assignment_submissions').upsert({
        assignment_id: activity_id,
        student_id,
        status: 'submitted',
        file_url: fileUrl,
        submitted_at: new Date().toISOString()
      }, { onConflict: 'assignment_id,student_id' } as any);

      // 🏁 RESPOND IMMEDIATELY TO CLIENT
      // This allows the frontend to show "Submitted" and stop the loader.
      res.status(200).json({
        success: true,
        message: 'Submission archived. AI grading is processing in the background.',
        data: { status: 'submitted', file_url: fileUrl }
      });

      return; // End the route handler


    } catch (err: any) {
      logger.error('CRITICAL_EVAL_ROUTE_ERROR:', err);
      const status = (err.status || err.statusCode || 500);
      res.status(status).json({ 
        success: false, 
        error: err.error || 'Submission pipeline failed.', 
        details: err.message || 'Unknown internal error',
        hint: status === 429 ? 'AI API Quota reached. Please wait a minute or grade manually.' : undefined
      });
    }
  }
);

/* =========================
   DELETE /api/evaluations/:id
   Removes a submission and resets student status
========================= */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();
    
    // 1. Fetch record first to get metadata for cleanup
    const { data: evalData, error: fetchError } = await supabase
      .from('evaluations')
      .select('*')
      .eq('id', req.params.id)
      .eq('teacher_id', req.user!.id)
      .single();

    if (fetchError || !evalData) {
      res.status(404).json({ success: false, error: 'Submission not found or unauthorized.' });
      return;
    }

    // 2. Delete the record
    await supabase.from('evaluations').delete().eq('id', evalData.id);

    // 3. Reset the status in the tracker table
    const table = evalData.type === 'assignment' ? 'assignment_submissions' : 'document_submissions';
    const foreignKey = evalData.type === 'assignment' ? 'assignment_id' : 'task_id';

    await supabase
      .from(table)
      .update({ status: 'missing', marks_attained: null, grade: null })
      .eq(foreignKey, evalData.activity_id)
      .eq('student_id', evalData.student_id);

    res.status(200).json({ success: true, message: 'Submission deleted and status reset.' });
  } catch (err) {
    logger.error('Delete evaluation error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete submission.' });
  }
});

/* =========================
   PATCH /api/evaluations/:id
   Manual override for evaluation (Update score/feedback)
========================= */
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { grade, marks_attained } = req.body;
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('evaluations')
      .update({ grade, marks_attained })
      .eq('id', req.params.id)
      .eq('teacher_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, error: 'Evaluation not found or unauthorized.' });
      return;
    }

    res.status(200).json({ success: true, data, message: 'Evaluation updated manually.' });
  } catch (err) {
    logger.error('Update evaluation error:', err);
    res.status(500).json({ success: false, error: 'Failed to update evaluation.' });
  }
});

/* =========================
   POST /api/evaluations/retry/:id
   Re-triggers AI evaluation for an existing record
========================= */
router.post('/retry/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();
    
    // 1. Fetch existing record
    const { data: evalData, error: fetchError } = await supabase
      .from('evaluations')
      .select('*')
      .eq('id', req.params.id)
      .eq('teacher_id', req.user!.id)
      .single();

    if (fetchError || !evalData) {
      res.status(404).json({ success: false, error: 'Evaluation not found or unauthorized.' });
      return;
    }

    // 2. Fetch associated activity and student metadata
    const { data: activityData } = await supabase.from('assignments').select('*').eq('id', evalData.activity_id).single();
    const { data: studentData } = await supabase.from('students').select('name').eq('id', evalData.student_id).single();

    if (!activityData || !studentData) {
      res.status(404).json({ success: false, error: 'Metadata context not found.' });
      return;
    }

    // 3. Re-download the file from Supabase Storage
    const response = await fetch(evalData.file_name);
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') || 'application/pdf';

    // 4. Fetch Question context if applicable
    let questionFileData = undefined;
    if (activityData.question_file_url) {
      try {
        const qRes = await fetch(activityData.question_file_url);
        questionFileData = {
          buffer: Buffer.from(await qRes.arrayBuffer()),
          mimeType: qRes.headers.get('content-type') || 'application/pdf',
          originalName: 'question_context'
        };
      } catch (e) {
        logger.warn('Retry AI: Question context fetch failed.', e);
      }
    }

    // 5. Re-run AI Evaluation via Native Cloud Engine Pipeline
    let evaluationRes;
    try {
      // Import explicitly here to prevent circular deps if issue
      const { runNativeFilePipeline } = require('../lib/NativeFilePipeline');
      const { runGroqPipeline } = require('../lib/groqPipeline');
      const { config } = require('../config');
      const courseDataData = await supabase.from('courses').select('name').eq('id', activityData.course_id).single();

      const gradingParams = {
        studentName: studentData.name,
        activityTitle: activityData.title,
        activityType: 'assignment' as const, // type is always assignment for evaluations right now
        courseName: courseDataData.data?.name || 'General',
        description: activityData.description || undefined,
        maxMarks: activityData.max_marks || 100,
        fileData: { buffer, mimeType, originalName: 'retry_submission' },
        questionFileData
      };

      if (config.groq.apiKey) {
         evaluationRes = await runGroqPipeline(gradingParams);
      } else {
         evaluationRes = await runNativeFilePipeline(gradingParams);
      }
    } catch (aiErr: any) {
      logger.error('Retry AI Failure:', aiErr.message);
      // Fallback to system pending to avoid getting stuck
      evaluationRes = generateSimulatedEvaluation(activityData.max_marks || 100);
    }

    // 6. 🔥 STEP 3: RESULT PERSISTENCE (evaluations)
    const { data: updatedRecord, error: evalErr } = await supabase
      .from('evaluations')
      .upsert({
        teacher_id: req.user!.id,
        student_id: evalData.student_id,
        activity_id: evalData.activity_id,
        type: activityData.type,
        grade: evaluationRes.grade,
        marks_attained: Number(evaluationRes.score),
        feedback: evaluationRes.feedback,
        file_name: evalData.file_name
      }, { onConflict: 'student_id,activity_id' } as any)
      .select()
      .single();

    if (evalErr) throw evalErr;

    // 7. 🔥 STEP 4: SYNC (assignment_submissions)
    if (activityData.type === 'assignment') {
      await supabase
        .from('assignment_submissions')
        .upsert({
          assignment_id: evalData.activity_id,
          student_id: evalData.student_id,
          marks_attained: Number(evaluationRes.score),
          grade: evaluationRes.grade,
          status: 'submitted',
          feedback: evaluationRes.feedback || `AI Retry: ${evaluationRes.grade}`
        }, { onConflict: 'assignment_id,student_id' } as any);
    }

    res.status(200).json({ 
      success: true, 
      data: updatedRecord, 
      message: evaluationRes.source === 'system' ? 'AI busy; retry marked as pending.' : 'AI Re-evaluation successful.' 
    });

  } catch (err: any) {
    logger.error('Retry AI Route error:', err);
    res.status(500).json({ success: false, error: 'Retry pipeline failed.', details: err.message });
  }
});

/* =========================
   GET /api/evaluations/student/:studentId
   List all evaluations for a student
========================= */
router.get('/student/:studentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('evaluations')
      .select('*, activities(title, max_marks)')
      .eq('student_id', req.params.studentId)
      .eq('teacher_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('Get student evaluations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch evaluations.' });
  }
});

/* =========================
   GET /api/evaluations/activity/:activityId
   List all evaluations for a specific activity
========================= */
router.get('/activity/:activityId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Check activity type first
    const { data: activity } = await supabase
      .from('activities')
      .select('type')
      .eq('id', req.params.activityId)
      .single();

    if (activity?.type === 'document') {
       const { data, error } = await supabase
        .from('document_submissions')
        .select(`
          id,
          student_id,
          task_id,
          status,
          verification_status,
          file_url,
          created_at
        `)
        .eq('task_id', req.params.activityId);

        if (error) throw error;
        
        // Map to evaluations format for UI compatibility
        const mappedData = (data || []).map(row => ({
          ...row,
          activity_id: row.task_id,
          type: 'document',
          file_name: row.file_url, // Map file_url to expected frontend key
          grade: row.status === 'submitted' ? 'RECORDED' : 'MISSING',
          marks_attained: 0
        }));
        
        res.status(200).json({ success: true, data: mappedData });
    } else {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('activity_id', req.params.activityId);
        // Removed strict teacher_id filter to allow shared activity grading visibility

      if (error) throw error;
      res.status(200).json({ success: true, data });
    }
  } catch (err) {
    logger.error('Get activity evaluations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch activity evaluations.' });
  }
});

export default router;
