import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { allowedOrigins, apiDocsEnabled, env } from '@/config/env';
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
import { interviewRouter } from '@/modules/interviews/interview.routes';
import { evaluationRouter } from '@/modules/evaluations/evaluation.routes';
import { evaluationAdminRouter } from '@/modules/evaluations/evaluation-admin.routes';
import { reportRouter } from '@/modules/reports/report.routes';
import { collaborationRouter } from '@/modules/collaboration/collaboration.routes';
import { fileRouter } from '@/modules/files/file.routes';
import { organizationRouter } from '@/modules/organizations/organization.routes';
import { publicRouter, publicAdminRouter } from '@/modules/public/public.routes';
import { decisionRouter } from '@/modules/decisions/decision.routes';
import { analyticsRouter } from '@/modules/analytics/analytics.routes';
import { searchRouter } from '@/modules/search/search.routes';
import { communicationRouter } from '@/modules/communications/communication.routes';
import { deliveryWebhook } from '@/modules/communications/communication.controller';
import { notificationRouter } from '@/modules/notifications/notification.routes';
import { stripeWebhook } from '@/modules/organizations/organization.controller';
import { publicFormLimiter } from '@/middleware/rateLimiters';
import { protect, workspaceAccess } from '@/middleware/authHandler';
import { adminGuard } from '@/middleware/adminGuard';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Message } from '@/modules/candidates/message.model';
import { getAuthUser, organizationFilter } from '@/utils/tenant';
import { renderMetrics } from '@/services/metrics.service';
import { Task } from '@/modules/tasks/task.model';

export function createApp(): Application {
    const app = express();

    if (env.TRUST_PROXY) {
        app.set('trust proxy', 1);
    }

    app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        })
    );
    app.use(
        cors({
            origin(origin, callback) {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error('Not allowed by CORS'));
            },
            credentials: true,
        })
    );
    app.use(express.json({ limit: '8mb' }));
    app.use(express.urlencoded({ extended: true, limit: '8mb' }));

    app.use(requestLogger);

    app.get('/', (_req, res) => {
        res.json({
            success: true,
            data: {
                service: 'RecruitAI API',
                status: 'ok',
                frontend: env.FRONTEND_URL,
                health: '/health/ready',
                documentation: apiDocsEnabled ? '/api/docs' : null,
            },
        });
    });

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
        queues: allQueues.map(queue => new BullMQAdapter(queue)) as any,
        serverAdapter,
    });
    app.use('/admin/queues', protect, adminGuard, serverAdapter.getRouter());

    if (apiDocsEnabled) {
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    }

    app.use('/health', healthRouter);
    app.post('/api/communications/webhook', deliveryWebhook);

    app.get('/metrics', async (req, res) => {
        if (
            env.NODE_ENV === 'production' &&
            req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`
        ) {
            res.status(401).type('text/plain').send('Unauthorized\n');
            return;
        }
        const queueStats = await Promise.all(
            allQueues.map(async (queue, index) => {
                try {
                    return {
                        name: queue.name || `queue-${index}`,
                        waiting: await queue.getWaitingCount(),
                        active: await queue.getActiveCount(),
                        failed: await queue.getFailedCount(),
                    };
                } catch {
                    return {
                        name: queue.name || `queue-${index}`,
                        waiting: 0,
                        active: 0,
                        failed: 0,
                    };
                }
            })
        );
        const [taskFailures, aiFailures] = await Promise.all([
            Task.countDocuments({ status: 'failed' }),
            Task.countDocuments({
                status: 'failed',
                type: { $in: ['scoring', 'outreach', 'interview_analysis'] },
            }),
        ]);
        res.type('text/plain; version=0.0.4').send(
            renderMetrics(queueStats, taskFailures, aiFailures)
        );
    });

    app.use('/api/auth', authRouter);
    app.use('/api/public', publicFormLimiter, publicRouter);
    app.use('/api/admin', protect, adminGuard, publicAdminRouter);

    app.use('/api/stream', streamRouter);

    app.use('/api', protect, workspaceAccess);

    app.use('/api/jobs', jobRouter);
    app.use('/api/jobs/:jobId', evaluationRouter);
    app.use('/api', evaluationAdminRouter);
    app.use('/api/jobs/:jobId', decisionRouter);
    app.use('/api', analyticsRouter);
    app.use('/api', searchRouter);
    app.use('/api', communicationRouter);
    app.use('/api', notificationRouter);
    app.use('/api', organizationRouter);
    app.use('/api/interviews', interviewRouter);
    app.use('/api', fileRouter);
    app.use('/api', reportRouter);
    app.use('/api', collaborationRouter);

    app.get('/api/queue-stats', adminGuard, async (_req, res) => {
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

    app.get('/api/stats/global', async (req, res) => {
        try {
            const tenant = organizationFilter(getAuthUser(req).organizationId);
            const [jobs, candidates] = await Promise.all([
                Job.find({ ...tenant, status: { $ne: 'archived' } }).lean(),
                Candidate.find(tenant).lean(),
            ]);
            const messages = await Message.find({
                role: 'candidate',
                candidateId: { $in: candidates.map(candidate => candidate._id) },
            }).lean();

            const activeJobs = jobs.filter(j => j.status === 'active').length;
            const totalCandidates = candidates.length;

            const contacted = candidates.filter(c =>
                [
                    'contacted',
                    'responded',
                    'interested',
                    'scheduling',
                    'not_interested',
                    'hired',
                ].includes(c.status)
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

    app.use('/api', candidateRouter);
    app.use('/api/tasks', taskRouter);
    app.use('/api/jobs/:jobId/sourcing-tasks', sourcingRouter);

    app.use((_req, res) => {
        res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
    });

    app.use(errorHandler);

    return app;
}
