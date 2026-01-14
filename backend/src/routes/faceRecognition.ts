import { Router, Response } from 'express';
import multer from 'multer';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { validateId } from '../middleware/security';
import { AuthRequest, ApiResponse } from '../types';
import logger from '../lib/logger';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Face recognition endpoint - match uploaded image against student database
router.post(
  '/match',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;

      if (!file) {
        const response: ApiResponse = {
          success: false,
          error: 'No image file provided',
        };
        res.status(400).json(response);
        return;
      }

      // Convert image to base64 for processing
      const base64Image = file.buffer.toString('base64');

      const supabase = getSupabaseAdminClient();

      // Get all students with face encodings
      const { data: students, error } = await supabase
        .from('students')
        .select('id, name, roll_number, email, class_id, year, semester, department_id, profile_image_url, face_encoding')
        .not('face_encoding', 'is', null);

      if (error) throw error;

      if (!students || students.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'No students with face data found in database',
        };
        res.status(404).json(response);
        return;
      }

      // Note: Face matching logic would be implemented here
      // For now, we return a placeholder response
      // In production, you would use a face recognition library like face-api.js or call a face recognition API
      
      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Face matching is processed on the client side using face-api.js',
          studentsWithFaces: students.length,
          imageReceived: true,
          imageSize: file.size,
        },
      };
      res.status(200).json(response);
    } catch (error) {
      logger.error('Face match error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to process face match',
      };
      res.status(500).json(response);
    }
  }
);

// Get all students with face encodings for client-side matching
router.get('/encodings', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: students, error } = await supabase
      .from('students')
      .select('id, name, roll_number, face_encoding, profile_image_url')
      .not('face_encoding', 'is', null);

    if (error) throw error;

    const response: ApiResponse = {
      success: true,
      data: students || [],
    };
    res.status(200).json(response);
  } catch (error) {
    logger.error('Get encodings error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch face encodings',
    };
    res.status(500).json(response);
  }
});

// Store face encoding for a student
router.post(
  '/encoding/:studentId',
  authenticate,
  validateId('studentId'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { studentId } = req.params;
      const { encoding } = req.body;

      if (!encoding || !Array.isArray(encoding)) {
        const response: ApiResponse = {
          success: false,
          error: 'Valid face encoding array is required',
        };
        res.status(400).json(response);
        return;
      }

      const supabase = getSupabaseAdminClient();

      const { data: student, error } = await supabase
        .from('students')
        .update({ face_encoding: encoding })
        .eq('id', studentId)
        .select()
        .single();

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        data: student,
        message: 'Face encoding stored successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      logger.error('Store encoding error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to store face encoding',
      };
      res.status(500).json(response);
    }
  }
);

// Delete face encoding for a student
router.delete(
  '/encoding/:studentId',
  authenticate,
  validateId('studentId'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { studentId } = req.params;
      const supabase = getSupabaseAdminClient();

      const { error } = await supabase
        .from('students')
        .update({ face_encoding: null })
        .eq('id', studentId);

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        message: 'Face encoding deleted successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      logger.error('Delete encoding error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete face encoding',
      };
      res.status(500).json(response);
    }
  }
);

export default router;
