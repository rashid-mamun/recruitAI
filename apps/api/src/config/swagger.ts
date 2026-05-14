import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Recruiting Automation API',
            version: '1.0.0',
            description:
                'AI-powered recruiting automation system — manages jobs, sources candidates, scores them with AI, and automates outreach.',
            contact: {
                name: 'API Support',
                email: 'dev@recruiting.ai',
            },
        },
        servers: [{ url: `http://localhost:${env.PORT}`, description: 'Development server' }],
        components: {
            schemas: {
                Job: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        requirements: { type: 'array', items: { type: 'string' } },
                        location: { type: 'string' },
                        type: {
                            type: 'string',
                            enum: ['full-time', 'part-time', 'contract', 'internship'],
                        },
                        status: { type: 'string', enum: ['active', 'paused', 'closed'] },
                        sourcingQueries: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Candidate: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        jobId: { type: 'string' },
                        name: { type: 'string' },
                        linkedinUrl: { type: 'string' },
                        headline: { type: 'string' },
                        status: { type: 'string' },
                        score: {
                            type: 'object',
                            properties: {
                                value: { type: 'number' },
                                reasoning: { type: 'string' },
                                strengths: { type: 'array', items: { type: 'string' } },
                                weaknesses: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },
                },
                Task: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        type: { type: 'string', enum: ['sourcing', 'scoring', 'outreach'] },
                        status: {
                            type: 'string',
                            enum: ['queued', 'processing', 'completed', 'failed'],
                        },
                        progress: { type: 'number', minimum: 0, maximum: 100 },
                        result: { type: 'object' },
                        error: { type: 'string' },
                    },
                },
                ApiSuccess: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: { type: 'object' },
                    },
                },
                ApiError: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string' },
                        code: { type: 'string' },
                    },
                },
            },
        },
    },
    apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
