import { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger';
import { ZodError } from 'zod';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
    }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        logger.warn('Operational error', {
            code: err.code,
            message: err.message,
            path: req.path,
            method: req.method,
        });

        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
        });
        return;
    }

    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            error: err.errors[0].message,
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    if ((err as any).code === 11000) {
        res.status(409).json({
            success: false,
            error: 'Duplicate record. This item already exists.',
            code: 'CONFLICT',
        });
        return;
    }

    logger.error('Unexpected error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    res.status(500).json({
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
    });
}

export const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
