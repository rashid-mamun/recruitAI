import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export const adminGuard = (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || user.role !== 'admin') {
        return next(new AppError('Access denied: admin role required', 403));
    }

    return next();
};
