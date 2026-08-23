import { z } from 'zod';

const INTERVIEW_TYPES = ['screening', 'technical', 'behavioral', 'system_design', 'final'] as const;
const INTERVIEW_STATUSES = [
    'draft',
    'scheduled',
    'completed',
    'analyzing',
    'analysis_ready',
    'reviewed',
    'cancelled',
] as const;

export const createInterviewSchema = z.object({
    jobId: z.string().min(1, 'Job ID is required'),
    candidateId: z.string().min(1, 'Candidate ID is required'),
    title: z.string().min(2).max(180),
    round: z.string().max(80).default('Round 1'),
    type: z.enum(INTERVIEW_TYPES).default('technical'),
    status: z.enum(INTERVIEW_STATUSES).default('draft'),
    scheduledAt: z.coerce.date().optional().nullable(),
    durationMinutes: z.coerce.number().min(0).max(600).optional().nullable(),
    interviewerNames: z.array(z.string().trim().min(1).max(80)).default([]),
    interviewerIds: z
        .array(z.string().regex(/^[a-f\d]{24}$/i))
        .max(30)
        .default([]),
    notes: z.string().max(20000).default(''),
    transcriptText: z.string().max(200000).optional(),
});
export type CreateInterviewDto = z.infer<typeof createInterviewSchema>;

export const updateInterviewSchema = createInterviewSchema
    .omit({ jobId: true, candidateId: true })
    .partial()
    .strict();
export type UpdateInterviewDto = z.infer<typeof updateInterviewSchema>;

export const interviewQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(25),
    jobId: z.string().optional(),
    candidateId: z.string().optional(),
    status: z.enum(INTERVIEW_STATUSES).optional(),
    sort: z.enum(['-createdAt', 'createdAt', '-updatedAt', 'scheduledAt']).default('-createdAt'),
});
export type InterviewQueryDto = z.infer<typeof interviewQuerySchema>;

export const transcriptBodySchema = z.object({
    transcriptText: z.string().min(1, 'Transcript text is required').max(200000),
});
export type TranscriptBodyDto = z.infer<typeof transcriptBodySchema>;
