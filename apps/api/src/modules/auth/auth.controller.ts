import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as AuthService from './auth.service';
import {
    registerSchema,
    loginSchema,
    googleLoginSchema,
    logoutSchema,
    passwordResetConfirmSchema,
    passwordResetRequestSchema,
    refreshTokenSchema,
    switchWorkspaceSchema,
} from './auth.schema';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const dto = registerSchema.parse(req.body);
    const { user, token, refreshToken } = await AuthService.registerUser(dto, requestContext(req));

    res.status(201).json({
        success: true,
        data: { user, token, refreshToken },
        user,
        token,
        refreshToken,
    });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const dto = loginSchema.parse(req.body);
    const { user, token, refreshToken } = await AuthService.loginUser(dto, requestContext(req));

    res.json({
        success: true,
        data: { user, token, refreshToken },
        user,
        token,
        refreshToken,
    });
});

/**
 * Login or register with Google
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const dto = googleLoginSchema.parse(req.body);
    const { user, token, refreshToken } = await AuthService.loginWithGoogle(
        dto,
        requestContext(req)
    );

    res.json({
        success: true,
        data: { user, token, refreshToken },
        user,
        token,
        refreshToken,
    });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const dto = refreshTokenSchema.parse(req.body);
    const { user, token, refreshToken } = await AuthService.refreshSession(
        dto.refreshToken,
        requestContext(req)
    );

    res.json({
        success: true,
        data: { user, token, refreshToken },
        user,
        token,
        refreshToken,
    });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    const dto = logoutSchema.parse(req.body ?? {});
    await AuthService.logout(dto.refreshToken, (req as any).user?.userId || (req as any).user?.id);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
});

export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const dto = passwordResetRequestSchema.parse(req.body);
    const result = await AuthService.requestPasswordReset(dto.email);
    res.json({
        success: true,
        data: {
            message: 'If that email exists, password reset instructions have been sent.',
            ...result,
        },
    });
});

export const confirmPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const dto = passwordResetConfirmSchema.parse(req.body);
    await AuthService.confirmPasswordReset(dto.token, dto.password);
    res.json({ success: true, data: { message: 'Password reset successfully' } });
});

/**
 * Get current user profile
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as any).user;
    const userId = authUser?.userId || authUser?.id;
    const user = await AuthService.getUserById(userId);
    const profile = { ...user, workspaceRole: authUser.workspaceRole };

    res.json({
        success: true,
        data: profile,
        user: profile,
    });
});

export const switchWorkspace = asyncHandler(async (req: Request, res: Response) => {
    const dto = switchWorkspaceSchema.parse(req.body);
    const authUser = (req as any).user;
    const result = await AuthService.switchWorkspace(
        authUser.userId || authUser.id,
        dto.organizationId,
        requestContext(req)
    );
    res.json({ success: true, data: result });
});

function requestContext(req: Request) {
    return {
        userAgent: req.get('user-agent') ?? undefined,
        ip: req.ip,
    };
}
