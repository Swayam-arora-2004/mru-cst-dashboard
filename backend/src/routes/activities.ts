import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ApiResponse } from '../types';
import { NotificationService } from '../lib/notifications';
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

    // Create a lookup map for records by session_id to avoid O(N*M) filtering
    const recordsBySession = (records || []).reduce((acc: Record<string, any[]>, record) => {
      if (!acc[record.session_id]) acc[record.session_id] = [];
      acc[record.session_id].push(record);
      return acc;
    }, {});

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

      const sessionRecords = recordsBySession[session.id] || [];
      sessionRecords.forEach(record => {
        if (record.status === 'present') statsMap[courseId].present++;
        else if (record.status === 'absent') statsMap[courseId].absent++;
      });
    });

    // Finalize and check for alerts (e.g., < 75% attendance)
    const result = Object.values(statsMap).map((s: any) => {
      const total = (s.present || 0) + (s.absent || 0);
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
    const { date, course_id, year, semester, class_id, time_range } = req.query;
    
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
    
    if (year) {
      query = query.eq('year', parseInt(year as string));
    }
    
    if (semester) {
      query = query.eq('semester', parseInt(semester as string));
    }
    
    if (class_id) {
      query = query.eq('class_id', class_id);
    }

    if (time_range) {
      query = query.ilike('time_range', `%${time_range}%`);
    }

    if (req.query.specialization && req.query.specialization !== '' && req.query.specialization !== 'General') {
      query = query.or(`specialization.eq.${req.query.specialization},specialization.is.null`);
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
    const { course_id, year, semester, class_id, specialization, type } = req.query as any;

    const buildQuery = (table: string) => {
      let q = supabase.from(table).select('*, ' + (table === 'attendance_sessions' ? 'attendance_records(*)' : table === 'assignments' ? 'assignment_submissions(*)' : 'document_submissions(*)'))
        .eq('teacher_id', req.user!.id);
      
      if (course_id) q = q.eq('course_id', course_id);
      if (year) q = q.eq('year', parseInt(year));
      if (semester) q = q.eq('semester', parseInt(semester));
      if (class_id) q = q.eq('class_id', class_id);
      if (specialization && specialization !== 'General') {
        q = q.or(`specialization.eq.${specialization},specialization.is.null`);
      }
      
      return q.order('created_at', { ascending: false });
    };

    // Aggregate data conditionally based on type, or fetch all if not specified
    const queries = [];
    if (!type || type === 'attendance') queries.push(buildQuery('attendance_sessions'));
    else queries.push(Promise.resolve({ data: [] }));

    if (!type || type === 'assignment') queries.push(buildQuery('assignments'));
    else queries.push(Promise.resolve({ data: [] }));

    if (!type || type === 'document') queries.push(buildQuery('document_tasks'));
    else queries.push(Promise.resolve({ data: [] }));

    const [attendanceRes, assignmentsRes, documentTasksRes] = await Promise.all(queries);

    // Map to a common Activity format (backend handles the merging/sorting)
    const attendance = (attendanceRes.data || []).map((a: any) => ({ 
      ...a, 
      type: 'attendance' as const, 
      activity_records: a.attendance_records 
    }));
    const assignments = (assignmentsRes.data || []).map((a: any) => ({ 
      ...a, 
      type: 'assignment' as const, 
      activity_records: a.assignment_submissions 
    }));
    const documents = (documentTasksRes.data || []).map((a: any) => ({ 
      ...a, 
      type: 'document' as const, 
      activity_records: a.document_submissions 
    }));

    const activities = [...attendance, ...assignments, ...documents]
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
      
      if (!title || !type || (type !== 'document' && !course_id)) {
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
      const { department_id, year, semester, class_id, specialization } = req.body;
      const parentData: any = {
        teacher_id: req.user!.id,
        course_id: type === 'document' ? (course_id || null) : course_id,
        date: date || new Date().toISOString().split('T')[0],
        department_id: department_id || null,
        year: parseInt(year) || null,
        semester: parseInt(semester) || null,
        class_id: class_id || null,
        specialization: specialization || null,
      };

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
        console.error('SPECIFIC_TABLE_INSERT_ERROR:', activityError.message, activityError.details, 'Payload:', parentData);
        throw activityError;
      }

      // 3.5 [MASTER SYNC] Mirror the record in the 'activities' table to satisfy evaluations FK
      const masterActivityData = {
        id: activity.id,
        teacher_id: req.user!.id,
        course_id: parentData.course_id,
        title: parentData.title,
        type: type,
        date: parentData.date,
        max_marks: parentData.max_marks || null,
        due_date: parentData.due_date || null,
        question_file_url: parentData.question_file_url || null
      };

      const { error: masterError } = await supabase
        .from('activities')
        .insert(masterActivityData);

      if (masterError) {
        logger.error('MASTER_ACTIVITY_SYNC_ERROR:', masterError);
        // We warn but don't fail, though it will break evaluations for this activity
      }

      // 🔔 [NOTIFICATION TRIGGER]
      if (type === 'assignment' || type === 'document') {
        (async () => {
          try {
            const { data: students } = await supabase
              .from('students')
              .select('id')
              .eq('class_id', class_id);

            if (students && students.length > 0) {
              const notificationPayload = {
                title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}: ${title}`,
                body: `A new activity has been posted. Due: ${due_date ? new Date(due_date).toLocaleString() : 'No deadline'}.`,
                emailHtml: `
                  <div style="font-family: sans-serif; padding: 20px;">
                    <h2 style="color: #2563eb;">New Academic Activity</h2>
                    <p>Hello Student, a new <strong>${type}</strong> has been assigned to your class.</p>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
                      <p><strong>Title:</strong> ${title}</p>
                      <p><strong>Deadline:</strong> ${due_date ? new Date(due_date).toLocaleString() : 'Flexible'}</p>
                    </div>
                    <p style="margin-top: 20px;">Log in to your dashboard to view details and submit.</p>
                  </div>
                `
              };

              await Promise.allSettled(
                students.map(s => NotificationService.notifyUser(s.id, notificationPayload))
              );
            }
          } catch (nErr) {
            logger.error('NOTIFICATION_DISPATCH_BG_ERROR:', nErr);
          }
        })();
      }

      // 4. Create child records securely - ONLY for attendance
      if (type === 'attendance') {
        const mappedRecords = records.map((r: any) => ({
          [recordForeignKey]: activity.id,
          student_id: r.student_id,
          status: r.status,
          notes: r.notes || null,
          specialization: activity.specialization || null,
        }));

        const { error: recordsError } = await supabase
          .from(recordsTable)
          .insert(mappedRecords);

        if (recordsError) {
          await supabase.from(parentTable).delete().eq('id', activity.id);
          throw recordsError;
        }
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

// UPDATE Activity (Due Dates, Titles, Session Metadata)
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, date, due_date, time_range } = req.body;
    const supabase = getSupabaseAdminClient();

    // 1. Identify activity type and ownership
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .eq('teacher_id', req.user!.id)
      .single();

    if (fetchError || !activity) {
      res.status(404).json({ success: false, error: 'Activity not found or unauthorized' });
      return;
    }

    const type = activity.type;
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (date !== undefined) updateData.date = date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (time_range !== undefined) updateData.time_range = time_range;

    // 2. Synchronized Update: Master & Child Tables
    const parentTableMap: Record<string, string> = {
      'assignment': 'assignments',
      'document': 'document_tasks',
      'attendance': 'attendance_sessions'
    };

    const targetTable = parentTableMap[type];
    
    // We update both in parallel for efficiency
    const [masterUpdate, childUpdate] = await Promise.all([
      supabase.from('activities').update(updateData).eq('id', id),
      targetTable ? supabase.from(targetTable).update(updateData).eq('id', id) : Promise.resolve({ error: null })
    ]);

    if (masterUpdate.error || (childUpdate && childUpdate.error)) {
      throw new Error(masterUpdate.error?.message || (childUpdate.error as any)?.message);
    }

    res.status(200).json({
      success: true,
      data: { ...activity, ...updateData },
      message: 'Activity updated successfully'
    });
  } catch (err: any) {
    logger.error('Update activity error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
