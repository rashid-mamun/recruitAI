import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from '@/config/env';
import { requestLogger } from '@/middleware/requestLogger';
import { errorHandler } from '@/middleware/errorHandler';
import { healthRouter } from '@/modules/health/health.routes';
import { allQueues } from '@/queues';
import { swaggerSpec } from '@/config/swagger';

import { jobRouter } from '@/modules/jobs/job.routes';
import { candidateRouter } from '@/modules/candidates/candidate.routes';
import { taskRouter } from '@/modules/tasks/task.routes';
import { sourcingRouter } from '@/modules/sourcing/sourcing.routes';
import { authRouter } from '@/modules/auth/auth.routes';
import { streamRouter } from '@/modules/stream/stream.routes';
import { protect } from '@/middleware/authHandler';
import { adminGuard } from '@/middleware/adminGuard';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Message } from '@/modules/candidates/message.model';

export function createApp(): Application {
    const app = express();

    app.use(helmet());
    app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use(requestLogger);

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
        queues: allQueues.map(queue => new BullMQAdapter(queue)) as any,
        serverAdapter,
    });
    app.use('/admin/queues', protect, adminGuard, serverAdapter.getRouter());

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    app.use('/health', healthRouter);

    app.use('/api/auth', authRouter);

    app.use('/api/stream', streamRouter);

    app.use('/api/jobs', protect, jobRouter);

    app.get('/api/queue-stats', async (_req, res) => {
        try {
            const stats = await Promise.all(
                allQueues.map(async queue => {
                    const [waiting, active, completed, failed, delayed] = await Promise.all([
                        queue.getWaitingCount(),
                        queue.getActiveCount(),
                        queue.getCompletedCount(),
                        queue.getFailedCount(),
                        queue.getDelayedCount(),
                    ]);
                    return { name: queue.name, waiting, active, completed, failed, delayed };
                })
            );
            res.json({ success: true, data: stats });
        } catch {
            res.status(500).json({ success: false, error: 'Failed to fetch queue stats' });
        }
    });

    app.get('/api/stats/global', protect, async (req, res) => {
        try {
            const [jobs, candidates, messages] = await Promise.all([
                Job.find({ status: { $ne: 'archived' } }).lean(),
                Candidate.find({}).lean(),
                Message.find({ role: 'candidate' }).lean(),
            ]);

            const activeJobs = jobs.filter(j => j.status === 'active').length;
            const totalCandidates = candidates.length;

            const contacted = candidates.filter(c =>
                ['contacted', 'interested', 'not_interested', 'hired'].includes(c.status)
            ).length;

            const respondedIds = new Set(messages.map(m => m.candidateId.toString()));
            const responded = respondedIds.size;

            const interested = candidates.filter(c => c.status === 'interested').length;
            const notInterested = candidates.filter(c => c.status === 'not_interested').length;
            const hired = candidates.filter(c => c.status === 'hired').length;

            const scores = candidates
                .filter(c => c.score && typeof c.score.value === 'number' && c.score.value > 0)
                .map(c => c.score!.value);

            const avgScore =
                scores.length > 0
                    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                    : null;

            const topScore = scores.length > 0 ? Math.max(...scores) : null;

            const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : null;

            res.json({
                success: true,
                data: {
                    activeJobs,
                    totalCandidates,
                    contacted,
                    responded,
                    interested,
                    notInterested,
                    hired,
                    avgScore,
                    topScore,
                    responseRate,
                },
            });
        } catch (error) {
            console.error('[API] Global stats error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch global stats' });
        }
    });

    app.use('/api', protect, candidateRouter);
    app.use('/api/tasks', protect, taskRouter);
    app.use('/api/jobs/:jobId/sourcing-tasks', protect, sourcingRouter);

    app.use((_req, res) => {
        res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
    });

    app.use(errorHandler);

    return app;
}
