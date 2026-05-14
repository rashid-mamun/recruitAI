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
import * as JobService from '../src/modules/jobs/job.service';
import { NotFoundError } from '../src/middleware/errorHandler';

const authToken = jwt.sign({ id: 'user_1', role: 'admin' }, env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
});

const MOCK_JOB = {
    _id: 'job_1',
    title: 'Senior Node.js Engineer',
    description: 'Build scalable APIs for our platform.',
    requirements: ['5+ years Node.js', 'MongoDB', 'Redis'],
    location: 'Remote',
    type: 'full-time',
    status: 'active',
    sourcingQueries: ['senior nodejs engineer remote'],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const VALID_JOB_BODY = {
    title: 'Senior Node.js Engineer',
    description: 'Build scalable APIs for our platform.',
    requirements: ['5+ years Node.js', 'MongoDB'],
    location: 'Remote',
    type: 'full-time',
    status: 'active',
    sourcingQueries: ['senior nodejs engineer remote'],
};

describe('Jobs — POST /api/jobs', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('201 — creates a new job', async () => {
        vi.spyOn(JobService, 'createJob').mockResolvedValue(MOCK_JOB as never);

        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send(VALID_JOB_BODY)
            .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            _id: 'job_1',
            title: 'Senior Node.js Engineer',
            status: 'active',
        });
        expect(JobService.createJob).toHaveBeenCalledOnce();
    });

    it('400 — rejects missing title', async () => {
        const { title: _, ...body } = VALID_JOB_BODY;
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send(body)
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing description', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...VALID_JOB_BODY, description: undefined })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects title shorter than 2 chars', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...VALID_JOB_BODY, title: 'X' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects invalid employment type', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...VALID_JOB_BODY, type: 'freelance' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects invalid status value', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...VALID_JOB_BODY, status: 'archived' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects empty body', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({})
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects unauthenticated request', async () => {
        const res = await request(app).post('/api/jobs').send(VALID_JOB_BODY).expect(401);
        expect(res.body.success).toBe(false);
    });
});

describe('Jobs — GET /api/jobs', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('200 — returns paginated job list', async () => {
        vi.spyOn(JobService, 'listJobs').mockResolvedValue({
            data: [MOCK_JOB],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        } as never);

        const res = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
    });

    it('200 — returns empty list when no jobs exist', async () => {
        vi.spyOn(JobService, 'listJobs').mockResolvedValue({
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        } as never);

        const res = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination.total).toBe(0);
    });

    it('200 — passes page & limit to service', async () => {
        vi.spyOn(JobService, 'listJobs').mockResolvedValue({
            data: [],
            pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
        } as never);

        await request(app)
            .get('/api/jobs?page=2&limit=5')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(JobService.listJobs).toHaveBeenCalledWith(
            expect.objectContaining({ page: 2, limit: 5 })
        );
    });

    it('200 — passes status filter to service', async () => {
        vi.spyOn(JobService, 'listJobs').mockResolvedValue({
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        } as never);

        await request(app)
            .get('/api/jobs?status=active')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(JobService.listJobs).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'active' })
        );
    });

    it('400 — rejects invalid status filter', async () => {
        const res = await request(app)
            .get('/api/jobs?status=invalid_status')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects unauthenticated request', async () => {
        const res = await request(app).get('/api/jobs').expect(401);
        expect(res.body.success).toBe(false);
    });
});

describe('Jobs — GET /api/jobs/:id', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('200 — returns single job', async () => {
        vi.spyOn(JobService, 'getJobById').mockResolvedValue(MOCK_JOB as never);

        const res = await request(app)
            .get('/api/jobs/job_1')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ _id: 'job_1', title: 'Senior Node.js Engineer' });
    });

    it('404 — returns error for non-existent job', async () => {
        vi.spyOn(JobService, 'getJobById').mockRejectedValue(new NotFoundError('Job'));

        const res = await request(app)
            .get('/api/jobs/nonexistent_id')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).get('/api/jobs/job_1').expect(401);
        expect(res.body.success).toBe(false);
    });
});

describe('Jobs — PATCH /api/jobs/:id', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('200 — updates job title', async () => {
        vi.spyOn(JobService, 'updateJob').mockResolvedValue({
            ...MOCK_JOB,
            title: 'Lead Engineer',
        } as never);

        const res = await request(app)
            .patch('/api/jobs/job_1')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ title: 'Lead Engineer' })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.title).toBe('Lead Engineer');
    });

    it('200 — updates status to paused', async () => {
        vi.spyOn(JobService, 'updateJob').mockResolvedValue({
            ...MOCK_JOB,
            status: 'paused',
        } as never);

        const res = await request(app)
            .patch('/api/jobs/job_1')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'paused' })
            .expect(200);

        expect(res.body.data.status).toBe('paused');
    });

    it('404 — returns 404 for non-existent job', async () => {
        vi.spyOn(JobService, 'updateJob').mockRejectedValue(new NotFoundError('Job'));

        const res = await request(app)
            .patch('/api/jobs/nonexistent')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ title: 'Lead Engineer' })
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('400 — rejects invalid status value in update', async () => {
        const res = await request(app)
            .patch('/api/jobs/job_1')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'expired' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).patch('/api/jobs/job_1').send({ title: 'x' }).expect(401);
        expect(res.body.success).toBe(false);
    });
});

describe('Jobs — DELETE /api/jobs/:id', () => {
    const app = createApp();
    beforeEach(() => vi.restoreAllMocks());

    it('200 — deletes job and returns success message', async () => {
        vi.spyOn(JobService, 'deleteJob').mockResolvedValue(undefined);

        const res = await request(app)
            .delete('/api/jobs/job_1')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body).toMatchObject({
            success: true,
            data: { message: 'Job deleted successfully' },
        });
        expect(JobService.deleteJob).toHaveBeenCalledWith('job_1');
    });

    it('404 — returns 404 for non-existent job', async () => {
        vi.spyOn(JobService, 'deleteJob').mockRejectedValue(new NotFoundError('Job'));

        const res = await request(app)
            .delete('/api/jobs/ghost')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).delete('/api/jobs/job_1').expect(401);
        expect(res.body.success).toBe(false);
    });
});
