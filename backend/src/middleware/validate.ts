import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { ApiResponse } from '../types';

export const validate = (schema: ZodSchema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Validation error',
          data: error.issues.map((e: ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};
