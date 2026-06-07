import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { User } from '@/modules/auth/user.model';
import { sourcingQueue } from '@/queues';

const app = createApp();

describe('Jobs Routes (Integration)', () => {
    let token: string;

    const testJob = {
        title: 'Senior Node.js Developer',
        description: 'Looking for a great developer to join our team.',
        location: 'Remote',
        requirements: ['Node.js', 'TypeScript', 'MongoDB'],
    };

    beforeAll(async () => {
        // Register a user and capture JWT token
        const res = await request(app).post('/api/auth/register').send({
            name: 'Job Tester',
            email: 'jobs@example.com',
            password: 'Password123!',
            role: 'recruiter',
        });
        token = res.body.data.token;
    });

    describe('POST /api/jobs', () => {
        it('valid job body + auth -> 201, returns created job with _id', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('Authorization', `Bearer ${token}`)
                .send(testJob);

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.title).toBe(testJob.title);
        });

        it('no auth -> 401', async () => {
            const res = await request(app).post('/api/jobs').send(testJob);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('missing required fields -> 400', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Missing fields' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('GET /api/jobs', () => {
        beforeEach(async () => {
            await Job.create(testJob);
        });

        it('with auth -> 200, returns array', async () => {
            const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/jobs/:id', () => {
        let createdJobId: string;

        beforeEach(async () => {
            const job = await Job.create(testJob);
            createdJobId = job._id.toString();
        });

        it('valid id + auth -> 200, returns job object', async () => {
            const res = await request(app)
                .get(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data._id).toBe(createdJobId);
        });

        it('non-existent id -> 404', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .get(`/api/jobs/${fakeId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/jobs/:jobId/sourcing-tasks', () => {
        let createdJobId: string;

        beforeEach(async () => {
            const job = await Job.create(testJob);
            createdJobId = job._id.toString();
        });

        it('valid jobId + auth -> 202, returns taskId + status "queued"', async () => {
            const res = await request(app)
                .post(`/api/jobs/${createdJobId}/sourcing-tasks`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    query: 'Node.js Developer',
                    limit: 10,
                });

            expect(res.status).toBe(202);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('taskId');
            expect(res.body.data.status).toBe('queued');

            // Verify mock was called
            expect(sourcingQueue.add).toHaveBeenCalled();
        });
    });
});
