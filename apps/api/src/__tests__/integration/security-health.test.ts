import request from 'supertest';
import { createApp } from '@/app';
import { allowedOrigins } from '@/config/env';

const app = createApp();

describe('Security and Health Hardening', () => {
    it('GET / identifies the deployed API', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            success: true,
            data: {
                service: 'RecruitAI API',
                status: 'ok',
                health: '/health/ready',
            },
        });
    });

    it('GET /health/live returns liveness metadata', async () => {
        const res = await request(app).get('/health/live');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            status: 'ok',
            environment: 'test',
        });
        expect(res.body.data.uptime).toEqual(expect.any(Number));
    });

    it('GET /health/ready checks MongoDB and Redis', async () => {
        const res = await request(app).get('/health/ready');

        expect([200, 503]).toContain(res.status);
        expect(res.body.data.status).toMatch(/ready|not_ready/);
        expect(typeof res.body.data.checks.mongodb).toBe('boolean');
        expect(typeof res.body.data.checks.redis).toBe('boolean');
        expect(typeof res.body.data.checks.worker).toBe('boolean');
    });

    it('exposes Prometheus-compatible request and queue metrics', async () => {
        await request(app).get('/health/live');
        const res = await request(app).get('/metrics');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.text).toContain('recruitai_http_requests_total');
        expect(res.text).toContain('recruitai_queue_waiting');
    });

    it('sets security headers through Helmet', async () => {
        const res = await request(app).get('/health/live');

        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('allows configured frontend origins through CORS', async () => {
        const origin = allowedOrigins[0];
        const res = await request(app).get('/health/live').set('Origin', origin);

        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe(origin);
    });

    it('rejects unknown browser origins through CORS', async () => {
        const res = await request(app).get('/health/live').set('Origin', 'https://evil.example');

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
            success: false,
            code: 'CORS_NOT_ALLOWED',
        });
    });
});
