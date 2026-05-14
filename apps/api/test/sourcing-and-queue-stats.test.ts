import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/services/pubsub.service', () => ({
    publishTaskUpdate: vi.fn(),
    startTaskSubscriber: vi.fn(),
    pubClient: { on: vi.fn(), publish: vi.fn() },
    subClient: { on: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('../src/queues', () => ({
    sourcingQueue: { add: vi.fn() },
    scoringQueue: { add: vi.fn() },
    outreachQueue: { add: vi.fn() },
    allQueues: [
        {
            name: 'sourcing',
            getWaitingCount: vi.fn(() => Promise.resolve(3)),
            getActiveCount: vi.fn(() => Promise.resolve(1)),
            getCompletedCount: vi.fn(() => Promise.resolve(52)),
            getFailedCount: vi.fn(() => Promise.resolve(2)),
            getDelayedCount: vi.fn(() => Promise.resolve(0)),
        },
        {
            name: 'scoring',
            getWaitingCount: vi.fn(() => Promise.resolve(10)),
            getActiveCount: vi.fn(() => Promise.resolve(5)),
            getCompletedCount: vi.fn(() => Promise.resolve(140)),
            getFailedCount: vi.fn(() => Promise.resolve(7)),
            getDelayedCount: vi.fn(() => Promise.resolve(1)),
        },
        {
            name: 'outreach',
            getWaitingCount: vi.fn(() => Promise.resolve(0)),
            getActiveCount: vi.fn(() => Promise.resolve(0)),
            getCompletedCount: vi.fn(() => Promise.resolve(28)),
            getFailedCount: vi.fn(() => Promise.resolve(0)),
            getDelayedCount: vi.fn(() => Promise.resolve(0)),
        },
    ],
}));

vi.mock('../src/modules/tasks/task.service', () => ({
    createTask: vi.fn(),
    getTaskById: vi.fn(),
    updateTask: vi.fn(),
    markProcessing: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
}));

vi.mock('@bull-board/api', () => ({ createBullBoard: vi.fn() }));
vi.mock('@bull-board/api/bullMQAdapter', () => ({ BullMQAdapter: vi.fn() }));
vi.mock('@bull-board/express', () => ({
    ExpressAdapter: vi.fn().mockImplementation(() => ({
        setBasePath: vi.fn(),
        getRouter: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    })),
}));

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { createTask } from '../src/modules/tasks/task.service';
import { sourcingQueue } from '../src/queues';

const authToken = jwt.sign({ id: 'u1', role: 'admin' }, env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
});
const jobId = '507f1f77bcf86cd799439011';

// ── Sourcing
describe('Sourcing — POST /api/jobs/:jobId/sourcing-tasks', () => {
    const app = createApp();
    beforeEach(() => {
        // Only reset task-service mocks; do NOT clearAllMocks — that would wipe
        // the return values of allQueues' getWaitingCount etc. defined in vi.mock()
        vi.mocked(createTask).mockReset();
        vi.mocked(sourcingQueue.add).mockReset();
    });

    it('202 — queues a sourcing task with default limit', async () => {
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_src1' } as never);

        const res = await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({})
            .expect(202);

        expect(createTask).toHaveBeenCalledWith({ type: 'sourcing', jobId });
        expect(sourcingQueue.add).toHaveBeenCalledWith(
            'source-candidates',
            expect.objectContaining({ taskId: 'task_src1', jobId }),
            expect.objectContaining({ jobId: 'task_src1' })
        );
        expect(res.body).toMatchObject({
            success: true,
            data: { taskId: 'task_src1', status: 'queued' },
        });
    });

    it('202 — queues a sourcing task with custom limit=5', async () => {
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_src2' } as never);

        await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ limit: 5 })
            .expect(202);

        expect(sourcingQueue.add).toHaveBeenCalledWith(
            'source-candidates',
            expect.objectContaining({ limit: 5 }),
            expect.any(Object)
        );
    });

    it('202 — queues a sourcing task with custom query string', async () => {
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_src3' } as never);

        await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ query: 'senior react engineer remote', limit: 10 })
            .expect(202);

        expect(sourcingQueue.add).toHaveBeenCalledWith(
            'source-candidates',
            expect.objectContaining({ query: 'senior react engineer remote', limit: 10 }),
            expect.any(Object)
        );
    });

    it('400 — rejects non-numeric limit', async () => {
        const res = await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ limit: 'ten' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects limit > 50', async () => {
        const res = await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ limit: 999 })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects limit < 1', async () => {
        const res = await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ limit: 0 })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects unauthenticated request', async () => {
        const res = await request(app)
            .post(`/api/jobs/${jobId}/sourcing-tasks`)
            .send({})
            .expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── Queue Stats — PUBLIC endpoint (no auth required)
describe('Queue Stats — GET /api/queue-stats', () => {
    const app = createApp();
    // No need to clearAllMocks — mock fns are stable across tests in this suite

    it('200 — returns stats for all 3 queues', async () => {
        const res = await request(app).get('/api/queue-stats').expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(3);
    });

    it('200 — each stat entry has all required fields', async () => {
        const res = await request(app).get('/api/queue-stats').expect(200);

        for (const stat of res.body.data) {
            expect(stat).toHaveProperty('name');
            expect(stat).toHaveProperty('waiting');
            expect(stat).toHaveProperty('active');
            expect(stat).toHaveProperty('completed');
            expect(stat).toHaveProperty('failed');
            expect(stat).toHaveProperty('delayed');
        }
    });

    it('200 — sourcing queue reports correct counts', async () => {
        const res = await request(app).get('/api/queue-stats').expect(200);

        const sourcing = res.body.data.find((s: any) => s.name === 'sourcing');
        expect(sourcing).toMatchObject({
            waiting: 3,
            active: 1,
            completed: 52,
            failed: 2,
            delayed: 0,
        });
    });

    it('200 — scoring queue reports correct counts', async () => {
        const res = await request(app).get('/api/queue-stats').expect(200);

        const scoring = res.body.data.find((s: any) => s.name === 'scoring');
        expect(scoring).toMatchObject({
            waiting: 10,
            active: 5,
            completed: 140,
            failed: 7,
            delayed: 1,
        });
    });

    it('200 — outreach queue reports correct counts', async () => {
        const res = await request(app).get('/api/queue-stats').expect(200);

        const outreach = res.body.data.find((s: any) => s.name === 'outreach');
        expect(outreach).toMatchObject({ waiting: 0, active: 0, completed: 28, failed: 0 });
    });

    it('200 — is publicly accessible without auth token', async () => {
        // GET /api/queue-stats has no protect middleware (by design — dashboard metrics)
        const res = await request(app).get('/api/queue-stats').expect(200);

        expect(res.body.success).toBe(true);
    });
});
