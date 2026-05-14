import { connectDB } from '@/config/db';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { startSourcingWorker } from '@/workers/sourcing.worker';
import { startScoringWorker } from '@/workers/scoring.worker';
import { startOutreachWorker } from '@/workers/outreach.worker';

async function bootstrapWorker() {
    logger.info('🔧  Starting worker process...');

    await connectDB();

    const sourcingWorker = startSourcingWorker();
    const scoringWorker = startScoringWorker();
    const outreachWorker = startOutreachWorker();

    logger.info('✅  All workers started', {
        environment: env.NODE_ENV,
        queues: ['sourcing', 'scoring', 'outreach'],
        emailAlertsEnabled: !!(env.SMTP_HOST && env.ALERT_EMAIL_TO),
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received — closing workers gracefully`);

        await Promise.allSettled([
            sourcingWorker.close(),
            scoringWorker.close(),
            outreachWorker.close(),
        ]);

        logger.info('✅  All workers shut down cleanly');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', err => {
        logger.error('Worker uncaught exception', { error: err.message, stack: err.stack });
        process.exit(1);
    });
    process.on('unhandledRejection', reason => {
        logger.error('Worker unhandled rejection', { reason });
        process.exit(1);
    });
}

bootstrapWorker();
