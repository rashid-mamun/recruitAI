import { z } from 'zod';

export const registerSchema = z
    .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address format'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
        role: z.literal('recruiter').optional(),
    })
    .strict();

export const loginSchema = z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
});

export const googleLoginSchema = z.object({
    credential: z.string().min(1, 'Google credential is required'),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(20, 'Refresh token is required'),
});

export const logoutSchema = z.object({
    refreshToken: z.string().min(20).optional(),
});

export const switchWorkspaceSchema = z.object({
    organizationId: z.string().regex(/^[a-f\d]{24}$/i, 'Organization ID must be valid'),
});

export const passwordResetRequestSchema = z.object({
    email: z.string().email('Invalid email address format'),
});

export const passwordResetConfirmSchema = z.object({
    token: z.string().min(20, 'Reset token is required'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type GoogleLoginDto = z.infer<typeof googleLoginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type PasswordResetRequestDto = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmDto = z.infer<typeof passwordResetConfirmSchema>;
