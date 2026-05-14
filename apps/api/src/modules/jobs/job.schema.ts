import { z } from 'zod';

export const createJobSchema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    requirements: z.array(z.string()).default([]),
    location: z.string().min(2, 'Location is required'),
    type: z.enum(['full-time', 'part-time', 'contract', 'internship']).default('full-time'),
    status: z.enum(['active', 'paused', 'closed']).default('active'),
    sourcingQueries: z.array(z.string()).default([]),
});

export const updateJobSchema = createJobSchema.partial();

export const jobQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['active', 'paused', 'closed']).optional(),
    search: z.string().optional(),
    sort: z.enum(['createdAt', '-createdAt', 'title', '-title']).default('-createdAt'),
});

export type CreateJobDto = z.infer<typeof createJobSchema>;
export type UpdateJobDto = z.infer<typeof updateJobSchema>;
export type JobQueryDto = z.infer<typeof jobQuerySchema>;
