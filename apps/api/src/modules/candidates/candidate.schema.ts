import { z } from 'zod';

const CANDIDATE_STATUSES = [
    'sourced',
    'scored',
    'contacted',
    'responded',
    'scheduling',
    'rejected',
    'new',
    'interested',
    'hired',
    'not_interested',
] as const;

const UPDATE_CANDIDATE_STATUSES = [
    'new',
    'scored',
    'contacted',
    'interested',
    'hired',
    'not_interested',
] as const;

/**
 * Query schema for listing candidates by job
 */
export const candidateQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(CANDIDATE_STATUSES).optional(),
    sort: z
        .enum(['-score', 'score', '-createdAt', 'createdAt', '-updatedAt', 'name'])
        .default('-createdAt'),
    jobId: z.string().optional(),
});
export type CandidateQueryDto = z.infer<typeof candidateQuerySchema>;

/**
 * Query schema for listing ALL candidates (global, cross-job)
 */
export const globalCandidateQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(25),
    jobId: z.string().optional(),
    status: z
        .string()
        .optional()
        .refine(value => {
            if (!value) return true;
            const allowed = new Set(CANDIDATE_STATUSES);
            return value
                .split(',')
                .map(status => status.trim())
                .filter(Boolean)
                .every(status => allowed.has(status as any));
        }, 'Invalid status filter'),
    minScore: z.coerce.number().min(0).max(100).optional(),
    maxScore: z.coerce.number().min(0).max(100).optional(),
    search: z.string().optional(),
    sort: z
        .enum([
            'score_desc',
            'score_asc',
            'name',
            'recent',
            '-score',
            'score',
            '-createdAt',
            'createdAt',
            '-updatedAt',
        ])
        .default('score_desc'),
});
export type GlobalCandidateQueryDto = z.infer<typeof globalCandidateQuerySchema>;

/**
 * Schema for updating a candidate (PATCH)
 */
export const updateCandidateSchema = z
    .object({
        status: z.enum(UPDATE_CANDIDATE_STATUSES).optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        starred: z.boolean().optional(),
    })
    .strict();
export type UpdateCandidateDto = z.infer<typeof updateCandidateSchema>;

/**
 * Body schema for outreach request
 */
export const outreachBodySchema = z.object({
    jobId: z.string().min(1, 'Job ID is required'),
});
export type OutreachBodyDto = z.infer<typeof outreachBodySchema>;

/**
 * Body schema for candidate response classification
 */
export const responseBodySchema = z.object({
    message: z.string().min(1, 'Message is required'),
});
export type ResponseBodyDto = z.infer<typeof responseBodySchema>;
