import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';
import { User } from './user.model';
import { Session } from './session.model';
import { env } from '@/config/env';
import { AppError, ConflictError } from '@/middleware/errorHandler';
import {
    ensureDefaultOrganization,
    createDefaultOrganizationForUser,
} from '@/modules/organizations/organization.service';
import { sendPasswordResetEmail } from '@/services/email.service';
import type { RegisterDto, LoginDto, GoogleLoginDto } from './auth.schema';
import type { IOrganization } from '@/types';
import { Membership } from '@/modules/organizations/membership.model';
import { Organization } from '@/modules/organizations/organization.model';

/**
 * User response (without password)
 */
interface UserResponse {
    id: string;
    name: string;
    email: string;
    role: string;
    defaultOrganizationId?: string | null;
    organization?: IOrganization | null;
}

interface AuthResult {
    user: UserResponse;
    token: string;
    refreshToken: string;
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface GoogleTokenInfo {
    sub: string;
    aud: string;
    email: string;
    email_verified: 'true' | 'false' | boolean;
    name?: string;
}

/**
 * Generate JWT token for a user
 */
function generateToken(userId: string, role: string, organizationId?: string | null): string {
    return jwt.sign({ userId, role, organizationId }, env.JWT_SECRET, {
        expiresIn: '7d',
    });
}

/**
 * Format user for response (omit password)
 */
function formatUserResponse(user: any, organization?: IOrganization | null): UserResponse {
    return {
        id: user._id as unknown as string,
        name: user.name,
        email: user.email,
        role: user.role,
        defaultOrganizationId: user.defaultOrganizationId?.toString?.() ?? null,
        organization: organization ?? null,
    };
}

/**
 * Register a new user
 */
export async function registerUser(
    dto: RegisterDto,
    context: { userAgent?: string; ip?: string } = {}
): Promise<AuthResult> {
    const userExists = await User.findOne({ email: dto.email });
    if (userExists) {
        throw new ConflictError('User already exists with this email');
    }

    const user = await User.create({
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: 'recruiter',
    });

    const organization = await createDefaultOrganizationForUser(user);
    user.defaultOrganizationId = organization._id as any;

    const token = generateToken(user._id as unknown as string, user.role, organization._id);
    const refreshToken = await createSession(
        user._id as unknown as string,
        organization._id,
        context
    );

    return {
        user: formatUserResponse(user, organization),
        token,
        refreshToken,
    };
}

/**
 * Login a user
 */
export async function loginUser(
    dto: LoginDto,
    context: { userAgent?: string; ip?: string } = {}
): Promise<AuthResult> {
    if (!dto.email || !dto.password) {
        throw new AppError('Please provide email and password', 400);
    }

    const user = await User.findOne({ email: dto.email }).select('+password');
    if (!user || !user.password) {
        throw new AppError('Invalid credentials', 401);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new AppError(
            'Too many incorrect attempts. Try again in 15 minutes or reset your password.',
            423,
            'ACCOUNT_LOCKED'
        );
    }

    if (!(await user.comparePassword(dto.password))) {
        user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
        if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
        }
        await user.save();
        throw new AppError('Invalid credentials', 401);
    }

    if (user.failedLoginAttempts || user.lockedUntil) {
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        await user.save();
    }

    const organization = await ensureDefaultOrganization(user);
    const token = generateToken(user._id as unknown as string, user.role, organization._id);
    const refreshToken = await createSession(
        user._id as unknown as string,
        organization._id,
        context
    );

    return {
        user: formatUserResponse(user, organization),
        token,
        refreshToken,
    };
}

/**
 * Login or create a user from a verified Google ID token.
 */
export async function loginWithGoogle(
    dto: GoogleLoginDto,
    context: { userAgent?: string; ip?: string } = {}
): Promise<AuthResult> {
    if (!env.GOOGLE_CLIENT_ID) {
        throw new AppError(
            'Google sign-in is temporarily unavailable',
            503,
            'AUTH_PROVIDER_UNAVAILABLE'
        );
    }

    let profile: GoogleTokenInfo;
    try {
        const { data } = await axios.get<GoogleTokenInfo>(
            'https://oauth2.googleapis.com/tokeninfo',
            {
                params: { id_token: dto.credential },
                timeout: 5000,
            }
        );
        profile = data;
    } catch {
        throw new AppError('Unable to verify Google sign-in', 401, 'GOOGLE_AUTH_FAILED');
    }

    if (profile.aud !== env.GOOGLE_CLIENT_ID) {
        throw new AppError('Unable to verify Google sign-in', 401, 'GOOGLE_AUTH_FAILED');
    }

    if (profile.email_verified !== true && profile.email_verified !== 'true') {
        throw new AppError('Unable to verify Google sign-in', 401, 'GOOGLE_AUTH_FAILED');
    }

    const email = profile.email.toLowerCase();
    const name = profile.name || email.split('@')[0];

    let user = await User.findOne({ email });
    if (!user) {
        user = await User.create({
            name,
            email,
            authProvider: 'google',
            googleId: profile.sub,
            role: 'recruiter',
        });
        const organization = await createDefaultOrganizationForUser(user);
        user.defaultOrganizationId = organization._id as any;
    } else {
        if (user.authProvider !== 'google' || !user.googleId) {
            throw new ConflictError(
                'An account with this email already uses password sign-in. Sign in with email and password.',
                'AUTH_PROVIDER_CONFLICT'
            );
        }
        if (user.googleId !== profile.sub) {
            throw new AppError(
                'This Google identity does not match the existing account',
                401,
                'GOOGLE_IDENTITY_MISMATCH'
            );
        }
    }

    const organization = await ensureDefaultOrganization(user);
    const token = generateToken(user._id as unknown as string, user.role, organization._id);
    const refreshToken = await createSession(
        user._id as unknown as string,
        organization._id,
        context
    );

    return {
        user: formatUserResponse(user, organization),
        token,
        refreshToken,
    };
}

export async function refreshSession(
    refreshToken: string,
    context: { userAgent?: string; ip?: string } = {}
): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await Session.findOne({
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    });

    if (!session) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(session.userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    session.revokedAt = new Date();
    await session.save();

    const organization = await ensureDefaultOrganization(
        user,
        session.organizationId?.toString() ?? null
    );
    const organizationId = organization._id;
    const token = generateToken(user._id as unknown as string, user.role, organizationId);
    const nextRefreshToken = await createSession(
        user._id as unknown as string,
        organizationId,
        context
    );

    return {
        user: formatUserResponse(user, organization),
        token,
        refreshToken: nextRefreshToken,
    };
}

export async function logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
        await Session.findOneAndUpdate(
            { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
            { $set: { revokedAt: new Date() } }
        );
        return;
    }

    if (userId) {
        await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
}

export async function requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
        '+resetPasswordTokenHash +resetPasswordExpiresAt'
    );

    if (!user) return {};

    const resetToken = crypto.randomBytes(32).toString('base64url');
    user.resetPasswordTokenHash = hashRefreshToken(resetToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl: `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`,
    });

    if (env.NODE_ENV === 'production' && env.EMAIL_DELIVERY_MODE !== 'preview') return {};
    return { resetToken };
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
    const user = await User.findOne({
        resetPasswordTokenHash: hashRefreshToken(token),
        resetPasswordExpiresAt: { $gt: new Date() },
    }).select('+password +resetPasswordTokenHash +resetPasswordExpiresAt');

    if (!user) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    user.password = password;
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    await Session.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<UserResponse> {
    const user = await User.findById(userId).lean();
    if (!user) {
        throw new AppError('User not found', 404);
    }

    const organization = await ensureDefaultOrganization(user);
    return formatUserResponse(user, organization);
}

export async function switchWorkspace(
    userId: string,
    organizationId: string,
    context: { userAgent?: string; ip?: string } = {}
): Promise<AuthResult> {
    const [user, membership, organization] = await Promise.all([
        User.findById(userId),
        Membership.findOne({ userId, organizationId, status: 'active' }).lean(),
        Organization.findOne({ _id: organizationId, status: 'active' }).lean(),
    ]);
    if (!user || !membership || !organization) {
        throw new AppError('Workspace is unavailable', 404, 'WORKSPACE_NOT_FOUND');
    }
    user.defaultOrganizationId = organization._id as any;
    await user.save();
    const refreshToken = await createSession(userId, organizationId, context);
    return {
        user: formatUserResponse(user, organization as unknown as IOrganization),
        token: generateToken(userId, user.role, organizationId),
        refreshToken,
    };
}

async function createSession(
    userId: string,
    organizationId?: string | null,
    context: { userAgent?: string; ip?: string } = {}
): Promise<string> {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    await Session.create({
        userId,
        organizationId: organizationId || null,
        refreshTokenHash: hashRefreshToken(refreshToken),
        userAgent: context.userAgent?.slice(0, 500) ?? null,
        ip: context.ip ?? null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });
    return refreshToken;
}

function hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
