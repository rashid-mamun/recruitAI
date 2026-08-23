import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from './errorHandler';
import { Membership } from '@/modules/organizations/membership.model';
import type { MembershipRole } from '@/types';

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
        const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
        if (!decoded.userId || !decoded.organizationId) {
            return next(
                new AppError('A valid workspace session is required', 401, 'INVALID_SESSION')
            );
        }
        void Membership.findOne({
            userId: decoded.userId,
            organizationId: decoded.organizationId,
            status: 'active',
        })
            .lean()
            .then(membership => {
                if (!membership) {
                    next(
                        new AppError('Workspace membership is inactive', 403, 'MEMBERSHIP_INACTIVE')
                    );
                    return;
                }
                (req as any).user = { ...decoded, workspaceRole: membership.role };
                next();
            })
            .catch(next);
    } catch (error) {
        return next(new AppError('Not authorized to access this route, token failed', 401));
    }
};

export const workspaceAccess = (req: Request, _res: Response, next: NextFunction) => {
    const role = (req as any).user?.workspaceRole as MembershipRole | undefined;
    if (!role) return next(new AppError('Workspace role is required', 403, 'FORBIDDEN'));
    if (['owner', 'admin', 'recruiter'].includes(role)) return next();
    if (role === 'viewer') {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        if (
            /^\/api\/notifications(\/|$)/.test(req.originalUrl.split('?')[0]) &&
            ['PATCH', 'DELETE'].includes(req.method)
        )
            return next();
        return next(new AppError('Viewer access is read-only', 403, 'FORBIDDEN'));
    }
    if (role === 'interviewer') {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        const allowed = [
            /^\/api\/interviews\//,
            /^\/api\/collaboration\//,
            /^\/api\/evaluations\/[^/]+\/(override|review)$/,
            /^\/api\/notifications(\/|$)/,
        ];
        if (allowed.some(pattern => pattern.test(req.originalUrl.split('?')[0]))) return next();
        return next(
            new AppError('Interviewer access is limited to assigned feedback', 403, 'FORBIDDEN')
        );
    }
    return next(new AppError('Access denied', 403, 'FORBIDDEN'));
};

export const requireWorkspaceRoles =
    (...allowed: MembershipRole[]) =>
    (req: Request, _res: Response, next: NextFunction) => {
        const role = (req as any).user?.workspaceRole as MembershipRole | undefined;
        if (!role || !allowed.includes(role)) {
            return next(
                new AppError(
                    'You do not have permission for this workspace action',
                    403,
                    'FORBIDDEN'
                )
            );
        }
        next();
    };
