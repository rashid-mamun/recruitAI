import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Must mock pubsub before app loads (it registers Redis clients at module init) ──
vi.mock('../src/services/pubsub.service', () => ({
    publishTaskUpdate: vi.fn(),
    startTaskSubscriber: vi.fn(),
    pubClient: { on: vi.fn(), publish: vi.fn() },
    subClient: { on: vi.fn(), subscribe: vi.fn() },
}));

// ── Hoist mocks before app import ──
vi.mock('../src/config/redis', () => ({
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
    cacheDel: vi.fn(),
    cacheDelPattern: vi.fn(),
    CacheKeys: {
        candidates: (jobId: string, page: number) => `candidates:${jobId}:page:${page}`,
        score: (cId: string, jId: string) => `score:${cId}:${jId}`,
        job: (id: string) => `job:${id}`,
    },
    CacheTTL: { CANDIDATES: 120, SCORE: 86400, SCORE_FALLBACK: 3600 },
    redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
    bullRedis: {},
}));

vi.mock('../src/services/ai/ai.factory', () => ({
    AiFactory: {
        getProvider: vi.fn(() => ({
            generateScoring: vi.fn(),
            generateOutreach: vi.fn(),
            classifyIntent: vi.fn(),
        })),
    },
}));

vi.mock('../src/services/pubsub.service', () => ({
    publishTaskUpdate: vi.fn(),
    startTaskSubscriber: vi.fn(),
    pubClient: { on: vi.fn(), publish: vi.fn() },
    subClient: { on: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('../src/queues', () => ({
    scoringQueue: { add: vi.fn() },
    outreachQueue: { add: vi.fn() },
    allQueues: [{ name: 'sourcing' }, { name: 'scoring' }, { name: 'outreach' }],
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
import { Candidate } from '../src/modules/candidates/candidate.model';
import { Message } from '../src/modules/candidates/message.model';
import { cacheGet, cacheDel } from '../src/config/redis';
import { createTask } from '../src/modules/tasks/task.service';
import { scoringQueue, outreachQueue } from '../src/queues';
import { AiFactory } from '../src/services/ai/ai.factory';

// ── Fixtures
const authToken = jwt.sign({ id: 'u1', role: 'admin' }, env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
});
const jobId = '507f1f77bcf86cd799439011';
const candidateId = '507f191e810c19729de860ea';

const MOCK_CANDIDATE = {
    _id: candidateId,
    jobId: { toString: () => jobId },
    name: 'Jane Doe',
    linkedinUrl: 'https://linkedin.com/in/janedoe',
    headline: 'Senior Node.js Engineer',
    summary: 'Builds scalable distributed systems.',
    skills: ['Node.js', 'TypeScript', 'MongoDB'],
    experience: '7 years',
    location: 'Remote',
    source: 'serper',
    status: 'sourced',
    outreachMessages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockCandidateFindById = (overrides = {}) =>
    vi.spyOn(Candidate, 'findById').mockReturnValue({
        lean: vi.fn().mockResolvedValue({ ...MOCK_CANDIDATE, ...overrides }),
    } as never);

// ── List Candidates ──
describe('Candidates — GET /api/jobs/:jobId/candidates', () => {
    const app = createApp();
    beforeEach(() => vi.clearAllMocks());

    it('200 — returns paginated list', async () => {
        vi.mocked(cacheGet).mockResolvedValue(null);
        const findChain = {
            sort: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([MOCK_CANDIDATE]),
        };
        vi.spyOn(Candidate, 'find').mockReturnValue(findChain as never);
        vi.spyOn(Candidate, 'countDocuments').mockResolvedValue(1 as never);

        const res = await request(app)
            .get(`/api/jobs/${jobId}/candidates`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
    });

    it('200 — returns empty list when no candidates exist', async () => {
        vi.mocked(cacheGet).mockResolvedValue(null);
        const findChain = {
            sort: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([]),
        };
        vi.spyOn(Candidate, 'find').mockReturnValue(findChain as never);
        vi.spyOn(Candidate, 'countDocuments').mockResolvedValue(0 as never);

        const res = await request(app)
            .get(`/api/jobs/${jobId}/candidates`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination.total).toBe(0);
    });

    it('200 — serves from cache on cache hit', async () => {
        const cached = {
            data: [MOCK_CANDIDATE],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        };
        vi.mocked(cacheGet).mockResolvedValue(cached);
        const findSpy = vi.spyOn(Candidate, 'find');

        const res = await request(app)
            .get(`/api/jobs/${jobId}/candidates`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(findSpy).not.toHaveBeenCalled();
    });

    it('200 — filters by status=scored', async () => {
        vi.mocked(cacheGet).mockResolvedValue(null);
        const findChain = {
            sort: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([]),
        };
        vi.spyOn(Candidate, 'find').mockReturnValue(findChain as never);
        vi.spyOn(Candidate, 'countDocuments').mockResolvedValue(0 as never);

        await request(app)
            .get(`/api/jobs/${jobId}/candidates?status=scored`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(Candidate.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'scored' }));
    });

    it('401 — rejects unauthenticated request', async () => {
        const res = await request(app).get(`/api/jobs/${jobId}/candidates`).expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── Get Candidate by ID ───────────
describe('Candidates — GET /api/candidates/:id', () => {
    const app = createApp();
    beforeEach(() => vi.clearAllMocks());

    it('200 — returns a candidate', async () => {
        mockCandidateFindById();

        const res = await request(app)
            .get(`/api/${candidateId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ _id: candidateId, name: 'Jane Doe' });
    });

    it('404 — returns 404 for unknown candidate', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as never);

        const res = await request(app)
            .get(`/api/${candidateId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).get(`/api/${candidateId}`).expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── Score Candidate ──
describe('Candidates — POST /api/candidates/:id/scores', () => {
    const app = createApp();
    beforeEach(() => vi.clearAllMocks());

    it('202 — queues a scoring task (no cache)', async () => {
        mockCandidateFindById();
        vi.mocked(cacheGet).mockResolvedValue(null);
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_s1' } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/scores`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(202);

        expect(createTask).toHaveBeenCalledWith({ type: 'scoring', jobId, candidateId });
        expect(scoringQueue.add).toHaveBeenCalledWith(
            'score-candidate',
            expect.objectContaining({ taskId: 'task_s1', candidateId }),
            expect.any(Object)
        );
        expect(res.body).toMatchObject({
            success: true,
            data: { taskId: 'task_s1', status: 'queued' },
        });
    });

    it('200 — returns cached score when not force-refreshing', async () => {
        mockCandidateFindById();
        const cachedScore = {
            value: 85,
            reasoning: 'Great fit',
            strengths: [],
            weaknesses: [],
            source: 'ai',
            cachedAt: new Date().toISOString(),
        };
        vi.mocked(cacheGet).mockResolvedValue(cachedScore);

        const res = await request(app)
            .post(`/api/${candidateId}/scores`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        // The endpoint returns the score directly from cache (no re-queuing)
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ value: 85, source: 'ai', reasoning: 'Great fit' });
        expect(createTask).not.toHaveBeenCalled();
    });

    it('202 — bypasses cache when refresh=true', async () => {
        mockCandidateFindById();
        vi.mocked(cacheGet).mockResolvedValue({ value: 85, source: 'ai' });
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_s2' } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/scores?refresh=true`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(202);

        expect(createTask).toHaveBeenCalledOnce();
        expect(res.body.data.status).toBe('queued');
    });

    it('202 — deletes stale fallback cache before re-queuing', async () => {
        mockCandidateFindById();
        vi.mocked(cacheGet).mockResolvedValue({
            value: 50,
            source: 'fallback',
            cachedAt: new Date(),
        });
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_s3' } as never);

        await request(app)
            .post(`/api/${candidateId}/scores`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(202);

        expect(cacheDel).toHaveBeenCalledWith(`score:${candidateId}:${jobId}`);
        expect(createTask).toHaveBeenCalledOnce();
    });

    it('404 — returns 404 for unknown candidate', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/scores`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).post(`/api/${candidateId}/scores`).expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── Outreach
describe('Candidates — POST /api/candidates/:id/outreach', () => {
    const app = createApp();
    beforeEach(() => vi.clearAllMocks());

    it('202 — queues an outreach task', async () => {
        mockCandidateFindById();
        vi.mocked(createTask).mockResolvedValue({ _id: 'task_o1' } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/outreach`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ jobId })
            .expect(202);

        expect(createTask).toHaveBeenCalledWith({ type: 'outreach', jobId, candidateId });
        expect(outreachQueue.add).toHaveBeenCalledWith(
            'send-outreach',
            { taskId: 'task_o1', candidateId, jobId },
            { jobId: 'task_o1' }
        );
        expect(res.body).toMatchObject({
            success: true,
            data: { taskId: 'task_o1', status: 'queued' },
        });
    });

    it('400 — rejects missing jobId body', async () => {
        const res = await request(app)
            .post(`/api/${candidateId}/outreach`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({})
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('404 — returns 404 for unknown candidate', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/outreach`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ jobId })
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).post(`/api/${candidateId}/outreach`).expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── Classify Response
describe('Candidates — POST /api/candidates/:id/responses', () => {
    const app = createApp();
    beforeEach(() => vi.clearAllMocks());

    const mockContactedCandidate = {
        ...MOCK_CANDIDATE,
        status: 'contacted',
        outreachMessages: ['msg_1'],
    };

    it('200 — classifies "interested" intent and sets status=scheduling', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockContactedCandidate),
        } as never);
        vi.mocked(AiFactory.getProvider).mockReturnValue({
            generateScoring: vi.fn(),
            generateOutreach: vi.fn(),
            classifyIntent: vi.fn().mockResolvedValue({
                intent: 'interested',
                confidence: 0.95,
                reason: 'Wants to call',
            }),
        } as never);
        vi.spyOn(Candidate, 'findByIdAndUpdate').mockResolvedValue({} as never);
        vi.spyOn(Message, 'findByIdAndUpdate').mockResolvedValue({} as never);

        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: 'Yes, I am very interested!' })
            .expect(200);

        expect(res.body).toMatchObject({
            success: true,
            data: { intent: 'interested', candidateStatus: 'scheduling' },
        });
        expect(res.body.data.schedulingLink).toContain(candidateId);
        expect(Candidate.findByIdAndUpdate).toHaveBeenCalledWith(candidateId, {
            $set: { status: 'scheduling' },
        });
    });

    it('200 — classifies "not_interested" intent and sets status=rejected', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockContactedCandidate),
        } as never);
        vi.mocked(AiFactory.getProvider).mockReturnValue({
            generateScoring: vi.fn(),
            generateOutreach: vi.fn(),
            classifyIntent: vi.fn().mockResolvedValue({
                intent: 'not_interested',
                confidence: 0.88,
                reason: 'Not looking',
            }),
        } as never);
        vi.spyOn(Candidate, 'findByIdAndUpdate').mockResolvedValue({} as never);
        vi.spyOn(Message, 'findByIdAndUpdate').mockResolvedValue({} as never);

        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: 'No thanks, I am not looking for a new role.' })
            .expect(200);

        expect(res.body).toMatchObject({
            success: true,
            data: { intent: 'not_interested', candidateStatus: 'rejected' },
        });
        expect(res.body.data.schedulingLink).toBeNull();
    });

    it('200 — classifies "maybe" intent and keeps status unchanged', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockContactedCandidate),
        } as never);
        vi.mocked(AiFactory.getProvider).mockReturnValue({
            generateScoring: vi.fn(),
            generateOutreach: vi.fn(),
            classifyIntent: vi
                .fn()
                .mockResolvedValue({ intent: 'maybe', confidence: 0.6, reason: 'Wants details' }),
        } as never);
        vi.spyOn(Candidate, 'findByIdAndUpdate').mockResolvedValue({} as never);
        vi.spyOn(Message, 'findByIdAndUpdate').mockResolvedValue({} as never);

        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: 'Can you share more details about the role?' })
            .expect(200);

        expect(res.body.data.intent).toBe('maybe');
        expect(res.body.data.candidateStatus).toBe('contacted'); // unchanged
    });

    it('500 — returns error when AI provider is unavailable and no keyword fallback is defined', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockContactedCandidate),
        } as never);
        vi.mocked(AiFactory.getProvider).mockReturnValue({
            generateScoring: vi.fn(),
            generateOutreach: vi.fn(),
            classifyIntent: vi.fn().mockRejectedValue(new Error('429 Quota Exhausted')),
        } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: 'yes I am very interested' })
            .expect(500);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects empty message', async () => {
        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: '' })
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing message field', async () => {
        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({})
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('404 — returns 404 for unknown candidate', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as never);

        const res = await request(app)
            .post(`/api/${candidateId}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: 'Yes I am interested' })
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).post(`/api/${candidateId}/responses`).expect(401);
        expect(res.body.success).toBe(false);
    });
});

// ── Get Messages ─────
describe('Candidates — GET /api/candidates/:id/messages', () => {
    const app = createApp();
    beforeEach(() => vi.clearAllMocks());

    it('200 — returns list of outreach messages', async () => {
        mockCandidateFindById({ status: 'contacted', outreachMessages: ['msg_1'] });
        vi.spyOn(Message, 'find').mockReturnValue({
            sort: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([
                {
                    _id: 'msg_1',
                    candidateId,
                    content: 'Hey Jane!',
                    channel: 'linkedin',
                    status: 'sent',
                    source: 'ai',
                },
            ]),
        } as never);

        const res = await request(app)
            .get(`/api/${candidateId}/messages`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({ _id: 'msg_1', status: 'sent' });
    });

    it('200 — returns empty array when no messages sent', async () => {
        mockCandidateFindById();
        vi.spyOn(Message, 'find').mockReturnValue({
            sort: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([]),
        } as never);

        const res = await request(app)
            .get(`/api/${candidateId}/messages`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(res.body.data).toHaveLength(0);
    });

    it('404 — returns 404 for unknown candidate', async () => {
        vi.spyOn(Candidate, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as never);

        const res = await request(app)
            .get(`/api/${candidateId}/messages`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('401 — rejects unauthenticated', async () => {
        const res = await request(app).get(`/api/${candidateId}/messages`).expect(401);
        expect(res.body.success).toBe(false);
    });
});
