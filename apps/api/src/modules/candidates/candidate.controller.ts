import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as CandidateService from './candidate.service';
import {
    candidateQuerySchema,
    globalCandidateQuerySchema,
    updateCandidateSchema,
    outreachBodySchema,
    responseBodySchema,
} from './candidate.schema';

/**
 * List candidates for a specific job
 */
export const listCandidates = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const query = candidateQuerySchema.parse(req.query);
    const result = await CandidateService.listCandidates(jobId, query);
    res.json({ success: true, ...result });
});

/**
 * List ALL candidates across all jobs (global, with filters)
 */
export const listAllCandidates = asyncHandler(async (req: Request, res: Response) => {
    const query = globalCandidateQuerySchema.parse(req.query);
    const result = await CandidateService.listAllCandidates(query);
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
    const candidate = await CandidateService.getCandidateById(req.params.id);
    res.json({ success: true, data: candidate });
});

/**
 * Update candidate fields (status, tags, notes) — PATCH
 */
export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
    const dto = updateCandidateSchema.parse(req.body);
    const candidate = await CandidateService.updateCandidateById(req.params.id, dto);
    res.json({ success: true, data: candidate });
});

/**
 * Score a candidate (queue for background job)
 */
export const score = asyncHandler(async (req: Request, res: Response) => {
    const forceRefresh = req.query.refresh === 'true';
    const result = await CandidateService.scoreCandidate(req.params.id, forceRefresh);

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
    const result = await CandidateService.sendOutreach(req.params.id, jobId);
    res.status(202).json({ success: true, data: result });
});

/**
 * Classify candidate response using AI
 */
export const classifyResponse = asyncHandler(async (req: Request, res: Response) => {
    const { message } = responseBodySchema.parse(req.body);
    const result = await CandidateService.classifyResponse(req.params.id, message);
    res.json({ success: true, data: result });
});

/**
 * Get all messages for a candidate
 */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
    const messages = await CandidateService.getCandidateMessages(req.params.id);
    res.json({ success: true, data: messages });
});
