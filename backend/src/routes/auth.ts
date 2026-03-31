import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { getSupabaseAdminClient } from '../lib/supabase';
import { ApiResponse, AuthRequest } from '../types';
import { validate } from '../middleware/validate';
import { 
  registerSchema, 
  loginSchema, 
  updateProfileSchema, 
  changePasswordSchema, 
  updatePreferencesSchema 
} from '../schemas';
import { asyncHandler } from '../middleware/asyncHandler';
import { trackLoginAttempts, recordLoginAttempt } from '../middleware/security';
import { authenticate } from '../middleware/auth';
import logger from '../lib/logger';
import rateLimit from 'express-rate-limit';

const router = Router();

// Stricter rate limiting for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

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

// Register new teacher
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, phone, department_id, designation, specialization } = req.body;

    const supabase = getSupabaseAdminClient();

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('teachers')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      const response: ApiResponse = {
        success: false,
        error: 'Email already registered',
      };
      res.status(400).json(response);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const { data: newUser, error } = await supabase
      .from('teachers')
      .insert({
        name,
        email,
        password: hashedPassword,
        phone,
        department_id,
        designation: designation || 'Teacher',
        specialization,
      })
      .select('id, name, email, designation, profile_image_url')
      .single();

    if (error) {
      throw error;
    }

    // Generate JWT
    const signOptions: SignOptions = {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: 'teacher' },
      config.jwt.secret,
      signOptions
    );

    const response: ApiResponse = {
      success: true,
      data: {
        user: newUser,
        token,
      },
      message: 'Registration successful',
    };
    res.status(201).json(response);
  })
);

// Login
router.post(
  '/login',
  authLimiter,
  trackLoginAttempts(config.security.maxLoginAttempts, config.security.lockoutDuration),
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const identifier = email || req.ip || 'unknown';

    const supabase = getSupabaseAdminClient();

    // Find user
    const { data: user, error } = await supabase
      .from('teachers')
      .select('id, name, email, password, phone, designation, department_id, specialization, profile_image_url')
      .eq('email', email)
      .single();

    if (error || !user) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid credentials',
      };
      res.status(401).json(response);
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordLoginAttempt(identifier, false);
      const response: ApiResponse = {
        success: false,
        error: 'Invalid email or password',
      };
      res.status(401).json(response);
      return;
    }

    // Successful login - clear attempts
    recordLoginAttempt(identifier, true);

    // Generate JWT
    const signOptions: SignOptions = {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'teacher' },
      config.jwt.secret,
      signOptions
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    const response: ApiResponse = {
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
      message: 'Login successful',
    };
    res.status(200).json(response);
  })
);

// Verify token
router.get(
  '/verify',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: 'No token provided',
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { id: string };

      const supabase = getSupabaseAdminClient();
      const { data: user, error } = await supabase
        .from('teachers')
        .select('id, name, email, phone, designation, department_id, specialization, profile_image_url')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found',
        };
        res.status(401).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { user },
      };
      res.status(200).json(response);
    } catch {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid token',
      };
      res.status(401).json(response);
    }
  })
);

// Get user profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const supabase = getSupabaseAdminClient();
    const { data: user, error } = await supabase
      .from('teachers')
      .select('id, name, email, phone, designation, department_id, specialization, profile_image_url, created_at, updated_at')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: { user },
    };
    res.status(200).json(response);
  })
);

// Update user profile
router.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { name, phone, designation, department_id } = req.body;
    const supabase = getSupabaseAdminClient();

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (designation) updateData.designation = designation;
    if (department_id) updateData.department_id = department_id;

    const { data: updatedUser, error } = await supabase
      .from('teachers')
      .update(updateData)
      .eq('id', req.user!.id)
      .select('id, name, email, phone, designation, department_id, profile_image_url')
      .single();

    if (error) {
      throw error;
    }

    const response: ApiResponse = {
      success: true,
      data: { user: updatedUser },
      message: 'Profile updated successfully',
    };
    res.status(200).json(response);
  })
);

// Change password
router.put(
  '/password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const supabase = getSupabaseAdminClient();

    // Get current user with password
    const { data: user, error } = await supabase
      .from('teachers')
      .select('id, password')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      const response: ApiResponse = {
        success: false,
        error: 'Current password is incorrect',
      };
      res.status(401).json(response);
      return;
    }

    // Hash new password
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    const { error: updateError } = await supabase
      .from('teachers')
      .update({ password: hashedPassword })
      .eq('id', req.user!.id);

    if (updateError) {
      throw updateError;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully',
    };
    res.status(200).json(response);
  })
);

// Get user preferences
router.get(
  '/preferences',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const supabase = getSupabaseAdminClient();
    
    // Check if preferences table exists, if not return default values
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.user!.id)
      .single();

    if (error) {
      // Return default preferences if none exist
      const defaultPreferences = {
        emailNotifications: true,
        pushNotifications: true,
        weeklyReport: true,
        theme: 'system',
      };
      
      const response: ApiResponse = {
        success: true,
        data: { preferences: defaultPreferences },
      };
      res.status(200).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: { preferences },
    };
    res.status(200).json(response);
  })
);

// Update user preferences
router.put(
  '/preferences',
  authenticate,
  validate(updatePreferencesSchema),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { emailNotifications, pushNotifications, weeklyReport, theme } = req.body;
    const supabase = getSupabaseAdminClient();

    const updateData: Record<string, unknown> = {};
    if (emailNotifications !== undefined) updateData.email_notifications = emailNotifications;
    if (pushNotifications !== undefined) updateData.push_notifications = pushNotifications;
    if (weeklyReport !== undefined) updateData.weekly_report = weeklyReport;
    if (theme) updateData.theme = theme;

    // Try to update existing preferences
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    let updatedPreferences;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('user_preferences')
        .update(updateData)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error) throw error;
      updatedPreferences = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: req.user!.id,
          ...updateData,
        })
        .select()
        .single();

      if (error) throw error;
      updatedPreferences = data;
    }

    const response: ApiResponse = {
      success: true,
      data: { preferences: updatedPreferences },
      message: 'Preferences updated successfully',
    };
    res.status(200).json(response);
  })
);

// Upload avatar
router.post(
  '/avatar',
  authenticate,
  upload.single('avatar'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        error: 'No image provided',
      };
      res.status(400).json(response);
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Resize and optimize image
    const buffer = await sharp(req.file.buffer)
      .rotate()
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const path = `avatars/${req.user!.id}/${uuidv4()}.jpg`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(path);

    // Update teacher profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('teachers')
      .update({ profile_image_url: publicUrl })
      .eq('id', req.user!.id)
      .select('id, name, email, phone, designation, department_id, profile_image_url')
      .single();

    if (updateError) {
      throw updateError;
    }

    const response: ApiResponse = {
      success: true,
      data: { user: updatedUser },
      message: 'Avatar updated successfully',
    };
    res.status(200).json(response);
  })
);

export default router;
