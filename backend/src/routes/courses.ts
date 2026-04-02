import { Router, Response } from 'express';
import { getSupabaseAdminClient } from '../lib/supabase';
import { generateCourseCodeSuggestions, validateCourseCode } from '../lib/gemini';
import { authenticate } from '../middleware/auth';
import { validateId } from '../middleware/security';
import { AuthRequest, ApiResponse, PaginatedResponse, Course, CourseCodeParams } from '../types';
import logger from '../lib/logger';

const router = Router();

// Get all courses with pagination and filters
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const type = req.query.type as string;
    const departmentId = req.query.department_id as string;
    const semester = req.query.semester as string;
    const year = req.query.year as string;
    const isActive = req.query.is_active as string;

    const offset = (page - 1) * limit;
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('courses')
      .select('*, departments(*)', { count: 'exact' });

    // Apply strict isolation: 
    // Non-admin users only see courses where they are the assigned teacher.
    if (req.user?.role !== 'admin') {
      query = query.eq('teacher_id', req.user!.id);
    }
    
    // Additional filters
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }
    if (type) query = query.eq('type', type);
    if (departmentId) query = query.eq('department_id', departmentId);
    if (year) query = query.eq('year', parseInt(year));
    if (semester) query = query.eq('semester', parseInt(semester));
    if (isActive !== undefined) query = query.eq('is_active', isActive === 'true');

    logger.info(`Fetching courses with filters: teacher=${req.user!.id}, dept=${departmentId}, year=${year}, sem=${semester}`);

    const { data: courses, count, error } = await query
      .order('code')
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const response: PaginatedResponse<Course> = {
      success: true,
      data: courses || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get courses error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch courses',
    };
    res.status(500).json(response);
  }
});

// Get all course codes (for validation)
router.get('/codes', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: courses, error } = await supabase
      .from('courses')
      .select('code')
      .eq('teacher_id', req.user!.id);

    if (error) throw error;

    const codes = courses?.map((c) => c.code) || [];

    const response: ApiResponse<string[]> = {
      success: true,
      data: codes,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get course codes error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch course codes',
    };
    res.status(500).json(response);
  }
});

// Generate course code suggestions
router.post('/generate-code', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const params: CourseCodeParams = req.body;

    if (!params.department || !params.type || !params.semester) {
      const response: ApiResponse = {
        success: false,
        error: 'Department, type, and semester are required',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Get existing course codes
    const { data: courses, error } = await supabase
      .from('courses')
      .select('code')
      .eq('teacher_id', req.user!.id);

    if (error) throw error;

    const existingCodes = courses?.map((c) => c.code) || [];
    const suggestions = await generateCourseCodeSuggestions(params, existingCodes);

    const response: ApiResponse = {
      success: true,
      data: suggestions,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Generate code error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to generate course codes',
    };
    res.status(500).json(response);
  }
});

// Validate course code
router.post('/validate-code', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      const response: ApiResponse = {
        success: false,
        error: 'Course code is required',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Get existing course codes
    const { data: courses, error } = await supabase
      .from('courses')
      .select('code')
      .eq('teacher_id', req.user!.id);

    if (error) throw error;

    const existingCodes = courses?.map((c) => c.code) || [];
    const validation = await validateCourseCode(code, existingCodes);

    const response: ApiResponse = {
      success: true,
      data: validation,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Validate code error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to validate course code',
    };
    res.status(500).json(response);
  }
});

// Get single course
router.get('/:id', authenticate, validateId('id'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdminClient();

    const { data: course, error } = await supabase
      .from('courses')
      .select('*, departments(*)')
      .eq('id', id)
      .eq('teacher_id', req.user!.id)
      .single();

    if (error || !course) {
      const response: ApiResponse = {
        success: false,
        error: 'Course not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Course> = {
      success: true,
      data: course,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get course error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch course',
    };
    res.status(500).json(response);
  }
});

// Get course by code
router.get('/code/:code', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const supabase = getSupabaseAdminClient();

    const { data: course, error } = await supabase
      .from('courses')
      .select('*, departments(*)')
      .eq('code', code)
      .eq('teacher_id', req.user!.id)
      .single();

    if (error || !course) {
      const response: ApiResponse = {
        success: false,
        error: 'Course not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Course> = {
      success: true,
      data: course,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get course by code error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch course',
    };
    res.status(500).json(response);
  }
});

// Create new course
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, name, description, credits, type, department_id, semester, year, class_id } = req.body;

    if (!code || !name || !type || !department_id || !semester || !year) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('code', code)
      .eq('teacher_id', req.user!.id)
      .single();

    if (existing) {
      const response: ApiResponse = {
        success: false,
        error: 'Course code already exists',
      };
      res.status(400).json(response);
      return;
    }

    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        code,
        name,
        description,
        credits: credits || 3,
        type,
        department_id,
        semester,
        year,
        class_id,
        teacher_id: req.user!.id,
        is_active: true,
      })
      .select('*, departments(*)')
      .single();

    if (error) throw error;

    const response: ApiResponse<Course> = {
      success: true,
      data: course,
      message: 'Course created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Create course error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create course',
    };
    res.status(500).json(response);
  }
});

// Update course
router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    delete updateData.id;
    delete updateData.created_at;
    updateData.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();

    // Check for duplicate code if code is being updated
    if (updateData.code) {
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('code', updateData.code)
        .eq('teacher_id', req.user!.id)
        .neq('id', id)
        .single();

      if (existing) {
        const response: ApiResponse = {
          success: false,
          error: 'Course code already exists',
        };
        res.status(400).json(response);
        return;
      }
    }

    const { data: course, error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', id)
      .eq('teacher_id', req.user!.id)
      .select('*, departments(*)')
      .single();

    if (error) throw error;

    const response: ApiResponse<Course> = {
      success: true,
      data: course,
      message: 'Course updated successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Update course error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update course',
    };
    res.status(500).json(response);
  }
});

// Delete course
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
      .eq('teacher_id', req.user!.id);

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      message: 'Course deleted successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Delete course error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete course',
    };
    res.status(500).json(response);
  }
});

export default router;
