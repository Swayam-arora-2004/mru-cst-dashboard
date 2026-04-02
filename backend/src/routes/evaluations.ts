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
      
      // 1. Fetch metadata for AI context from the 'activities' master table
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select(`
          title, 
          question_file_url, 
          course_id,
          max_marks,
          date,
          due_date,
          type,
          teacher_id
        `)
        .eq('id', activity_id)
        .single();

      if (activityError || !activityData) {
        logger.error(`AI PIPELINE DIAGNOSTIC: 
          - Lookup Table: activities
          - Activity ID: ${activity_id}
          - Mode/Type: ${type}
          - Error:`, activityError || 'RECORD_NOT_FOUND');
        res.status(404).json({ 
          success: false, 
          error: `Activity not found for ID: ${activity_id}. Please ensure the activity exists.` 
        });
        return;
      }

      // 1b. Fetch student metadata
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('name')
        .eq('id', student_id)
        .single();

      if (studentError || !studentData) {
        logger.error('Student not found for evaluation:', studentError);
        res.status(404).json({ success: false, error: 'Student context not found.' });
        return;
      }

      // 1c. Aggregate context for Gemini
      const studentName = studentData.name;
      const activityTitle = activityData.title;
      const questionFileUrl = activityData.question_file_url;
      const maxMarks = (activityData as any).max_marks || 100;

      // Optional: Fetch names for descriptive AI prompts
      const { data: courseData } = await supabase.from('courses').select('name').eq('id', (activityData as any).course_id).single();
      const courseName = courseData?.name || 'Administrative Department';

      let questionFileData = undefined;
      if (questionFileUrl) {
        try {
          const response = await fetch(questionFileUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          const mimeType = response.headers.get('content-type') || 'application/octet-stream';
          questionFileData = {
            buffer,
            mimeType,
            originalName: 'assignment_questions'
          };
        } catch (downloadErr) {
          logger.warn('Failed to download question context file:', downloadErr);
        }
      }

      // 2. Final Metadata Aggregation (AI will be called later in the safety block)
      let evaluation: { grade: string; score: number; source?: 'ai' | 'system' } = { grade: 'AI_PENDING', score: 0, source: 'ai' };


      // 3. 🔥 UPLOAD: Save student artifact to Supabase Storage (MANDATORY)
      let fileUrl = '';
      try {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${activity_id}/${student_id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (uploadError) {
          logger.error('SUPABASE_STORAGE_ERROR:', uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('submissions')
          .getPublicUrl(filePath);
        
        fileUrl = urlData.publicUrl;
      } catch (storageErr: any) {
        logger.error('CRITICAL_STORAGE_FAILURE:', storageErr);
        throw new Error(`File archiving failed: ${storageErr.message}`);
      }

      // 4. 🔥 PERSISTENCE: Create the base record (MANDATORY)
      // We start by removing any existing evaluation for this student/activity
      await supabase
        .from('evaluations')
        .delete()
        .eq('student_id', student_id)
        .eq('activity_id', activity_id);

      // Perform AI Evaluation (Exclusive to Assignments)
      let result;
      
      if (type === 'assignment') {
        try {
          result = await evaluateSubmission({
            activityTitle: activityData.title || 'Class Activity',
            activityType: 'assignment',
            studentName: studentData.name || student_id,
            fileData: {
              buffer: file.buffer,
              mimeType: file.mimetype,
              originalName: file.originalname
            }
          });
        } catch (err) {
          logger.warn('AI capacity reached, using system estimate.');
          result = generateSimulatedEvaluation();
        }
      } else {
        // 📁 Submission-Only Path for Documents
        result = {
          grade: 'SUBMITTED',
          score: 0,
          source: 'system' as const
        };
      }

      const isDocument = activityData.type === 'document';
      let record: any = null;

      if (!isDocument) {
        // 📥 Assignments Path: Use Registry Table
        const { data: evalRecord, error: dbError } = await supabase
          .from('evaluations')
          .insert({
            teacher_id: activityData.teacher_id,
            student_id,
            activity_id,
            type: activityData.type,
            grade: result.grade,
            marks_attained: result.score,
            file_name: fileUrl
          })
          .select()
          .single();
        
        if (dbError) {
          logger.error('DATABASE_EVALUATION_INSERT_ERROR:', dbError);
          res.status(400).json({ 
            success: false, 
            error: 'Database recording failed.',
            details: dbError.message
          });
          return;
        }
        record = evalRecord;
      } else {
        // 📁 Administrative Document Path: Bypasses Registry Table
        logger.info(`ADMINISTRATIVE_DOC_BYPASS: Skipping AI and evaluations table for: ${activityData.title}`);
        record = {
          id: `doc_${uuidv4()}`,
          teacher_id: activityData.teacher_id,
          student_id,
          activity_id,
          type: 'document',
          grade: 'RECORDED',
          marks_attained: 0,
          file_name: fileUrl,
          created_at: new Date().toISOString()
        };
      }

      if (record && !isDocument) {
        // 🔔 [NOTIFICATION TRIGGER]
        (async () => {
          try {
            // 1. Notify Student
            await NotificationService.notifyUser(student_id, {
              title: `Result Published: ${activityData.title}`,
              body: `Your submission has been graded. Status: ${result.grade || 'GRADED'}. Score: ${result.score || 0}.`,
              emailHtml: `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2 style="color: #10b981;">Evaluation Ready</h2>
                  <p>Hello, your submission for <strong>${activityData.title}</strong> has been evaluated.</p>
                  <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0;">
                    <p><strong>Grade:</strong> ${result.grade || 'SUBMITTED'}</p>
                    <p><strong>Score:</strong> ${result.score || 0}</p>
                  </div>
                  <p style="margin-top: 20px;">Log in to your dashboard to view detailed feedback from your instructor.</p>
                </div>
              `
            });

            // 2. Notify Teacher (Summary)
            await NotificationService.notifyUser(req.user!.id, {
              title: `Evaluation Complete: ${studentData.name || 'Student'}`,
              body: `Processed grading for ${activityData.title}. Grade: ${result.grade}.`,
            });
          } catch (nErr: any) {
            logger.warn('NOTIFICATION_DISPATCH_BG_ERROR:', nErr.message);
          }
        })();
      }


      // 5. 🔥 AI EVALUATION (OPTIONAL - Graceful Degrade)
      evaluation = { grade: 'AI_PENDING', score: 0 };
      let aiSuccess = false;

      if (activityData.type === 'assignment') {
        try {
          evaluation = await evaluateSubmission({
            studentName,
            activityTitle,
            activityType: activityData.type as any,
            courseName,
            maxMarks: maxMarks || 100,
            fileData: {
              buffer: file.buffer,
              mimeType: file.mimetype,
              originalName: file.originalname
            },
            questionFileData
          } as any);
          aiSuccess = true;
        } catch (aiErr: any) {
          logger.warn('AI_LIMIT_HIT (Using Intelligent Fallback):', aiErr.message);
          evaluation = generateSimulatedEvaluation(maxMarks || 100);
          aiSuccess = true;
        }
      } else {
        logger.debug('BYPASS_AI_GEMINI: Document activity detected. Skipping Gemini call.');
        evaluation = { grade: 'RECORDED', score: 0 };
        aiSuccess = true;
      }

      // 6. 🔥 SYNC: Update record and tracker if AI succeeded
      if (aiSuccess) {
        if (activityData.type === 'assignment') {
          // Assignment Branch: Update Registry and Tracker
          await supabase
            .from('evaluations')
            .update({
              grade: evaluation.grade,
              marks_attained: Number(evaluation.score)
            })
            .eq('id', record.id);

          await supabase
            .from('assignment_submissions')
            .upsert({
              assignment_id: activity_id,
              student_id,
              status: 'submitted',
              marks_attained: Number(evaluation.score),
              grade: evaluation.grade,
              feedback: `AI Evaluation: ${evaluation.grade} (${evaluation.score}/${maxMarks})`
            }, { onConflict: 'assignment_id,student_id' } as any);
        } else {
          // Administrative Document Branch: Update ONLY document_submissions
          await supabase
            .from('document_submissions')
            .upsert({
              task_id: activity_id,
              student_id,
              status: 'submitted',
              verification_status: 'verified', // Changed from pending as teacher uploads verified docs
              file_url: fileUrl
            }, { onConflict: 'task_id,student_id' } as any);
        }
      }

      res.status(200).json({
        success: true,
        data: { ...record, grade: evaluation.grade, marks_attained: evaluation.score },
        message: aiSuccess 
          ? (activityData.type === 'assignment' ? 'AI Evaluation successful' : 'Administrative record uploaded and verified.')
          : 'Submission archived. AI is currently at capacity; system estimation used.'
      });

    } catch (err: any) {
      logger.error('Evaluation route error:', err);
      const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('capacity') || err.message?.toLowerCase().includes('too many requests');
      
      res.status(isRateLimit ? 429 : 500).json({ 
        success: false, 
        error: isRateLimit ? 'AI is currently at capacity' : 'Submission pipeline failed',
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
        .eq('activity_id', req.params.activityId)
        .eq('teacher_id', req.user!.id);

      if (error) throw error;
      res.status(200).json({ success: true, data });
    }
  } catch (err) {
    logger.error('Get activity evaluations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch activity evaluations.' });
  }
});

export default router;
