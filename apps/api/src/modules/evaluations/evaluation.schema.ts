import { z } from 'zod';

export const competencySchema = z.object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(''),
    weight: z.coerce.number().min(1).max(100),
});

export const upsertScorecardSchema = z.object({
    name: z.string().trim().min(2).max(160).default('Role Scorecard'),
    competencies: z.array(competencySchema).min(1).max(12),
    passingScore: z.coerce.number().min(0).max(100).default(70),
});
export type UpsertScorecardDto = z.infer<typeof upsertScorecardSchema>;

export const evaluateCandidateSchema = z.object({
    candidateId: z.string().min(1),
});
export type EvaluateCandidateDto = z.infer<typeof evaluateCandidateSchema>;

export const compareQuerySchema = z.object({
    candidateIds: z
        .string()
        .min(1)
        .transform(value =>
            value
                .split(',')
                .map(id => id.trim())
                .filter(Boolean)
        ),
});
export type CompareQueryDto = z.infer<typeof compareQuerySchema>;

export const scorecardTemplateSchema = upsertScorecardSchema.extend({
    roleFamily: z.string().trim().min(2).max(160),
});

export const applyTemplateSchema = z.object({
    templateId: z.string().regex(/^[a-f\d]{24}$/i),
});

export const overrideEvaluationSchema = z.object({
    competencyId: z.string().min(1),
    score: z.number().min(0).max(100),
    reason: z.string().trim().min(3).max(2000),
});

export const reviewEvaluationSchema = z.object({
    reviewStatus: z.literal('reviewed'),
});
