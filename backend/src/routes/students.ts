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

/* =========================
   MULTER CONFIG
========================= */

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF allowed.'));
    }
  },
});

/* =========================
   GET ALL STUDENTS (PAGINATED)
========================= */

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const search = req.query.search as string;
    const classId = req.query.class_id as string;
    const year = req.query.year as string;
    const departmentId = req.query.department_id as string;

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('students')
      .select('*, classes(*), departments(*)', { count: 'exact' })
      .eq('teacher_id', req.user!.id); // 🔑 ISOLATION

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,roll_number.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (classId) query = query.eq('class_id', classId);
    if (year) query = query.eq('year', parseInt(year));
    if (departmentId) query = query.eq('department_id', departmentId);

    const { data, count, error } = await query
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const response: PaginatedResponse<Student> = {
      success: true,
      data: data || [],
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
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

/* =========================
   GET STUDENT BY ID
========================= */

router.get('/:id', authenticate, validateId('id'), async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('students')
      .select('*, classes(*), departments(*)')
      .eq('id', req.params.id)
      .eq('teacher_id', req.user!.id) // 🔑 ISOLATION
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Get student error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch student' });
  }
});

/* =========================
   GET STUDENT BY ROLL NUMBER
========================= */

router.get('/roll/:rollNumber', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('students')
      .select('*, classes(*), departments(*)')
      .eq('roll_number', req.params.rollNumber)
      .eq('teacher_id', req.user!.id) // 🔑 ISOLATION
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Get student by roll error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch student' });
  }
});

/* =========================
   CREATE STUDENT
========================= */

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
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
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
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
        teacher_id: req.user!.id, // 🔑 OWNER SET HERE
      })
      .select('*, classes(*), departments(*)')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Student created successfully',
    });
  } catch (error) {
    logger.error('Create student error:', error);
    res.status(500).json({ success: false, error: 'Failed to create student' });
  }
});

/* =========================
   UPDATE STUDENT
========================= */

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const updateData = req.body;
    delete updateData.id;
    delete updateData.teacher_id;
    updateData.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('teacher_id', req.user!.id) // 🔑 ISOLATION
      .select('*, classes(*), departments(*)')
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data,
      message: 'Student updated successfully',
    });
  } catch (error) {
    logger.error('Update student error:', error);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

/* =========================
   UPLOAD STUDENT IMAGE
========================= */

router.post(
  '/:id/image',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image provided' });
        return;
      }

      const supabase = getSupabaseAdminClient();

      const buffer = await sharp(req.file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const path = `students/${req.params.id}/${uuidv4()}.jpg`;

      await supabase.storage.from('images').upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(path);

      const { data, error } = await supabase
        .from('students')
        .update({ profile_image_url: publicUrl })
        .eq('id', req.params.id)
        .eq('teacher_id', req.user!.id) // 🔑 ISOLATION
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        data,
        message: 'Image uploaded successfully',
      });
    } catch (error) {
      logger.error('Upload image error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload image' });
    }
  }
);

/* =========================
   DELETE STUDENT
========================= */

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', req.params.id)
      .eq('teacher_id', req.user!.id); // 🔑 ISOLATION

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (error) {
    logger.error('Delete student error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});

export default router;
