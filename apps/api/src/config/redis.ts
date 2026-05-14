import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

const redisConfig = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
};

export const redis = new Redis(redisConfig);

export const bullRedis = new Redis(redisConfig);

redis.on('connect', () => logger.info('✅  Redis connected'));
redis.on('error', err => logger.error('Redis error', { error: err.message }));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));
export async function cacheGet<T>(key: string): Promise<T | null> {
    const val = await redis.get(key);
    if (!val) return null;
    try {
        return JSON.parse(val) as T;
    } catch {
        return null;
    }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
    } else {
        await redis.set(key, serialized);
    }
}

export async function cacheDel(...keys: string[]): Promise<void> {
    if (keys.length > 0) await redis.del(...keys);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
}

export const CacheKeys = {
    score: (candidateId: string, jobId: string) => `score:${candidateId}:${jobId}`,
    job: (jobId: string) => `job:${jobId}`,
    candidates: (jobId: string, page: number) => `candidates:${jobId}:page:${page}`,
    queueStats: () => `queue-stats`,
    intent: (msgHash: string) => `intent:${msgHash}`,
};

export const CacheTTL = {
    SCORE: 60 * 60 * 24,
    SCORE_FALLBACK: 60 * 60,
    JOB: 60 * 5,
    CANDIDATES: 60 * 2,
    QUEUE_STATS: 10,
    INTENT: 60 * 60,
};
