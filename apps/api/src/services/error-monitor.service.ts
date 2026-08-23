import { env } from '@/config/env';
import { logger } from '@/config/logger';

export function reportUnexpectedError(input: {
    message: string;
    stack?: string;
    correlationId?: string;
    method?: string;
    path?: string;
}) {
    if (!env.ERROR_MONITOR_WEBHOOK) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    void fetch(env.ERROR_MONITOR_WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service: 'recruitai-api', environment: env.NODE_ENV, ...input }),
        signal: controller.signal,
    })
        .catch(error => logger.warn('Error monitor delivery failed', { error: String(error) }))
        .finally(() => clearTimeout(timeout));
}
