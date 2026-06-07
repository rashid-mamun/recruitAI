import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import mockBullMQ from './__mocks__/bullmq.mock';
import mockRedis from './__mocks__/ioredis.mock';

// Mock BullMQ completely
jest.mock('bullmq', () => mockBullMQ);

// Mock ioredis
jest.mock('ioredis', () => mockRedis);

jest.mock('p-retry', () => jest.fn(fn => fn()));

// Mock external AI/email services
jest.mock('@/config/ai', () => ({
    openai: {
        chat: {
            completions: {
                create: jest.fn(),
            },
        },
    },
    geminiModel: {
        generateContent: jest.fn(),
    },
    geminiJsonModel: {
        generateContent: jest.fn(),
    },
}));

jest.mock('@/services/email.service', () => ({
    sendTaskCompletedEmail: jest.fn(),
    sendTaskFailedEmail: jest.fn(),
}));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
    jest.clearAllMocks();
});
