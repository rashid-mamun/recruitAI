import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(5000),

    MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    JWT_SECRET: z.string().default('secret_key_for_testing'),

    OPENAI_API_KEY: z.string().optional(),

    GEMINI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(), // Free fallback: https://console.groq.com
    ACTIVE_AI_PROVIDER: z.enum(['openai', 'gemini']).default('gemini'),

    SERPER_API_KEY: z.string().optional(),
    SOURCING_PROVIDER: z.enum(['serper', 'puppeteer', 'mock', 'duckduckgo']).default('mock'),

    FRONTEND_URL: z.string().default('http://localhost:5173'),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    ALERT_EMAIL_TO: z.string().email().optional().or(z.literal('')),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
    console.error('❌  Invalid environment variables:');
    console.error(_parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = _parsed.data;
export type Env = typeof env;
