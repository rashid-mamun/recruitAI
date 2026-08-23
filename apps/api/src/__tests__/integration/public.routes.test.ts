import request from 'supertest';
import { createApp } from '@/app';
import { DemoRequest } from '@/modules/public/demo-request.model';
import { User } from '@/modules/auth/user.model';

const app = createApp();

describe('Public Lead Routes', () => {
    const validLead = {
        name: 'Maya Smith',
        email: 'maya@example.com',
        company: 'Acme Hiring',
        role: 'Head of Talent',
        message: 'We want to evaluate candidates from interview transcripts.',
        sourcePage: '/',
    };

    it('accepts demo requests without authentication', async () => {
        const res = await request(app).post('/api/public/demo-requests').send(validLead);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            type: 'demo',
            email: 'maya@example.com',
            status: 'new',
        });

        const saved = await DemoRequest.findOne({ email: 'maya@example.com' }).lean();
        expect(saved?.type).toBe('demo');
    });

    it('accepts contact messages without authentication', async () => {
        const res = await request(app)
            .post('/api/public/contact')
            .send({ ...validLead, email: 'contact@example.com' });

        expect(res.status).toBe(201);
        expect(res.body.data.type).toBe('contact');
    });

    it('rejects invalid public payloads', async () => {
        const res = await request(app).post('/api/public/demo-requests').send({
            name: 'A',
            email: 'not-email',
            message: 'short',
        });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            code: 'VALIDATION_ERROR',
        });
    });

    it('allows admins, but not recruiters, to list public leads', async () => {
        await request(app).post('/api/public/demo-requests').send(validLead);

        const recruiterRes = await request(app).post('/api/auth/register').send({
            name: 'Recruiter',
            email: 'lead-recruiter@example.com',
            password: 'Password123!',
            role: 'recruiter',
        });

        const denied = await request(app)
            .get('/api/admin/demo-requests')
            .set('Authorization', `Bearer ${recruiterRes.body.data.token}`);

        expect(denied.status).toBe(403);

        await request(app).post('/api/auth/register').send({
            name: 'Admin',
            email: 'lead-admin@example.com',
            password: 'Password123!',
        });
        await User.updateOne({ email: 'lead-admin@example.com' }, { $set: { role: 'admin' } });
        const adminLogin = await request(app).post('/api/auth/login').send({
            email: 'lead-admin@example.com',
            password: 'Password123!',
        });

        const listed = await request(app)
            .get('/api/admin/demo-requests?type=demo')
            .set('Authorization', `Bearer ${adminLogin.body.data.token}`);

        expect(listed.status).toBe(200);
        expect(listed.body.success).toBe(true);
        expect(listed.body.data).toHaveLength(1);
        expect(listed.body.pagination.total).toBe(1);
    });
});
