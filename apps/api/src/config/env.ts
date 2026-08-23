import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.coerce.number().default(5000),
        TRUST_PROXY: z.coerce.boolean().default(false),
        API_DOCS_ENABLED: z.coerce.boolean().optional(),
        LOCAL_STORAGE_DIR: z.string().default('/tmp/recruitai-storage'),
        STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
        CLOUDINARY_CLOUD_NAME: z.string().optional(),
        CLOUDINARY_API_KEY: z.string().optional(),
        CLOUDINARY_API_SECRET: z.string().optional(),
        S3_BUCKET: z.string().optional(),
        S3_REGION: z.string().optional(),
        S3_ENDPOINT: z.string().optional(),
        S3_ACCESS_KEY_ID: z.string().optional(),
        S3_SECRET_ACCESS_KEY: z.string().optional(),
        S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
        BILLING_PROVIDER: z.enum(['manual', 'stripe']).default('manual'),
        STRIPE_SECRET_KEY: z.string().optional(),
        STRIPE_WEBHOOK_SECRET: z.string().optional(),
        STRIPE_PRO_PRICE_ID: z.string().optional(),
        STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),
        MALWARE_SCAN_PROVIDER: z.enum(['local', 'http']).default('local'),
        MALWARE_SCAN_URL: z.string().url().optional(),

        MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),

        REDIS_HOST: z.string().default('localhost'),
        REDIS_PORT: z.coerce.number().default(6379),
        REDIS_PASSWORD: z.string().optional(),
        REDIS_URL: z.string().url().optional(),
        REDIS_SOCKET: z.string().optional(),
        EMBEDDED_WORKERS: z.preprocess(
            value => value === true || value === 'true' || value === '1',
            z.boolean()
        ),
        JWT_SECRET: z.string().default('secret_key_for_testing'),

        OPENAI_API_KEY: z.string().optional(),

        GEMINI_API_KEY: z.string().optional(),
        GROQ_API_KEY: z.string().optional(), // Free fallback: https://console.groq.com
        ACTIVE_AI_PROVIDER: z.preprocess(
            value => (value === '' ? undefined : value),
            z.enum(['groq', 'gemini', 'openai']).optional()
        ),

        SERPER_API_KEY: z.string().optional(),
        SOURCING_PROVIDER: z.enum(['serper', 'puppeteer', 'mock', 'duckduckgo']).default('mock'),

        FRONTEND_URL: z.string().default('http://localhost:5173'),
        FRONTEND_URLS: z.string().optional(),
        GOOGLE_CLIENT_ID: z.string().optional(),

        SMTP_HOST: z.string().optional(),
        EMAIL_DELIVERY_MODE: z.enum(['preview', 'smtp']).default('preview'),
        SMTP_PORT: z.coerce.number().default(587),
        SMTP_USER: z.string().optional(),
        SMTP_PASS: z.string().optional(),
        ALERT_EMAIL_TO: z.string().email().optional().or(z.literal('')),
        ERROR_MONITOR_WEBHOOK: z.string().url().optional(),
        METRICS_TOKEN: z.string().min(24).optional(),
        EMAIL_WEBHOOK_SECRET: z.string().min(24).optional(),
    })
    .superRefine((parsedEnv, ctx) => {
        if (
            parsedEnv.NODE_ENV === 'production' &&
            (parsedEnv.JWT_SECRET === 'secret_key_for_testing' || parsedEnv.JWT_SECRET.length < 32)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['JWT_SECRET'],
                message: 'JWT_SECRET must be set to a strong secret in production',
            });
        }

        if (parsedEnv.NODE_ENV === 'production' && parsedEnv.FRONTEND_URL.includes('localhost')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['FRONTEND_URL'],
                message: 'FRONTEND_URL must be set to the production web origin in production',
            });
        }

        if (parsedEnv.NODE_ENV === 'production' && !parsedEnv.METRICS_TOKEN) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['METRICS_TOKEN'],
                message: 'METRICS_TOKEN is required in production',
            });
        }

        if (
            parsedEnv.NODE_ENV === 'production' &&
            parsedEnv.EMAIL_DELIVERY_MODE === 'smtp' &&
            parsedEnv.SMTP_HOST &&
            !parsedEnv.EMAIL_WEBHOOK_SECRET
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['EMAIL_WEBHOOK_SECRET'],
                message: 'EMAIL_WEBHOOK_SECRET is required when SMTP is enabled in production',
            });
        }
        if (parsedEnv.EMAIL_DELIVERY_MODE === 'smtp' && !parsedEnv.SMTP_HOST) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['SMTP_HOST'],
                message: 'SMTP_HOST is required when EMAIL_DELIVERY_MODE=smtp',
            });
        }

        if (parsedEnv.NODE_ENV === 'production' && parsedEnv.STORAGE_PROVIDER === 's3') {
            for (const key of [
                'S3_BUCKET',
                'S3_REGION',
                'S3_ACCESS_KEY_ID',
                'S3_SECRET_ACCESS_KEY',
            ] as const) {
                if (!parsedEnv[key]) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [key],
                        message: `${key} is required when STORAGE_PROVIDER=s3 in production`,
                    });
                }
            }
        }

        if (parsedEnv.NODE_ENV === 'production' && parsedEnv.STORAGE_PROVIDER === 'cloudinary') {
            for (const key of [
                'CLOUDINARY_CLOUD_NAME',
                'CLOUDINARY_API_KEY',
                'CLOUDINARY_API_SECRET',
            ] as const) {
                if (!parsedEnv[key]) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [key],
                        message: `${key} is required when STORAGE_PROVIDER=cloudinary`,
                    });
                }
            }
        }

        if (parsedEnv.NODE_ENV === 'production' && parsedEnv.BILLING_PROVIDER === 'stripe') {
            for (const key of [
                'STRIPE_SECRET_KEY',
                'STRIPE_WEBHOOK_SECRET',
                'STRIPE_PRO_PRICE_ID',
                'STRIPE_ENTERPRISE_PRICE_ID',
            ] as const) {
                if (!parsedEnv[key]) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [key],
                        message: `${key} is required when BILLING_PROVIDER=stripe in production`,
                    });
                }
            }
        }

        if (
            parsedEnv.NODE_ENV === 'production' &&
            parsedEnv.MALWARE_SCAN_PROVIDER === 'http' &&
            !parsedEnv.MALWARE_SCAN_URL
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['MALWARE_SCAN_URL'],
                message:
                    'MALWARE_SCAN_URL is required when MALWARE_SCAN_PROVIDER=http in production',
            });
        }
    });

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
    console.error('❌  Invalid environment variables:');
    console.error(_parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = _parsed.data;
export type Env = typeof env;

export const allowedOrigins = Array.from(
    new Set(
        [env.FRONTEND_URL, ...(env.FRONTEND_URLS?.split(',') ?? [])]
            .map(origin => origin.trim())
            .filter(Boolean)
    )
);

export const apiDocsEnabled = env.API_DOCS_ENABLED ?? env.NODE_ENV !== 'production';
