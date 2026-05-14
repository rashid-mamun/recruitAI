import request from 'supertest';
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
import { User } from '../src/modules/auth/user.model';

type MockUser = {
    _id: string;
    name: string;
    email: string;
    role: 'admin' | 'recruiter';
    comparePassword?: (pwd: string) => Promise<boolean>;
};

const VALID_REGISTER_BODY = {
    name: 'Jane Recruiter',
    email: 'jane@example.com',
    password: 'StrongPass!1',
    role: 'recruiter',
};

describe('Auth — POST /api/auth/register', () => {
    const app = createApp();

    beforeEach(() => vi.restoreAllMocks());

    it('201 — creates a user and returns a JWT token', async () => {
        const newUser: MockUser = {
            _id: 'u1',
            name: 'Jane Recruiter',
            email: 'jane@example.com',
            role: 'recruiter',
        };
        vi.spyOn(User, 'findOne').mockResolvedValue(null as never);
        vi.spyOn(User, 'create').mockResolvedValue(newUser as never);

        const res = await request(app)
            .post('/api/auth/register')
            .send(VALID_REGISTER_BODY)
            .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toEqual(expect.any(String));
        expect(res.body.data.user).toMatchObject({
            _id: 'u1',
            email: 'jane@example.com',
            role: 'recruiter',
        });
    });

    it('409 — rejects duplicate email', async () => {
        vi.spyOn(User, 'findOne').mockResolvedValue({ _id: 'existing' } as never);

        const res = await request(app)
            .post('/api/auth/register')
            .send(VALID_REGISTER_BODY)
            .expect(409);

        expect(res.body).toMatchObject({ success: false, code: 'CONFLICT' });
    });

    it('400 — rejects missing name', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'x@x.com', password: 'StrongPass!1' })
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'A', password: 'StrongPass!1' })
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects invalid email format', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_REGISTER_BODY, email: 'not-an-email' })
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects password shorter than 8 chars', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_REGISTER_BODY, password: 'short' })
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects empty body', async () => {
        const res = await request(app).post('/api/auth/register').send({}).expect(400);

        expect(res.body.success).toBe(false);
    });
});

describe('Auth — POST /api/auth/login', () => {
    const app = createApp();

    beforeEach(() => vi.restoreAllMocks());

    it('200 — returns JWT for valid credentials', async () => {
        const mockUser: MockUser = {
            _id: 'u2',
            name: 'Alex',
            email: 'alex@example.com',
            role: 'admin',
            comparePassword: async p => p === 'StrongPass!1',
        };
        vi.spyOn(User, 'findOne').mockReturnValue({
            select: vi.fn().mockResolvedValue(mockUser),
        } as never);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alex@example.com', password: 'StrongPass!1' })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toEqual(expect.any(String));
        expect(res.body.data.user).toMatchObject({ _id: 'u2', role: 'admin' });
    });

    it('401 — rejects wrong password', async () => {
        const mockUser: MockUser = {
            _id: 'u2',
            name: 'Alex',
            email: 'alex@example.com',
            role: 'admin',
            comparePassword: async () => false,
        };
        vi.spyOn(User, 'findOne').mockReturnValue({
            select: vi.fn().mockResolvedValue(mockUser),
        } as never);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alex@example.com', password: 'WrongPass!1' })
            .expect(401);

        expect(res.body.success).toBe(false);
    });

    it('401 — rejects unknown email (user not found)', async () => {
        vi.spyOn(User, 'findOne').mockReturnValue({
            select: vi.fn().mockResolvedValue(null),
        } as never);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'ghost@example.com', password: 'StrongPass!1' })
            .expect(401);

        expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'abc' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'x@x.com' })
            .expect(400);
        expect(res.body.success).toBe(false);
    });

    it('400 — rejects invalid email format', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'not-valid', password: 'StrongPass!1' })
            .expect(400);

        expect(res.body.success).toBe(false);
    });
});

describe('Auth — GET /api/auth/me', () => {
    const app = createApp();

    beforeEach(() => vi.restoreAllMocks());

    it('200 — returns the authenticated user', async () => {
        const mockUser: MockUser = {
            _id: 'u3',
            name: 'Sam',
            email: 'sam@example.com',
            role: 'recruiter',
            comparePassword: async p => p === 'StrongPass!1',
        };

        vi.spyOn(User, 'findOne').mockReturnValue({
            select: vi.fn().mockResolvedValue(mockUser),
        } as never);
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'sam@example.com', password: 'StrongPass!1' });

        vi.spyOn(User, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: 'u3',
                name: 'Sam',
                email: 'sam@example.com',
                role: 'recruiter',
            }),
        } as never);

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${loginRes.body.data.token}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ _id: 'u3', email: 'sam@example.com' });
    });

    it('401 — rejects missing Authorization header', async () => {
        const res = await request(app).get('/api/auth/me').expect(401);
        expect(res.body.success).toBe(false);
    });

    it('401 — rejects malformed Bearer token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer not.a.jwt')
            .expect(401);

        expect(res.body.success).toBe(false);
    });

    it('401 — rejects expired token (manually crafted)', async () => {
        const jwt = await import('jsonwebtoken');
        const expiredToken = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET ?? 'secret', {
            expiresIn: '-1s',
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${expiredToken}`)
            .expect(401);

        expect(res.body.success).toBe(false);
    });
});
