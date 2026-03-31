import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ApiResponse } from '../types';
import logger from '../lib/logger';

const router = Router();

// GET Monthly Attendance Stats for the Dashboard Snapshot
router.get('/stats/attendance/monthly', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Fetch parent sessions for this month
    const { data: sessions, error: sessionsError } = await supabase
      .from('attendance_sessions')
      .select('id, course_id, courses(name, code)')
      .eq('teacher_id', req.user!.id)
      .gte('date', firstDayOfMonth);

    if (sessionsError) {
      console.error('SESSIONS_QUERY_ERROR:', sessionsError.message, sessionsError.details);
      throw sessionsError;
    }
    
    if (!sessions || sessions.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const sessionIds = sessions.map(s => s.id);

    // Fetch all records for these sessions
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select('session_id, status')
      .in('session_id', sessionIds);

    if (recordsError) {
      console.error('RECORDS_QUERY_ERROR:', recordsError.message, recordsError.details);
      throw recordsError;
    }

    // Aggregate by course
    const statsMap: Record<string, any> = {};

    sessions.forEach(session => {
      const courseId = session.course_id;
      const courseInfo = (session as any).courses;
      
      if (!statsMap[courseId]) {
        statsMap[courseId] = {
          id: courseId,
          course: courseInfo?.name || 'Unknown',
          code: courseInfo?.code || 'N/A',
          present: 0,
          absent: 0,
          alert: false
        };
      }

      const sessionRecords = records?.filter(r => r.session_id === session.id) || [];
      sessionRecords.forEach(record => {
        if (record.status === 'present') statsMap[courseId].present++;
        else if (record.status === 'absent') statsMap[courseId].absent++;
      });
    });

    // Finalize and check for alerts (e.g., < 75% attendance)
    const result = Object.values(statsMap).map(s => {
      const total = s.present + s.absent;
      const percent = total > 0 ? (s.present / total) * 100 : 100;
      return {
        ...s,
        alert: percent < 75
      };
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    logger.error('Get monthly attendance stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to aggregate monthly stats' });
  }
});

// GET Attendance History for a specific date
router.get('/attendance/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();
    const { date, course_id } = req.query;

    if (!date) {
      res.status(400).json({ success: false, error: 'Date is required' });
      return;
    }

    let query = supabase
      .from('attendance_sessions')
      .select('*, courses(name, code), attendance_records(*, students(name, roll_number))')
      .eq('teacher_id', req.user!.id)
      .eq('date', date);

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('ATTENDANCE_HISTORY_ERROR:', error.message, error.details);
      throw error;
    }

    res.status(200).json({
      success: true,
      data: sessions || []
    });
  } catch (err: any) {
    logger.error('Get attendance history error:', err);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch attendance history: ${err.message || 'Unknown database error'}` 
    });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET Activities for the authenticated teacher
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();
    const courseId = req.query.course_id as string;

    // Aggregate data from all three specialized parent tables
    const [attendanceRes, assignmentsRes, documentTasksRes] = await Promise.all([
      supabase.from('attendance_sessions').select('*, attendance_records(*)'),
      supabase.from('assignments').select('*, assignment_submissions(*)'),
      supabase.from('document_tasks').select('*, document_submissions(*)')
    ]);

    // Map to a common Activity format for the frontend (backward compatible)
    const attendance = (attendanceRes.data || []).map(a => ({ 
      ...a, 
      type: 'attendance', 
      activity_records: a.attendance_records 
    }));
    const assignments = (assignmentsRes.data || []).map(a => ({ 
      ...a, 
      type: 'assignment', 
      activity_records: a.assignment_submissions 
    }));
    const documents = (documentTasksRes.data || []).map(a => ({ 
      ...a, 
      type: 'document', 
      activity_records: a.document_submissions 
    }));

    const activities = [...attendance, ...assignments, ...documents]
      .filter(a => a.teacher_id === req.user!.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.status(200).json({
      success: true,
      data: activities
    });
  } catch (err) {
    logger.error('Get activities error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch activities' });
  }
});

router.post(
  '/',
  authenticate,
  upload.single('questionFile'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, type, date, course_id, records: recordsStr, max_marks, due_date, duration, time_range } = req.body;
      
      const records = JSON.parse(recordsStr || '[]');
      
      if (!title || !type || !course_id) {
        res.status(400).json({ success: false, error: 'Missing required activity fields' });
        return;
      }

      const supabase = getSupabaseAdminClient();
      let questionFileUrl = null;

      // 1. Upload Question file if exists
      if (req.file) {
        try {
          const file = req.file;
          const fileName = `questions/${uuidv4()}.${file.originalname.split('.').pop()}`;
          const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file.buffer);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
          questionFileUrl = publicUrl;
        } catch (uploadErr) {
          logger.error('Question file upload failed:', uploadErr);
        }
      }

      // 2. Determine target table based on type
      let parentTable = '';
      let recordsTable = '';
      let recordForeignKey = '';

      switch (type) {
        case 'attendance':
          parentTable = 'attendance_sessions';
          recordsTable = 'attendance_records';
          recordForeignKey = 'session_id';
          break;
        case 'assignment':
          parentTable = 'assignments';
          recordsTable = 'assignment_submissions';
          recordForeignKey = 'assignment_id';
          break;
        case 'document':
          parentTable = 'document_tasks';
          recordsTable = 'document_submissions';
          recordForeignKey = 'task_id';
          break;
        default:
          res.status(400).json({ success: false, error: 'Invalid activity type' });
          return;
      }

      // 3. Create parent record
      const parentData: any = {
        teacher_id: req.user!.id,
        course_id,
        date: date || new Date().toISOString().split('T')[0],
      };

      // Only add title if it's not attendance (attendance title handled by date or table structure)
      // Actually, we'll keep title for all if the table supports it for better searchability.
      if (title) parentData.title = title;

      if (type === 'attendance') {
        parentData.duration = duration || 60;
        parentData.time_range = time_range || null;
      } else if (type === 'assignment') {
        parentData.max_marks = max_marks || 100;
        parentData.due_date = due_date || null;
        parentData.question_file_url = questionFileUrl;
      } else if (type === 'document') {
        parentData.due_date = due_date || null;
      }

      const { data: activity, error: activityError } = await supabase
        .from(parentTable)
        .insert(parentData)
        .select()
        .single();

      if (activityError) {
        console.error('PARENT_INSERT_ERROR:', activityError.message, activityError.details, 'Payload:', parentData);
        throw activityError;
      }

      // 4. Create child records securely
      const mappedRecords = records.map((r: any) => ({
        [recordForeignKey]: activity.id,
        student_id: r.student_id,
        status: r.status,
        notes: r.notes || null,
        ...(type === 'assignment' ? { marks_attained: r.marks_attained || null, grade: r.grade || null } : {})
      }));

      const { error: recordsError } = await supabase
        .from(recordsTable)
        .insert(mappedRecords);

      if (recordsError) {
        await supabase.from(parentTable).delete().eq('id', activity.id);
        throw recordsError;
      }

      res.status(201).json({
        success: true,
        data: { ...activity, type },
        message: 'Records saved successfully to specialized tables',
      });
  } catch (err: any) {
    logger.error('Create activity error:', err);
    res.status(500).json({ 
      success: false, 
      error: `Failed to save activity records: ${err.message || 'Unknown database error'}` 
    });
  }
});

export default router;
