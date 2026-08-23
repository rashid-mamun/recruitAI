import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { recordAuditLog } from '@/modules/audit/audit.service';
import * as CandidateService from './candidate.service';
import {
    candidateQuerySchema,
    globalCandidateQuerySchema,
    updateCandidateSchema,
    outreachBodySchema,
    responseBodySchema,
    mergeCandidateSchema,
} from './candidate.schema';
import { getAuthUser } from '@/utils/tenant';

/**
 * List candidates for a specific job
 */
export const listCandidates = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const query = candidateQuerySchema.parse(req.query);
    const result = await CandidateService.listCandidates(
        jobId,
        query,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, ...result });
});

/**
 * List ALL candidates across all jobs (global, with filters)
 */
export const listAllCandidates = asyncHandler(async (req: Request, res: Response) => {
    const query = globalCandidateQuerySchema.parse(req.query);
    const result = await CandidateService.listAllCandidates(query, getAuthUser(req).organizationId);
    res.json({
        success: true,
        ...result,
        candidates: result.data,
        total: result.pagination.total,
        page: result.pagination.page,
        pages: result.pagination.totalPages,
    });
});

/**
 * Get candidate by ID
 */
export const getById = asyncHandler(async (req: Request, res: Response) => {
    const candidate = await CandidateService.getCandidateById(
        req.params.id,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: candidate });
});

export const listDuplicates = asyncHandler(async (req: Request, res: Response) => {
    const candidates = await CandidateService.findCandidateDuplicates(
        req.params.id,
        getAuthUser(req).organizationId!
    );
    res.json({ success: true, data: candidates });
});

export const mergeCandidate = asyncHandler(async (req: Request, res: Response) => {
    const { duplicateCandidateId } = mergeCandidateSchema.parse(req.body);
    const candidate = await CandidateService.mergeCandidates(
        req.params.id,
        duplicateCandidateId,
        getAuthUser(req).organizationId!
    );
    await recordAuditLog({
        req,
        action: 'candidate.merged',
        resourceType: 'candidate',
        resourceId: req.params.id,
        after: { duplicateCandidateId },
    });
    res.json({ success: true, data: candidate });
});

export const exportCandidate = asyncHandler(async (req: Request, res: Response) => {
    const data = await CandidateService.exportCandidateData(
        req.params.id,
        getAuthUser(req).organizationId!
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="candidate-${req.params.id}.json"`);
    res.json({ success: true, data });
});

export const deleteCandidate = asyncHandler(async (req: Request, res: Response) => {
    await CandidateService.getCandidateById(req.params.id, getAuthUser(req).organizationId);
    await CandidateService.deleteCandidateData(req.params.id, getAuthUser(req).organizationId!);
    await recordAuditLog({
        req,
        action: 'candidate.privacy_deleted',
        resourceType: 'candidate',
        resourceId: req.params.id,
        before: { existed: true },
        after: { deleted: true },
    });
    res.status(204).send();
});

/**
 * Update candidate fields (status, tags, notes) — PATCH
 */
export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
    const dto = updateCandidateSchema.parse(req.body);
    const before = await CandidateService.getCandidateById(
        req.params.id,
        getAuthUser(req).organizationId
    );
    const candidate = await CandidateService.updateCandidateById(
        req.params.id,
        dto,
        getAuthUser(req).organizationId
    );
    await recordAuditLog({
        req,
        action: 'candidate.updated',
        resourceType: 'candidate',
        resourceId: req.params.id,
        before: {
            status: before.status,
            tags: before.tags,
            notes: before.notes,
            starred: before.starred,
        },
        after: {
            status: candidate.status,
            tags: candidate.tags,
            notes: candidate.notes,
            starred: candidate.starred,
        },
    });
    res.json({ success: true, data: candidate });
});

/**
 * Score a candidate (queue for background job)
 */
export const score = asyncHandler(async (req: Request, res: Response) => {
    const forceRefresh = req.query.refresh === 'true';
    const result = await CandidateService.scoreCandidate(
        req.params.id,
        forceRefresh,
        getAuthUser(req).organizationId
    );

    if ('cached' in result) {
        res.json({ success: true, data: result.score, cached: true });
        return;
    }

    res.status(202).json({ success: true, data: result });
});

/**
 * Send outreach to candidate (queue for background job)
 */
export const sendOutreach = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = outreachBodySchema.parse(req.body);
    const result = await CandidateService.sendOutreach(
        req.params.id,
        jobId,
        getAuthUser(req).organizationId
    );
    res.status(202).json({ success: true, data: result });
});

/**
 * Classify candidate response using AI
 */
export const classifyResponse = asyncHandler(async (req: Request, res: Response) => {
    const { message } = responseBodySchema.parse(req.body);
    const result = await CandidateService.classifyResponse(
        req.params.id,
        message,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: result });
});

/**
 * Get all messages for a candidate
 */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
    const messages = await CandidateService.getCandidateMessages(
        req.params.id,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: messages });
});
