import { vi } from 'vitest';

vi.mock('ioredis', () => {
    class MockRedis {
        constructor() {}
        on() {}
        async ping() {
            return 'PONG';
        }
        async get() {
            return null;
        }
        async set() {
            return 'OK';
        }
        async del() {
            return 0;
        }
        async keys() {
            return [];
        }
    }
    return { default: MockRedis };
});

// Mock mongoose minimally: set connection.readyState default to 1 in tests
vi.mock('mongoose', async () => {
    const actual = await vi.importActual('mongoose');
    return {
        ...actual,
        connection: {
            readyState: 1,
        },
    };
});
