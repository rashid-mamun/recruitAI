import pRetry, { AbortError } from 'p-retry';
import { logger } from '@/config/logger';

export async function smartAiRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    return pRetry(
        async () => {
            try {
                return await fn();
            } catch (error: any) {
                // Determine if error is a rate limit or quota issue
                const status = error?.status || error?.response?.status;
                const message = error?.message?.toLowerCase() || '';

                const isQuotaError =
                    status === 429 ||
                    message.includes('quota') ||
                    message.includes('resource_exhausted') ||
                    message.includes('rate limit');

                const isAuthError = status === 401 || status === 403;
                const isBadRequest = status === 400;

                // Do not retry on Quota Exhausted, Auth failures, or Bad Requests
                if (isQuotaError || isAuthError || isBadRequest) {
                    logger.warn(`[smartAiRetry] Aborting retries for ${context}`, {
                        reason: isQuotaError
                            ? 'Quota/Rate Limit'
                            : isAuthError
                              ? 'Auth Error'
                              : 'Bad Request',
                        error: error.message,
                    });
                    throw new AbortError(error);
                }

                throw error; // Retries on 500, 502, 503, 504
            }
        },
        {
            retries: 3,
            factor: 2,
            minTimeout: 1500,
            onFailedAttempt: error => {
                logger.warn(`[smartAiRetry] Attempt failed for ${context}`, {
                    attempt: error.attemptNumber,
                    retriesLeft: error.retriesLeft,
                    error: error.message,
                });
            },
        }
    );
}
