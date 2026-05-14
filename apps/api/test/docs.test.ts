import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';

describe('Docs endpoint', () => {
    const app = createApp();

    it('GET /api/docs serves Swagger UI', async () => {
        const res = await request(app).get('/api/docs/').expect(200);

        expect(res.headers['content-type']).toContain('text/html');
        expect(res.text).toContain('id="swagger-ui"');
    });
});
