import Redis from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { sse } from './sse.service';
import type { ITask } from '@/types';

const redisConfig = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
};

// We use two different clients for pub and sub to avoid blocking
export const pubClient = new Redis(redisConfig);
export const subClient = new Redis(redisConfig);

pubClient.on('error', err => logger.error('Redis PubClient error', { error: err.message }));
subClient.on('error', err => logger.error('Redis SubClient error', { error: err.message }));

const TASK_EVENTS_CHANNEL = 'task-events-channel';

/**
 * Publish a task update to the Redis channel.
 * This should be called by the workers when they make progress.
 */
export async function publishTaskUpdate(taskId: string, taskData: Partial<ITask>): Promise<void> {
    try {
        const payload = JSON.stringify({ taskId, ...taskData });
        await pubClient.publish(TASK_EVENTS_CHANNEL, payload);
    } catch (err) {
        logger.error('Failed to publish task update', {
            taskId,
            error: err instanceof Error ? err.message : err,
        });
    }
}

/**
 * Start listening for task updates from Redis.
 * This should be called by the Express server process.
 */
export function startTaskSubscriber(): void {
    subClient.subscribe(TASK_EVENTS_CHANNEL, (err, count) => {
        if (err) {
            logger.error('Failed to subscribe to task events channel', { error: err.message });
            return;
        }
        logger.info(`✅  Subscribed to ${TASK_EVENTS_CHANNEL} (count: ${count})`);
    });

    subClient.on('message', (channel, message) => {
        if (channel === TASK_EVENTS_CHANNEL) {
            try {
                const data = JSON.parse(message);
                const taskId = data.taskId;

                // Broadcast this specific task update to connected SSE clients
                sse.broadcastToTask(taskId, 'task_updated', data);
            } catch (err) {
                logger.error('Failed to process incoming pubsub message', {
                    error: err instanceof Error ? err.message : err,
                });
            }
        }
    });
}
