import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { getSupabaseAdminClient } from '../lib/supabase';
import { ApiResponse } from '../types';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Register new teacher
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, phone, department_id, designation } = req.body;

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
    const salt = await bcrypt.genSalt(12);
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
      })
      .select('id, name, email, designation')
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
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const supabase = getSupabaseAdminClient();

    // Find user
    const { data: user, error } = await supabase
      .from('teachers')
      .select('id, name, email, password, designation, department_id')
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
      const response: ApiResponse = {
        success: false,
        error: 'Invalid credentials',
      };
      res.status(401).json(response);
      return;
    }

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
        .select('id, name, email, designation, department_id')
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

export default router;
