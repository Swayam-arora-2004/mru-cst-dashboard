import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, ApiResponse } from '../types';
import { getSupabaseAdminClient } from '../lib/supabase';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied. No token provided.',
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        email: string;
        role: string;
      };

      // Verify user still exists in database
      const supabase = getSupabaseAdminClient();
      const { data: user, error } = await supabase
        .from('teachers')
        .select('id, email')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found or session expired.',
        };
        res.status(401).json(response);
        return;
      }

      req.user = decoded;
      next();
    } catch (jwtError) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid or expired token.',
      };
      res.status(401).json(response);
      return;
    }
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Authentication error.',
    };
    res.status(500).json(response);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authenticated.',
      };
      res.status(401).json(response);
      return;
    }

    if (!roles.includes(req.user.role)) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to access this resource.',
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};
