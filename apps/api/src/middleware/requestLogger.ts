import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/config/logger';

declare global {
    namespace Express {
        interface Request {
            correlationId: string;
            startTime: number;
        }
    }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    req.correlationId = (req.headers['x-correlation-id'] as string) ?? uuidv4();
    req.startTime = Date.now();

    res.setHeader('x-correlation-id', req.correlationId);

    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        logger[level](`${req.method} ${req.originalUrl} ${res.statusCode}`, {
            correlationId: req.correlationId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: duration,
            userAgent: req.headers['user-agent'],
        });
    });

    next();
}
