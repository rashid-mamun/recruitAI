import { z } from 'zod';

export const resourceParamsSchema = z.object({
    resourceType: z.enum(['candidate', 'interview', 'evaluation', 'report']),
    resourceId: z.string().min(1),
});

export const createCommentSchema = z.object({
    body: z.string().trim().min(1).max(5000),
    visibility: z.enum(['team', 'private']).default('team'),
});
export type CreateCommentDto = z.infer<typeof createCommentSchema>;

export const createReviewSchema = z.object({
    note: z.string().trim().max(5000).default(''),
    assignedTo: z.string().trim().optional().nullable(),
    dueAt: z.coerce.date().optional().nullable(),
});
export type CreateReviewDto = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
    status: z.enum(['open', 'approved', 'changes_requested', 'rejected']).optional(),
    decision: z.enum(['strong_yes', 'yes', 'maybe', 'no']).optional().nullable(),
    note: z.string().trim().max(5000).optional(),
    assignedTo: z.string().trim().optional().nullable(),
    dueAt: z.coerce.date().optional().nullable(),
});
export type UpdateReviewDto = z.infer<typeof updateReviewSchema>;

export const auditQuerySchema = z.object({
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
});
