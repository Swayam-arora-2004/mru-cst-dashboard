import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

/**
 * Input sanitization middleware
 * Prevents XSS attacks by sanitizing user input
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potential XSS patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    const sanitized = sanitize(req.query);
    Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
    Object.assign(req.query, sanitized);
  }
  
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

/**
 * Security headers middleware
 * Additional security headers beyond helmet
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
};

/**
 * Request size limiter
 * Prevents DoS attacks via large payloads
 */
export const requestSizeLimiter = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      const response: ApiResponse = {
        success: false,
        error: 'Request payload too large',
      };
      res.status(413).json(response);
      return;
    }
    
    next();
  };
};

/**
 * SQL Injection protection
 * Validates UUID format and other common patterns
 */
export const validateId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    
    if (!id) {
      next();
      return;
    }
    
    // UUID v4 pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidPattern.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid ID format',
      };
      res.status(400).json(response);
      return;
    }
    
    next();
  };
};

/**
 * Prevent parameter pollution
 */
export const preventParameterPollution = (req: Request, res: Response, next: NextFunction): void => {
  const clean = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // If array, take only the first value to prevent pollution
      cleaned[key] = Array.isArray(value) ? value[0] : value;
    }
    return cleaned;
  };

  if (req.query && Object.keys(req.query).length > 0) {
    const cleaned = clean(req.query);
    Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
    Object.assign(req.query, cleaned);
  }
  
  next();
};

/**
 * Login attempt tracking (in-memory for now)
 * Should be moved to Redis in production
 */
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const trackLoginAttempts = (maxAttempts: number = 5, windowMs: number = 900000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.body.email || req.ip;
    
    if (!identifier) {
      next();
      return;
    }
    
    const now = Date.now();
    const attempt = loginAttempts.get(identifier);
    
    if (attempt) {
      // Reset if outside the window
      if (now - attempt.lastAttempt > windowMs) {
        loginAttempts.delete(identifier);
      } else if (attempt.count >= maxAttempts) {
        const response: ApiResponse = {
          success: false,
          error: 'Too many login attempts. Please try again later.',
        };
        res.status(429).json(response);
        return;
      }
    }
    
    next();
  };
};

export const recordLoginAttempt = (identifier: string, success: boolean): void => {
  if (success) {
    loginAttempts.delete(identifier);
    return;
  }
  
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);
  
  if (attempt) {
    loginAttempts.set(identifier, {
      count: attempt.count + 1,
      lastAttempt: now,
    });
  } else {
    loginAttempts.set(identifier, {
      count: 1,
      lastAttempt: now,
    });
  }
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 900000; // 15 minutes
  
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.lastAttempt > windowMs) {
      loginAttempts.delete(key);
    }
  }
}, 300000); // Clean every 5 minutes
