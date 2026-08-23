import { createApp } from '@/app';
import { connectDB, disconnectDB } from '@/config/db';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

import { startTaskSubscriber } from '@/services/pubsub.service';
import { startSourcingWorker } from '@/workers/sourcing.worker';
import { startScoringWorker } from '@/workers/scoring.worker';
import { startOutreachWorker } from '@/workers/outreach.worker';
import { startInterviewAnalysisWorker } from '@/workers/interview-analysis.worker';

async function bootstrap() {
    await connectDB();
    startTaskSubscriber();

    // Free/single-service deployments can opt into embedded workers. Larger
    // deployments should keep this false and run the dedicated worker process.
    const localWorkers = env.EMBEDDED_WORKERS
        ? [
              startSourcingWorker(),
              startScoringWorker(),
              startOutreachWorker(),
              startInterviewAnalysisWorker(),
          ]
        : [];

    const app = createApp();
    const server = app.listen(env.PORT, () => {
        logger.info(`🚀  API server running on http://localhost:${env.PORT}`);
        logger.info(`📚  Swagger docs at http://localhost:${env.PORT}/api/docs`);
        logger.info(`⚙️   Bull Board at http://localhost:${env.PORT}/admin/queues`);
        logger.info(`🌿  Environment: ${env.NODE_ENV}`);
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received — shutting down gracefully`);

        server.close(async () => {
            await Promise.allSettled(localWorkers.map(worker => worker.close()));
            await disconnectDB();
            logger.info('✅  Server shut down cleanly');
            process.exit(0);
        });

        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', err => {
        logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
        process.exit(1);
    });
    process.on('unhandledRejection', reason => {
        logger.error('Unhandled Rejection', { reason });
        process.exit(1);
    });
}

bootstrap();
