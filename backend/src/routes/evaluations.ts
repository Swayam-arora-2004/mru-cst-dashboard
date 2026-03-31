import { Router, Response } from 'express';
import multer from 'multer';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import logger from '../lib/logger';
import { evaluateSubmission } from '../lib/gemini';

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
      const { student_id, activity_id, type } = req.body;
      const file = req.file;

      if (!student_id || !activity_id || !type || !file) {
        res.status(400).json({ success: false, error: 'Missing evaluation metadata or file.' });
        return;
      }

      const supabase = getSupabaseAdminClient();

      // 1. Fetch metadata for AI context
      const [studentRes, activityRes] = await Promise.all([
        supabase.from('students').select('name').eq('id', student_id).single(),
        supabase.from('activities').select('title, type, question_file_url, max_marks, courses(name)').eq('id', activity_id).single()
      ]);

      if (studentRes.error || !studentRes.data || activityRes.error || !activityRes.data) {
        res.status(404).json({ success: false, error: 'Student or Activity context not found.' });
        return;
      }

      const studentName = studentRes.data.name;
      const activityTitle = activityRes.data.title;
      const courseName = (activityRes.data as any).courses?.name || 'Unknown Course';
      const questionFileUrl = activityRes.data.question_file_url;
      const maxMarks = (activityRes.data as any).max_marks || 100;

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

      // 2. Perform AI Evaluation
      const evaluation = await evaluateSubmission({
        studentName,
        activityTitle,
        activityType: type as any,
        courseName,
        maxMarks,
        fileData: {
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname
        },
        questionFileData
      });

      // 3. Save Evaluation to DB
      const { data: record, error: dbError } = await supabase
        .from('evaluations')
        .insert({
          teacher_id: req.user!.id,
          student_id,
          activity_id,
          type,
          grade: evaluation.grade,
          marks_attained: evaluation.score,
          file_name: file.originalname
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 4. 🔥 AUTO-SYNC: Mark as SUBMITTED in Assignments Tracker
      await supabase
        .from('assignment_submissions')
        .upsert({
          assignment_id: activity_id,
          student_id,
          status: 'submitted',
          marks_attained: evaluation.score,
          grade: evaluation.grade,
          feedback: `AI Graded: ${evaluation.grade} (${evaluation.score}/${maxMarks})`
        }, { onConflict: 'assignment_id,student_id' });

      res.status(200).json({
        success: true,
        data: record,
        message: 'AI Evaluation successful and activity status updated.'
      });

    } catch (err) {
      logger.error('Evaluation route error:', err);
      res.status(500).json({ success: false, error: 'AI Evaluation pipeline failed.' });
    }
  }
);

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
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('activity_id', req.params.activityId)
      .eq('teacher_id', req.user!.id);

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('Get activity evaluations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch activity evaluations.' });
  }
});

export default router;
