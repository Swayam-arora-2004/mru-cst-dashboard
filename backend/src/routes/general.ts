import { Router, Response } from 'express';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ApiResponse } from '../types';

const router = Router();

// Get all departments
router.get('/departments', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      data: departments || [],
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Get departments error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch departments',
    };
    res.status(500).json(response);
  }
});

// Create department
router.post('/departments', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, name } = req.body;

    if (!code || !name) {
      const response: ApiResponse = {
        success: false,
        error: 'Code and name are required',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    const { data: department, error } = await supabase
      .from('departments')
      .insert({ code, name })
      .select()
      .single();

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      data: department,
      message: 'Department created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Create department error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create department',
    };
    res.status(500).json(response);
  }
});

// Get all classes
router.get('/classes', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.query.department_id as string;
    const year = req.query.year as string;
    const semester = req.query.semester as string;

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('classes')
      .select('*, departments(*)');

    if (departmentId) query = query.eq('department_id', departmentId);
    if (year) query = query.eq('year', parseInt(year));
    if (semester) query = query.eq('semester', parseInt(semester));

    const { data: classes, error } = await query.order('name');

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      data: classes || [],
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Get classes error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch classes',
    };
    res.status(500).json(response);
  }
});

// Create class
router.post('/classes', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, year, semester, department_id, specialization } = req.body;

    if (!name || !year || !semester || !department_id) {
      const response: ApiResponse = {
        success: false,
        error: 'Name, year, semester, and department_id are required',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    const { data: classData, error } = await supabase
      .from('classes')
      .insert({ name, year, semester, department_id, specialization })
      .select('*, departments(*)')
      .single();

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      data: classData,
      message: 'Class created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Create class error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create class',
    };
    res.status(500).json(response);
  }
});

// Get years and semesters
router.get('/academic-info', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();

    // Get unique years
    const { data: yearsData } = await supabase
      .from('classes')
      .select('year')
      .order('year');

    const years = [...new Set(yearsData?.map((y) => y.year) || [])];

    // Get unique semesters
    const { data: semestersData } = await supabase
      .from('classes')
      .select('semester')
      .order('semester');

    const semesters = [...new Set(semestersData?.map((s) => s.semester) || [])];

    // Get specializations
    const { data: specData } = await supabase
      .from('classes')
      .select('specialization')
      .not('specialization', 'is', null);

    const specializations = [...new Set(specData?.map((s) => s.specialization).filter(Boolean) || [])];

    const response: ApiResponse = {
      success: true,
      data: {
        years: years.length > 0 ? years : [1, 2, 3, 4],
        semesters: semesters.length > 0 ? semesters : [1, 2, 3, 4, 5, 6, 7, 8],
        specializations,
      },
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Get academic info error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch academic info',
    };
    res.status(500).json(response);
  }
});

// Dashboard stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();

    // Get counts
    const [studentsResult, coursesResult, departmentsResult, classesResult] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('departments').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
    ]);

    // Get recent students
    const { data: recentStudents } = await supabase
      .from('students')
      .select('id, name, roll_number, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent courses
    const { data: recentCourses } = await supabase
      .from('courses')
      .select('id, code, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const response: ApiResponse = {
      success: true,
      data: {
        counts: {
          students: studentsResult.count || 0,
          courses: coursesResult.count || 0,
          departments: departmentsResult.count || 0,
          classes: classesResult.count || 0,
        },
        recentStudents: recentStudents || [],
        recentCourses: recentCourses || [],
      },
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Get stats error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch dashboard stats',
    };
    res.status(500).json(response);
  }
});

// System info
router.get('/system-info', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();

    // Get stats for quick stats section
    const [studentsResult, coursesResult, departmentsResult, classesResult] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('departments').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
    ]);

    // Check service connections
    let supabaseConnected = false;
    let geminiConnected = false;

    try {
      // Test Supabase connection
      const { error: supabaseError } = await supabase
        .from('departments')
        .select('id')
        .limit(1);
      supabaseConnected = !supabaseError;
    } catch {
      supabaseConnected = false;
    }

    // Check if Gemini API key is configured
    geminiConnected = !!process.env.GEMINI_API_KEY;

    const response: ApiResponse = {
      success: true,
      data: {
        application: {
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          frontend: {
            framework: 'Next.js',
            version: '16.1.1',
          },
          database: {
            type: 'Supabase',
            engine: 'PostgreSQL',
          },
        },
        services: {
          supabase: {
            name: 'Supabase',
            description: 'Database & Authentication',
            connected: supabaseConnected,
          },
          gemini: {
            name: 'Google Gemini',
            description: 'AI Course Code Generation',
            connected: geminiConnected,
          },
        },
        stats: {
          students: studentsResult.count || 0,
          courses: coursesResult.count || 0,
          departments: departmentsResult.count || 0,
          classes: classesResult.count || 0,
        },
      },
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Get system info error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch system information',
    };
    res.status(500).json(response);
  }
});

export default router;
