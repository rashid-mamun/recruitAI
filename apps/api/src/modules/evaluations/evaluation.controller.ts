import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as EvaluationService from './evaluation.service';
import {
    compareQuerySchema,
    evaluateCandidateSchema,
    upsertScorecardSchema,
    applyTemplateSchema,
    overrideEvaluationSchema,
    reviewEvaluationSchema,
    scorecardTemplateSchema,
} from './evaluation.schema';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { getAuthUser } from '@/utils/tenant';

function organizationId(req: Request): string {
    return getAuthUser(req).organizationId!;
}

export const getScorecard = asyncHandler(async (req: Request, res: Response) => {
    const scorecard = await EvaluationService.getOrCreateScorecard(
        req.params.jobId,
        organizationId(req)
    );
    res.json({ success: true, data: scorecard });
});

export const upsertScorecard = asyncHandler(async (req: Request, res: Response) => {
    const dto = upsertScorecardSchema.parse(req.body);
    const scorecard = await EvaluationService.upsertScorecard(
        req.params.jobId,
        organizationId(req),
        dto
    );
    res.json({ success: true, data: scorecard });
});

export const evaluateCandidate = asyncHandler(async (req: Request, res: Response) => {
    const dto = evaluateCandidateSchema.parse(req.body);
    const evaluation = await EvaluationService.evaluateCandidate(
        req.params.jobId,
        dto.candidateId,
        organizationId(req)
    );
    res.status(201).json({ success: true, data: evaluation });
});

export const listEvaluations = asyncHandler(async (req: Request, res: Response) => {
    const evaluations = await EvaluationService.listEvaluations(
        req.params.jobId,
        organizationId(req)
    );
    res.json({ success: true, data: evaluations });
});

export const compareCandidates = asyncHandler(async (req: Request, res: Response) => {
    const query = compareQuerySchema.parse(req.query);
    const result = await EvaluationService.compareCandidates(
        req.params.jobId,
        query.candidateIds,
        organizationId(req)
    );
    res.json({ success: true, data: result });
});

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: await EvaluationService.listScorecardTemplates(organizationId(req)),
    });
});
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const data = await EvaluationService.saveScorecardTemplate(
        auth.organizationId!,
        auth.userId!,
        scorecardTemplateSchema.parse(req.body)
    );
    res.status(201).json({ success: true, data });
});
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const data = await EvaluationService.saveScorecardTemplate(
        auth.organizationId!,
        auth.userId!,
        scorecardTemplateSchema.parse(req.body),
        req.params.id
    );
    res.json({ success: true, data });
});
export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    await EvaluationService.deleteScorecardTemplate(organizationId(req), req.params.id);
    res.status(204).send();
});
export const applyTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = applyTemplateSchema.parse(req.body);
    const data = await EvaluationService.applyScorecardTemplate(
        req.params.jobId,
        organizationId(req),
        templateId
    );
    res.json({ success: true, data });
});
export const overrideEvaluation = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const dto = overrideEvaluationSchema.parse(req.body);
    const data = await EvaluationService.overrideEvaluation(
        req.params.id,
        auth.organizationId!,
        auth.userId!,
        dto
    );
    await recordAuditLog({
        req,
        action: 'evaluation.score_overridden',
        resourceType: 'evaluation',
        resourceId: req.params.id,
        after: { competencyId: dto.competencyId, score: dto.score, reason: dto.reason },
    });
    res.json({ success: true, data });
});
export const reviewEvaluation = asyncHandler(async (req: Request, res: Response) => {
    reviewEvaluationSchema.parse(req.body);
    const auth = getAuthUser(req);
    const data = await EvaluationService.reviewEvaluation(
        req.params.id,
        auth.organizationId!,
        auth.userId!
    );
    await recordAuditLog({
        req,
        action: 'evaluation.reviewed',
        resourceType: 'evaluation',
        resourceId: req.params.id,
        after: { reviewStatus: 'reviewed' },
    });
    res.json({ success: true, data });
});
