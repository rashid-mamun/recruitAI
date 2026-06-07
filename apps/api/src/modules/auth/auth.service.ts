import jwt from 'jsonwebtoken';
import axios from 'axios';
import { User } from './user.model';
import { env } from '@/config/env';
import { AppError, ConflictError } from '@/middleware/errorHandler';
import type { RegisterDto, LoginDto, GoogleLoginDto } from './auth.schema';
import type { UserRole } from '@/types';

/**
 * User response (without password)
 */
interface UserResponse {
    id: string;
    name: string;
    email: string;
}

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
function generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, env.JWT_SECRET, {
        expiresIn: '7d',
    });
}

/**
 * Format user for response (omit password)
 */
function formatUserResponse(user: any): UserResponse {
    return {
        id: user._id as unknown as string,
        name: user.name,
        email: user.email,
    };
}

/**
 * Register a new user
 */
export async function registerUser(
    dto: RegisterDto
): Promise<{ user: UserResponse; token: string }> {
    const userExists = await User.findOne({ email: dto.email });
    if (userExists) {
        throw new ConflictError('User already exists with this email');
    }

    const user = await User.create({
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: dto.role || 'recruiter',
    });

    const token = generateToken(user._id as unknown as string, user.role);

    return {
        user: formatUserResponse(user),
        token,
    };
}

/**
 * Login a user
 */
export async function loginUser(dto: LoginDto): Promise<{ user: UserResponse; token: string }> {
    if (!dto.email || !dto.password) {
        throw new AppError('Please provide email and password', 400);
    }

    const user = await User.findOne({ email: dto.email }).select('+password');
    if (!user || !user.password || !(await user.comparePassword(dto.password))) {
        throw new AppError('Invalid credentials', 401);
    }

    const token = generateToken(user._id as unknown as string, user.role);

    return {
        user: formatUserResponse(user),
        token,
    };
}

/**
 * Login or create a user from a verified Google ID token.
 */
export async function loginWithGoogle(
    dto: GoogleLoginDto
): Promise<{ user: UserResponse; token: string }> {
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
    } else {
        const updates: Record<string, string> = {};
        if (!user.googleId) updates.googleId = profile.sub;
        if (!user.authProvider) updates.authProvider = 'google';
        if (Object.keys(updates).length > 0) {
            user.set(updates);
            await user.save();
        }
    }

    const token = generateToken(user._id as unknown as string, user.role);

    return {
        user: formatUserResponse(user),
        token,
    };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<UserResponse> {
    const user = await User.findById(userId).lean();
    if (!user) {
        throw new AppError('User not found', 404);
    }

    return formatUserResponse(user);
}
