import { z } from 'zod';

// ============ Auth Schemas ============

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    phone: z.string().optional(),
    department_id: z.string().uuid().optional(),
    designation: z.string().optional(),
    specialization: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(255).optional(),
    phone: z.string().optional(),
    designation: z.string().optional(),
    department_id: z.string().uuid('Invalid department ID').optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
  }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }),
});

// ============ Student Schemas ============

export const createStudentSchema = z.object({
  body: z.object({
    roll_number: z.string().min(1, 'Roll number is required').max(50),
    name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    email: z.string().email('Invalid email format'),
    phone: z.string().optional(),
    class_id: z.string().uuid('Invalid class ID'),
    year: z.number().int().min(1).max(6),
    semester: z.number().int().min(1).max(12),
    department_id: z.string().uuid('Invalid department ID'),
    specialization: z.string().optional(),
  }),
});

export const updateStudentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid student ID'),
  }),
  body: z.object({
    roll_number: z.string().min(1).max(50).optional(),
    name: z.string().min(2).max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    class_id: z.string().uuid().optional(),
    year: z.number().int().min(1).max(6).optional(),
    semester: z.number().int().min(1).max(12).optional(),
    department_id: z.string().uuid().optional(),
    specialization: z.string().optional(),
  }),
});

export const studentQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
    department_id: z.string().uuid().optional(),
    class_id: z.string().uuid().optional(),
    year: z.string().regex(/^\d+$/).optional(),
  }),
});

// ============ Course Schemas ============

export const createCourseSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(50)
      .transform((val) => val.toUpperCase()),
    name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    description: z.string().optional(),
    credits: z.number().int().min(1).max(10).default(3),
    type: z.enum(['lecture', 'tutorial', 'lab', 'mooc', 'elective']),
    department_id: z.string().uuid('Invalid department ID'),
    semester: z.number().int().min(1).max(12),
    is_active: z.boolean().default(true),
  }),
});

export const updateCourseSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid course ID'),
  }),
  body: z.object({
    code: z.string().min(3).max(50).transform((val) => val.toUpperCase()).optional(),
    name: z.string().min(2).max(255).optional(),
    description: z.string().optional(),
    credits: z.number().int().min(1).max(10).optional(),
    type: z.enum(['lecture', 'tutorial', 'lab', 'mooc', 'elective']).optional(),
    department_id: z.string().uuid().optional(),
    semester: z.number().int().min(1).max(12).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const courseQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
    department_id: z.string().uuid().optional(),
    type: z.enum(['lecture', 'tutorial', 'lab', 'mooc', 'elective']).optional(),
    semester: z.string().regex(/^\d+$/).optional(),
  }),
});

export const generateCodeSchema = z.object({
  body: z.object({
    department: z.string().min(2).max(10),
    type: z.enum(['lecture', 'tutorial', 'lab', 'mooc', 'elective']),
    semester: z.number().int().min(1).max(12),
    year: z.number().int().min(1).max(6).optional(),
    specialization: z.string().optional(),
  }),
});

// ============ Face Recognition Schemas ============

export const saveFaceEncodingSchema = z.object({
  body: z.object({
    student_id: z.string().uuid('Invalid student ID'),
    encoding: z.array(z.number()).length(128, 'Face encoding must have 128 dimensions'),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID'),
  }),
});

// ============ Type exports ============

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>['body'];
export type CreateStudentInput = z.infer<typeof createStudentSchema>['body'];
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>['body'];
export type CreateCourseInput = z.infer<typeof createCourseSchema>['body'];
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>['body'];
export type GenerateCodeInput = z.infer<typeof generateCodeSchema>['body'];

