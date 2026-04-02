import { Router, Response } from 'express';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { validateId } from '../middleware/security';
import { AuthRequest, ApiResponse, PaginatedResponse, Student } from '../types';
import { config } from '../config';
import logger from '../lib/logger';
import { detectAndEncode, isModelsLoaded, loadModels } from '../lib/faceRecognition';

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

// Render/free instances have limited memory; keep bulk photo batches small.
const bulkPhotoUpload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize, files: 10 },
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
    const semester = req.query.semester as string;
    const departmentId = req.query.department_id as string;
    const specialization = req.query.specialization as string;

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
    if (semester) query = query.eq('semester', parseInt(semester));
    if (departmentId) query = query.eq('department_id', departmentId);
    if (specialization) query = query.eq('specialization', specialization);

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

      console.log(`[Upload] Starting image processing for student ${req.params.id}...`);
      const supabase = getSupabaseAdminClient();

      console.log(`[Upload] Resizing image with sharp (aspect-ratio preserved)...`);
      const buffer = await sharp(req.file.buffer)
        .rotate() // Auto-rotate based on EXIF so iPhone faces aren't sideways
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const path = `students/${req.params.id}/${uuidv4()}.jpg`;

      console.log(`[Upload] Uploading to Supabase storage...`);
      await supabase.storage.from('images').upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      console.log(`[Upload] Supabase upload complete!`);

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(path);

      // Revert completely to lightning-fast Client-Side encoding ingestion!
      let faceEncoding: number[] | null = null;
      if (req.body.face_encoding) {
        try {
          console.log(`[Upload] Receiving pre-compiled face encoding securely from Client GPU!`);
          faceEncoding = JSON.parse(req.body.face_encoding);
        } catch (parseErr) {
          console.warn(`[Upload] Failed to parse face encoding array from client string:`, parseErr);
        }
      }

      console.log(`[Upload] Updating database record...`);

      const updateData: Record<string, unknown> = { profile_image_url: publicUrl };
      if (faceEncoding) {
        updateData.face_encoding = faceEncoding;
      }

      const { data, error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', req.params.id)
        .eq('teacher_id', req.user!.id) // 🔑 ISOLATION
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        data,
        message: faceEncoding
          ? 'Image uploaded and face encoding saved successfully'
          : `Image uploaded successfully but AI Failed (Check backend/face_debug.log)`,
      });
    } catch (error) {
      logger.error('Upload image error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload image' });
    }
  }
);

/* =========================
   BULK CREATE STUDENTS
========================= */

router.post('/bulk', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const students = req.body.students;

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ success: false, error: 'Multiple student records required' });
      return;
    }

    const supabase = getSupabaseAdminClient();

    // 1. Fetch lookup maps for Classes and Departments to map names to IDs
    const [{ data: classes }, { data: depts }] = await Promise.all([
      supabase.from('classes').select('id, name'),
      supabase.from('departments').select('id, name')
    ]);

    const classMap = new Map((classes || []).map(c => [c.name.toLowerCase(), c.id]));
    const deptMap = new Map((depts || []).map(d => [d.name.toLowerCase(), d.id]));

    // Helper to transform common cloud share links to direct download links
    const toDirectImageUrl = (url: string) => {
      if (!url || typeof url !== 'string') return url;
      
      const trimmedUrl = url.trim();
      
      // Google Drive Handler
      if (trimmedUrl.includes('drive.google.com')) {
        const fileIdMatch = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        }
      }
      
      // Dropbox Handler (Convert dl=0 to dl=1 for direct download)
      if (trimmedUrl.includes('dropbox.com')) {
        return trimmedUrl.replace(/\?dl=0$/, '?dl=1').replace(/&dl=0$/, '&dl=1');
      }
      
      return trimmedUrl;
    };

    // Helper to find Class ID by name with common variations
    const findClassId = (name: string) => {
      if (!name) return null;
      const normalized = name.toLowerCase().trim();
      if (classMap.has(normalized)) return classMap.get(normalized);
      
      // Try common prefixes
      if (classMap.has(`section ${normalized}`)) return classMap.get(`section ${normalized}`);
      if (classMap.has(`class ${normalized}`)) return classMap.get(`class ${normalized}`);
      
      // Fuzzy match (contains)
      for (const [className, id] of classMap.entries()) {
        if (className.includes(normalized)) return id;
      }
      return null;
    };

    // Helper to find Department ID by name with fuzzy matching
    const findDeptId = (name: string) => {
      if (!name) return null;
      const normalized = name.toLowerCase().trim();
      
      // Try EXACT match first to avoid "Computer Science" matching "Computer Science (Specialization)"
      if (deptMap.has(normalized)) return deptMap.get(normalized);
      
      // Try fuzzy match if no exact match found
      for (const [deptName, id] of deptMap.entries()) {
        if (deptName.includes(normalized) || normalized.includes(deptName)) return id;
      }
      return null;
    };

    // 2. Map and Validate records
    const uniqueStudentsMap = new Map();
    
    students.forEach((s: any) => {
      const roll = s.roll_number?.toString().trim();
      if (!roll) return;
      
      uniqueStudentsMap.set(roll, {
        teacher_id: req.user!.id,
        roll_number: roll,
        name: s.name,
        email: s.email,
        phone: s.phone || null,
        class_id: s.class_id || findClassId(s.class_name),
        department_id: s.department_id || findDeptId(s.department_name),
        year: parseInt(s.year) || null,
        semester: parseInt(s.semester) || null,
        profile_image_url: toDirectImageUrl(s.photos || s.profile_image_url || null),
        specialization:
          typeof s.specialization === 'string' && s.specialization.trim().length > 0
            ? s.specialization.trim()
            : 'N/A'
      });
    });

    const mappedStudents = Array.from(uniqueStudentsMap.values());

    // 3. Perform bulk upsert (Update if exists, Insert if new)
    const { data, error } = await supabase
      .from('students')
      .upsert(mappedStudents, { onConflict: 'roll_number' })
      .select();

    if (error) {
      console.error('BULK_INSERT_ERROR:', error.message, error.details);
      throw error;
    }

    // 4. Background Face Encoding Processing
    // We do this after response to avoid timeout, but we use Promise.all to track briefly
    const studentsWithImages = mappedStudents.filter(s => s.profile_image_url);
    if (studentsWithImages.length > 0) {
      // Create a background task
      (async () => {
        try {
          if (!isModelsLoaded()) await loadModels();
          
          for (const student of studentsWithImages) {
            try {
              // Fetch image
              const response = await fetch(student.profile_image_url);
              if (!response.ok) continue;
              
              const buffer = Buffer.from(await response.arrayBuffer());
              const encoding = await detectAndEncode(buffer);
              
              if (encoding) {
                await supabase
                  .from('students')
                  .update({ face_encoding: Array.from(encoding) })
                  .eq('roll_number', student.roll_number);
              }
            } catch (err) {
              logger.error(`Failed to encode face for ${student.roll_number}:`, err);
            }
          }
        } catch (err) {
          logger.error('Background AI processing error:', err);
        }
      })();
    }

    res.status(201).json({
      success: true,
      data,
      message: `Successfully imported ${data.length} students. AI face processing started in the background.`
    });
  } catch (error: any) {
    logger.error('Bulk create students error:', error);
    res.status(500).json({ 
      success: false, 
      error: `Bulk import failed: ${error.message || 'Database rejection'}` 
    });
  }
});

/* =========================
   BULK PHOTO UPLOAD
========================= */

router.post('/bulk-photos', authenticate, bulkPhotoUpload.array('photos', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'No photo files provided' });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const results = {
      successCount: 0,
      failCount: 0,
      errors: [] as string[]
    };

    for (const file of files) {
      try {
        // 1. Extract Roll Number from filename (e.g., "2K22CSUN01001.jpg" -> "2K22CSUN01001")
        const rollNumber = path.parse(file.originalname).name.trim();
        
        // 2. Find student
        const { data: student, error: findError } = await supabase
          .from('students')
          .select('id, name')
          .eq('roll_number', rollNumber)
          .eq('teacher_id', req.user!.id)
          .single();

        if (findError || !student) {
          results.failCount++;
          results.errors.push(`Student not found for roll number: ${rollNumber}`);
          continue;
        }

        // 3. Upload to Storage
        const fileExt = path.extname(file.originalname);
        const fileName = `${student.id}_${Date.now()}${fileExt}`;
        const filePath = `${req.user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('student-photos')
          .getPublicUrl(filePath);

        // 4. Update Student (image upload only for production stability)
        const { error: updateError } = await supabase
          .from('students')
          .update({
            profile_image_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', student.id);

        if (updateError) throw updateError;
        
        results.successCount++;
      } catch (err: any) {
        results.failCount++;
        results.errors.push(`Error processing ${file.originalname}: ${err.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${files.length} photos. ${results.successCount} succeeded, ${results.failCount} failed. Face encodings were skipped to prevent server restarts on low-memory hosting.`,
      results
    });
  } catch (error: any) {
    logger.error('Bulk photo upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
