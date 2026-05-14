import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const IGNORED_META_KEYS = new Set([
    'service',
    'correlationId',
    'method',
    'path',
    'statusCode',
    'durationMs',
    'userAgent',
    'uri',
    'error',
]);
const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(
        ({
            level,
            message,
            timestamp,
            stack,
            correlationId,
            method,
            path,
            statusCode,
            durationMs,
            ...meta
        }) => {
            // HTTP request log — single clean line
            if (method && path && statusCode !== undefined) {
                const shortId = correlationId ? ` [${String(correlationId).slice(0, 18)}]` : '';
                const duration = durationMs ? ` ${durationMs}ms` : '';
                return `${timestamp} [${level}]: ${method} ${path} ${statusCode}${duration}${shortId}`;
            }

            const cleanMeta = Object.fromEntries(
                Object.entries(meta).filter(([k]) => !IGNORED_META_KEYS.has(k))
            );
            const metaStr = Object.keys(cleanMeta).length ? ` — ${JSON.stringify(cleanMeta)}` : '';

            return `${timestamp} [${level}]: ${stack ?? message}${metaStr}`;
        }
    )
);

const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    printf(({ level, message, timestamp, stack, ...meta }) => {
        const cleanMeta = Object.fromEntries(
            Object.entries(meta).filter(([k]) => !IGNORED_META_KEYS.has(k))
        );
        return JSON.stringify({ timestamp, level, message: stack ?? message, ...cleanMeta });
    })
);

export const logger = winston.createLogger({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
    transports: [new winston.transports.Console()],
});
