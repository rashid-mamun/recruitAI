import request from 'supertest';
import { createApp } from '@/app';
import { User } from '@/modules/auth/user.model';

const app = createApp();

describe('Auth Routes (Integration)', () => {
    const testUser = {
        name: 'Integration Test User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'recruiter',
    };

    describe('POST /api/auth/register', () => {
        it('valid body -> 201, returns token + user object', async () => {
            const res = await request(app).post('/api/auth/register').send(testUser);

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('token');
            expect(res.body.data.user).toHaveProperty('email', testUser.email);
            expect(res.body.data.user).not.toHaveProperty('password');
        });

        it('duplicate email -> 409 with error message', async () => {
            await User.create(testUser);

            const res = await request(app).post('/api/auth/register').send(testUser);

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('already exists');
        });

        it('missing fields -> 400 with validation error', async () => {
            const res = await request(app).post('/api/auth/register').send({ email: 'invalid' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await request(app).post('/api/auth/register').send(testUser);
        });

        it('valid credentials -> 200, returns JWT token', async () => {
            const res = await request(app).post('/api/auth/login').send({
                email: testUser.email,
                password: testUser.password,
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('token');
        });

        it('wrong password -> 401', async () => {
            const res = await request(app).post('/api/auth/login').send({
                email: testUser.email,
                password: 'WrongPassword123!',
            });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid credentials');
        });

        it('non-existent user -> 401', async () => {
            const res = await request(app).post('/api/auth/login').send({
                email: 'nobody@example.com',
                password: 'Password123!',
            });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid credentials');
        });
    });

    describe('GET /api/auth/me', () => {
        let token: string;

        beforeEach(async () => {
            const res = await request(app).post('/api/auth/register').send(testUser);
            token = res.body.data.token;
        });

        it('valid token -> 200, returns user data', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('email', testUser.email);
        });

        it('no token -> 401', async () => {
            const res = await request(app).get('/api/auth/me');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('expired/invalid token -> 401', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid.token.here');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
