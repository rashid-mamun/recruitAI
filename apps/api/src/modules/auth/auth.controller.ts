import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as AuthService from './auth.service';
import { registerSchema, loginSchema, googleLoginSchema } from './auth.schema';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const dto = registerSchema.parse(req.body);
    const { user, token } = await AuthService.registerUser(dto);

    res.status(201).json({
        success: true,
        data: { user, token },
        user,
        token,
    });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const dto = loginSchema.parse(req.body);
    const { user, token } = await AuthService.loginUser(dto);

    res.json({
        success: true,
        data: { user, token },
        user,
        token,
    });
});

/**
 * Login or register with Google
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const dto = googleLoginSchema.parse(req.body);
    const { user, token } = await AuthService.loginWithGoogle(dto);

    res.json({
        success: true,
        data: { user, token },
        user,
        token,
    });
});

/**
 * Get current user profile
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as any).user;
    const userId = authUser?.userId || authUser?.id;
    const user = await AuthService.getUserById(userId);

    res.json({
        success: true,
        data: user,
        user,
    });
});
