import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Student {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  phone?: string;
  class_id: string;
  year: number;
  semester: number;
  department_id: string;
  specialization?: string;
  face_encoding?: number[];
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department_id: string;
  designation: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  type: 'lecture' | 'tutorial' | 'lab' | 'mooc' | 'elective';
  department_id: string;
  teacher_id: string;
  semester: number;
  year: number;
  class_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  year: number;
  semester: number;
  department_id: string;
  specialization?: string;
  created_at: string;
}

export interface CourseCodeParams {
  department: string;
  type: 'lecture' | 'tutorial' | 'lab' | 'mooc' | 'elective';
  semester: number;
  year?: number;
  specialization?: string;
}

export type AsyncHandler = (
  req: Request | AuthRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;
