import request from 'supertest';
import { describe, it, expect } from 'vitest';

// Import after mocks from setup (vitest setupFiles handles this)
import { createApp } from '../src/app';
import mongoose from 'mongoose';

describe('Health endpoints', () => {
    const app = createApp();

    it('GET /health should return 200 and ok status', async () => {
        const res = await request(app).get('/health').expect(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('status', 'ok');
    });

    it('GET /health/ready should return 200 when dependencies are healthy', async () => {
        // Ensure mongoose connection state is marked as ready for the readiness probe
        // (the test setup mocks mongoose but some modules may override connection)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        mongoose.connection.readyState = 1;

        const res = await request(app).get('/health/ready').expect(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.data).toHaveProperty('status', 'ready');
        expect(res.body.data.checks).toHaveProperty('mongodb', true);
        expect(res.body.data.checks).toHaveProperty('redis', true);
    });
});
