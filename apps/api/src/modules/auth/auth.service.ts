import jwt from 'jsonwebtoken';
import { User } from './user.model';
import { env } from '@/config/env';
import { AppError, ConflictError } from '@/middleware/errorHandler';
import type { RegisterDto, LoginDto } from './auth.schema';
import type { UserRole } from '@/types';

/**
 * User response (without password)
 */
interface UserResponse {
    id: string;
    name: string;
    email: string;
}

/**
 * Generate JWT token for a user
 */
function generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, env.JWT_SECRET || 'fallback_secret', {
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
    if (!user || !(await user.comparePassword(dto.password))) {
        throw new AppError('Invalid credentials', 401);
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
