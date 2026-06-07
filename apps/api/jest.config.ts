export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^uuid$': require.resolve('uuid'),
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/services/ai/providers/openai.provider.ts',
        'src/services/sse.service.ts',
        'src/modules/sourcing/providers/provider.factory.ts',
        'src/modules/auth/auth.routes.ts',
        'src/modules/jobs/job.routes.ts',
    ],
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
    coverageThreshold: {
        global: { lines: 65, functions: 60 },
    },
    setupFiles: ['<rootDir>/src/__tests__/env.setup.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
    testTimeout: 10000,
};
