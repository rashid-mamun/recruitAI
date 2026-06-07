import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from './errorHandler';

export const protect = (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token && req.query?.token) {
        const queryToken = req.query.token;
        token = Array.isArray(queryToken) ? String(queryToken[0]) : String(queryToken);
    }

    if (!token) {
        return next(new AppError('Not authorized to access this route', 401));
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        (req as any).user = decoded;
        next();
    } catch (error) {
        return next(new AppError('Not authorized to access this route, token failed', 401));
    }
};
