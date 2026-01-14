import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { validateId } from '../middleware/security';
import { AuthRequest, ApiResponse, PaginatedResponse, Student } from '../types';
import { config } from '../config';
import logger from '../lib/logger';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed.'));
    }
  },
});

// Get all students with pagination and filters
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const classId = req.query.class_id as string;
    const year = req.query.year as string;
    const departmentId = req.query.department_id as string;

    const offset = (page - 1) * limit;
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('students')
      .select('*, classes(*), departments(*)', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,roll_number.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (classId) query = query.eq('class_id', classId);
    if (year) query = query.eq('year', parseInt(year));
    if (departmentId) query = query.eq('department_id', departmentId);

    const { data: students, count, error } = await query
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const response: PaginatedResponse<Student> = {
      success: true,
      data: students || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get students error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch students',
    };
    res.status(500).json(response);
  }
});

// Get single student by ID
router.get('/:id', authenticate, validateId('id'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdminClient();

    const { data: student, error } = await supabase
      .from('students')
      .select('*, classes(*), departments(*)')
      .eq('id', id)
      .single();

    if (error || !student) {
      const response: ApiResponse = {
        success: false,
        error: 'Student not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Student> = {
      success: true,
      data: student,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get student error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch student',
    };
    res.status(500).json(response);
  }
});

// Search student by roll number
router.get('/roll/:rollNumber', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rollNumber } = req.params;
    const supabase = getSupabaseAdminClient();

    const { data: student, error } = await supabase
      .from('students')
      .select('*, classes(*), departments(*)')
      .eq('roll_number', rollNumber)
      .single();

    if (error || !student) {
      const response: ApiResponse = {
        success: false,
        error: 'Student not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Student> = {
      success: true,
      data: student,
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get student by roll error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch student',
    };
    res.status(500).json(response);
  }
});

// Create new student
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      roll_number,
      name,
      email,
      phone,
      class_id,
      year,
      semester,
      department_id,
      specialization,
    } = req.body;

    if (!roll_number || !name || !email || !class_id || !year || !semester || !department_id) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Check for duplicate roll number
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('roll_number', roll_number)
      .single();

    if (existing) {
      const response: ApiResponse = {
        success: false,
        error: 'Roll number already exists',
      };
      res.status(400).json(response);
      return;
    }

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        roll_number,
        name,
        email,
        phone,
        class_id,
        year,
        semester,
        department_id,
        specialization,
      })
      .select('*, classes(*), departments(*)')
      .single();

    if (error) throw error;

    const response: ApiResponse<Student> = {
      success: true,
      data: student,
      message: 'Student created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Create student error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create student',
    };
    res.status(500).json(response);
  }
});

// Update student
router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    delete updateData.id;
    delete updateData.created_at;
    updateData.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();

    const { data: student, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select('*, classes(*), departments(*)')
      .single();

    if (error) throw error;

    const response: ApiResponse<Student> = {
      success: true,
      data: student,
      message: 'Student updated successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Update student error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update student',
    };
    res.status(500).json(response);
  }
});

// Upload student image
router.post(
  '/:id/image',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        const response: ApiResponse = {
          success: false,
          error: 'No image file provided',
        };
        res.status(400).json(response);
        return;
      }

      const supabase = getSupabaseAdminClient();

      // Resize and optimize image
      const optimizedBuffer = await sharp(file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload to Supabase Storage
      const fileName = `students/${id}/${uuidv4()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, optimizedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      // Update student record
      const { data: student, error } = await supabase
        .from('students')
        .update({ profile_image_url: publicUrl })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        data: { imageUrl: publicUrl, student },
        message: 'Image uploaded successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      logger.error('Upload image error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to upload image',
      };
      res.status(500).json(response);
    }
  }
);

// Delete student
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      message: 'Student deleted successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Delete student error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete student',
    };
    res.status(500).json(response);
  }
});

export default router;
