import { connectDB } from '@/config/db';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { startSourcingWorker } from '@/workers/sourcing.worker';
import { startScoringWorker } from '@/workers/scoring.worker';
import { startOutreachWorker } from '@/workers/outreach.worker';
import { startInterviewAnalysisWorker } from '@/workers/interview-analysis.worker';
import { redis } from '@/config/redis';

async function bootstrapWorker() {
    logger.info('🔧  Starting worker process...');

    await connectDB();

    const sourcingWorker = startSourcingWorker();
    const scoringWorker = startScoringWorker();
    const outreachWorker = startOutreachWorker();
    const interviewAnalysisWorker = startInterviewAnalysisWorker();
    const heartbeat = async () => {
        await redis.setex('worker:heartbeat', 45, new Date().toISOString());
    };
    await heartbeat();
    const heartbeatTimer = setInterval(() => void heartbeat(), 15_000);

    logger.info('✅  All workers started', {
        environment: env.NODE_ENV,
        queues: ['sourcing', 'scoring', 'outreach', 'interview-analysis'],
        emailAlertsEnabled: !!(env.SMTP_HOST && env.ALERT_EMAIL_TO),
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received — closing workers gracefully`);
        clearInterval(heartbeatTimer);
        await redis.del('worker:heartbeat');

        await Promise.allSettled([
            sourcingWorker.close(),
            scoringWorker.close(),
            outreachWorker.close(),
            interviewAnalysisWorker.close(),
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
