import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/services/pubsub.service', () => ({
    publishTaskUpdate: vi.fn(),
    startTaskSubscriber: vi.fn(),
    pubClient: { on: vi.fn(), publish: vi.fn() },
    subClient: { on: vi.fn(), subscribe: vi.fn() },
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
import * as TaskService from '../src/modules/tasks/task.service';
import { NotFoundError } from '../src/middleware/errorHandler';

const authToken = jwt.sign({ id: 'u1', role: 'admin' }, env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
});

const TASK_QUEUED = {
    _id: 'task_1',
    type: 'scoring',
    status: 'queued',
    progress: 0,
    result: null,
    error: null,
    bullJobId: null,
    attempts: 0,
    createdAt: new Date().toISOString(),
};
const TASK_PROCESSING = {
    _id: 'task_p',
    type: 'scoring',
    status: 'processing',
    progress: 45,
    result: null,
    error: null,
    bullJobId: 'bull_5',
    attempts: 1,
    createdAt: new Date().toISOString(),
};
const TASK_COMPLETED = {
    _id: 'task_2',
    type: 'outreach',
    status: 'completed',
    progress: 100,
    result: { messageId: 'msg_1', source: 'ai' },
    error: null,
    bullJobId: 'bull_99',
    attempts: 1,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
};
const TASK_FAILED = {
    _id: 'task_3',
    type: 'scoring',
    status: 'failed',
    progress: 30,
    result: null,
    error: 'OpenAI quota exceeded',
    bullJobId: 'bull_88',
    attempts: 3,
    createdAt: new Date().toISOString(),
};

// ── GET /api/tasks/:taskId ─────────
describe('Tasks — GET /api/tasks/:taskId', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('200 — returns a queued task', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_QUEUED as never);

        const res = await request(app)
            .get('/api/tasks/task_1')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            _id: 'task_1',
            type: 'scoring',
            status: 'queued',
            progress: 0,
        });
    });

    it('200 — returns a processing task with progress', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_PROCESSING as never);

        const res = await request(app)
            .get('/api/tasks/task_p')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data.status).toBe('processing');
        expect(res.body.data.progress).toBe(45);
    });

    it('200 — returns a completed task with result payload', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_COMPLETED as never);

        const res = await request(app)
            .get('/api/tasks/task_2')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data.status).toBe('completed');
        expect(res.body.data.progress).toBe(100);
        expect(res.body.data.result).toMatchObject({ messageId: 'msg_1' });
    });

    it('200 — returns a failed task with error message and attempt count', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_FAILED as never);

        const res = await request(app)
            .get('/api/tasks/task_3')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data.status).toBe('failed');
        expect(res.body.data.error).toBe('OpenAI quota exceeded');
        expect(res.body.data.attempts).toBe(3);
    });

    it('404 — returns NOT_FOUND for unknown task', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockRejectedValue(new NotFoundError('Task'));

        const res = await request(app)
            .get('/api/tasks/ghost_task')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({
            success: false,
            code: 'NOT_FOUND',
            error: 'Task not found',
        });
    });

    it('401 — rejects missing auth header', async () => {
        const res = await request(app).get('/api/tasks/task_1').expect(401);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects malformed JWT', async () => {
        const res = await request(app)
            .get('/api/tasks/task_1')
            .set('Authorization', 'Bearer bad.jwt.token')
            .expect(401);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects expired JWT', async () => {
        const jwtLib = await import('jsonwebtoken');
        const expired = jwtLib.sign({ id: 'u1' }, env.JWT_SECRET || 'secret', { expiresIn: '-1s' });

        const res = await request(app)
            .get('/api/tasks/task_1')
            .set('Authorization', `Bearer ${expired}`)
            .expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── GET /api/tasks/:taskId/stream  (SSE) ───
describe('Tasks — GET /api/tasks/:taskId/stream (SSE)', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('sends text/event-stream content-type header', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_COMPLETED as never);

        const res = await request(app)
            .get('/api/tasks/task_2/stream')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('immediately streams and closes for a completed task', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_COMPLETED as never);

        const res = await request(app)
            .get('/api/tasks/task_2/stream')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        // Response body must contain a task_updated event with completed status
        expect(res.text).toContain('event: task_updated');
        expect(res.text).toContain('"status":"completed"');
        expect(res.text).toContain('"progress":100');
    });

    it('immediately streams and closes for a failed task', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_FAILED as never);

        const res = await request(app)
            .get('/api/tasks/task_3/stream')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.text).toContain('event: task_updated');
        expect(res.text).toContain('"status":"failed"');
        expect(res.text).toContain('"error":"OpenAI quota exceeded"');
    });

    it('sends initial DB snapshot for an in-progress task then keeps connection open', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockResolvedValue(TASK_PROCESSING as never);

        // Use supertest's agent to bind a real port, then hit it with http.get so we
        // can read the raw streaming body and disconnect early.
        const http = await import('http');
        const server = app.listen(0); // random free port
        const port = (server.address() as any).port as number;

        const received = await new Promise<string>((resolve, reject) => {
            const req = http.get(
                {
                    host: 'localhost',
                    port,
                    path: '/api/tasks/task_p/stream',
                    headers: { Authorization: `Bearer ${authToken}` },
                },
                res => {
                    let data = '';
                    res.on('data', (chunk: Buffer) => {
                        data += chunk.toString();
                        if (data.includes('task_updated')) {
                            req.destroy(); // disconnect early — don't hang
                            resolve(data);
                        }
                    });
                    res.on('end', () => resolve(data));
                }
            );
            req.on('error', (err: NodeJS.ErrnoException) => {
                // ECONNRESET is expected when we call req.destroy() — treat as success
                if (err.code === 'ECONNRESET') resolve(received ?? '');
                else reject(err);
            });
            setTimeout(() => {
                req.destroy();
                resolve('timeout');
            }, 2000);
        });

        server.close();

        expect(received).toContain('task_updated');
        expect(received).toContain('"status":"processing"');
    }, 8000);

    it('returns JSON 404 for unknown task stream', async () => {
        vi.spyOn(TaskService, 'getTaskById').mockRejectedValue(new NotFoundError('Task'));

        const res = await request(app)
            .get('/api/tasks/ghost_task/stream')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({ success: false, message: 'Task not found' });
    });

    it('401 — rejects unauthenticated stream request', async () => {
        const res = await request(app).get('/api/tasks/task_1/stream').expect(401);
        expect(res.body.success).toBe(false);
    });
});
