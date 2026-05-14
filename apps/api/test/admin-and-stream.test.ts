import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/queues', () => ({
    allQueues: [{ name: 'sourcing' }, { name: 'scoring' }, { name: 'outreach' }],
}));

vi.mock('@bull-board/api', () => ({
    createBullBoard: vi.fn(),
}));

vi.mock('@bull-board/api/bullMQAdapter', () => ({
    BullMQAdapter: vi.fn(),
}));

vi.mock('@bull-board/express', () => ({
    ExpressAdapter: vi.fn().mockImplementation(() => ({
        setBasePath: vi.fn(),
        getRouter: vi.fn(() => (req: any, res: any, next: () => void) => {
            if (res.headersSent) return next();
            res.status(200).json({ success: true, data: { dashboard: 'ok' } });
        }),
    })),
}));

vi.mock('../src/services/sse.service', () => ({
    sse: {
        addClient: vi.fn(),
        broadcast: vi.fn(),
    },
}));

import { createApp } from '../src/app';
import { env } from '../src/config/env';

const adminToken = jwt.sign({ id: 'admin_1', role: 'admin' }, env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d',
});
const recruiterToken = jwt.sign(
    { id: 'recruiter_1', role: 'recruiter' },
    env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '7d' }
);

describe('Admin and stream endpoints', () => {
    const app = createApp();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /admin/queues rejects requests without a token', async () => {
        const res = await request(app).get('/admin/queues').expect(401);

        expect(res.body).toMatchObject({
            success: false,
            error: 'Not authorized to access this route',
        });
    });

    it('GET /admin/queues rejects non-admin users', async () => {
        const res = await request(app)
            .get('/admin/queues')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(403);

        expect(res.body).toMatchObject({
            success: false,
            error: 'Access denied: admin role required',
            code: 'INTERNAL_ERROR',
        });
    });

    it('GET /admin/queues allows admin users', async () => {
        const res = await request(app)
            .get('/admin/queues')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(res.body).toMatchObject({ success: true, data: { dashboard: 'ok' } });
    });

    it('GET /api/stream/events returns an SSE handshake', async () => {
        const res = await request(app)
            .get('/api/stream/events')
            .buffer(true)
            .parse((res, callback) => {
                res.setEncoding('utf8');
                let body = '';
                res.on('data', chunk => {
                    body += chunk;
                    if (body.includes('connected')) {
                        res.destroy();
                        callback(null, body);
                    }
                });
                res.on('error', err => callback(err, ''));
            })
            .timeout({ deadline: 2000 });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(String(res.text ?? res.body)).toContain('connected');
    });
});
