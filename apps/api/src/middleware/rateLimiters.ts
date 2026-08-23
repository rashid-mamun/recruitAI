import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';

const skipInTest = () => env.NODE_ENV === 'test';

export const publicFormLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: {
        success: false,
        error: 'Too many requests. Please wait before submitting again.',
        code: 'RATE_LIMITED',
    },
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: {
        success: false,
        error: 'Too many auth attempts. Please wait before trying again.',
        code: 'RATE_LIMITED',
    },
});
