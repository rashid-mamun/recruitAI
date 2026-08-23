import request from 'supertest';
import { createApp } from '@/app';
import { User } from '@/modules/auth/user.model';
import axios from 'axios';

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
            expect(res.body.data).toHaveProperty('refreshToken');
            expect(res.body.data.user).toHaveProperty('email', testUser.email);
            expect(res.body.data.user).toHaveProperty('defaultOrganizationId');
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
            expect(res.body.data).toHaveProperty('refreshToken');
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

        it('locks an account after repeated failed login attempts', async () => {
            for (let i = 0; i < 5; i += 1) {
                await request(app).post('/api/auth/login').send({
                    email: testUser.email,
                    password: 'WrongPassword123!',
                });
            }

            const res = await request(app).post('/api/auth/login').send({
                email: testUser.email,
                password: testUser.password,
            });

            expect(res.status).toBe(423);
            expect(res.body.code).toBe('ACCOUNT_LOCKED');
        });
    });

    describe('POST /api/auth/google provider isolation', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('rejects Google sign-in when the verified email belongs to a password account', async () => {
            const email = `provider-conflict-${Date.now()}@example.com`;
            await request(app)
                .post('/api/auth/register')
                .send({
                    ...testUser,
                    email,
                });
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: {
                    sub: 'google-user-one',
                    aud: 'test-google-client-id',
                    email,
                    email_verified: true,
                    name: 'Provider Conflict',
                },
            });

            const res = await request(app)
                .post('/api/auth/google')
                .send({ credential: 'verified-google-credential' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('AUTH_PROVIDER_CONFLICT');
            expect(res.body.error).toContain('password sign-in');
            expect(await User.countDocuments({ email })).toBe(1);
        });

        it('allows the same Google identity to return but rejects duplicate password signup', async () => {
            const email = `google-only-${Date.now()}@example.com`;
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: {
                    sub: 'stable-google-user',
                    aud: 'test-google-client-id',
                    email,
                    email_verified: true,
                    name: 'Google User',
                },
            });

            const firstGoogleLogin = await request(app)
                .post('/api/auth/google')
                .send({ credential: 'first-google-credential' });
            const returningGoogleLogin = await request(app)
                .post('/api/auth/google')
                .send({ credential: 'second-google-credential' });
            const passwordSignup = await request(app)
                .post('/api/auth/register')
                .send({
                    ...testUser,
                    email,
                });

            expect(firstGoogleLogin.status).toBe(200);
            expect(returningGoogleLogin.status).toBe(200);
            expect(passwordSignup.status).toBe(409);
            expect(await User.countDocuments({ email })).toBe(1);
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

    describe('POST /api/auth/refresh and logout', () => {
        it('rotates refresh tokens and rejects replayed tokens', async () => {
            const registerRes = await request(app)
                .post('/api/auth/register')
                .send({
                    ...testUser,
                    email: 'refresh@example.com',
                });
            const firstRefreshToken = registerRes.body.data.refreshToken;

            const refreshRes = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: firstRefreshToken });

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body.data.token).toBeTruthy();
            expect(refreshRes.body.data.refreshToken).toBeTruthy();
            expect(refreshRes.body.data.refreshToken).not.toBe(firstRefreshToken);

            const replayRes = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: firstRefreshToken });

            expect(replayRes.status).toBe(401);
            expect(replayRes.body.code).toBe('INVALID_REFRESH_TOKEN');
        });

        it('revokes a refresh token on logout', async () => {
            const registerRes = await request(app)
                .post('/api/auth/register')
                .send({
                    ...testUser,
                    email: 'logout@example.com',
                });

            const logoutRes = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${registerRes.body.data.token}`)
                .send({ refreshToken: registerRes.body.data.refreshToken });

            expect(logoutRes.status).toBe(200);

            const refreshRes = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: registerRes.body.data.refreshToken });

            expect(refreshRes.status).toBe(401);
        });
    });

    describe('POST /api/auth/password-reset', () => {
        it('issues a development reset token and allows password reset', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    ...testUser,
                    email: 'reset@example.com',
                });

            const requestRes = await request(app)
                .post('/api/auth/password-reset/request')
                .send({ email: 'reset@example.com' });

            expect(requestRes.status).toBe(200);
            expect(requestRes.body.data.message).toContain('If that email exists');
            expect(requestRes.body.data.resetToken).toBeTruthy();

            const confirmRes = await request(app).post('/api/auth/password-reset/confirm').send({
                token: requestRes.body.data.resetToken,
                password: 'NewPassword123!',
            });

            expect(confirmRes.status).toBe(200);

            const loginRes = await request(app).post('/api/auth/login').send({
                email: 'reset@example.com',
                password: 'NewPassword123!',
            });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.data.token).toBeTruthy();
        });

        it('does not reveal unknown reset-request emails', async () => {
            const res = await request(app)
                .post('/api/auth/password-reset/request')
                .send({ email: 'missing@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.data.resetToken).toBeUndefined();
        });
    });
});
