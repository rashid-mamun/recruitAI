import { z } from 'zod';

export const createDecisionSchema = z.object({
    candidateId: z.string().regex(/^[a-f\d]{24}$/i),
    decision: z.enum(['shortlist', 'hold', 'reject', 'offer', 'hired']),
    reason: z.string().trim().min(3).max(5000),
    approvedBy: z.string().trim().min(1).nullable().optional(),
});
