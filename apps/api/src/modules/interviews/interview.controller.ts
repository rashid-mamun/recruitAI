import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as InterviewService from './interview.service';
import {
    createInterviewSchema,
    interviewQuerySchema,
    transcriptBodySchema,
    updateInterviewSchema,
} from './interview.schema';
import { getAuthUser } from '@/utils/tenant';
import { uploadFileSchema } from '@/modules/files/file.schema';
import * as FileService from '@/modules/files/file.service';
import { Interview } from './interview.model';

export const createInterview = asyncHandler(async (req: Request, res: Response) => {
    const dto = createInterviewSchema.parse(req.body);
    const interview = await InterviewService.createInterview(dto, getAuthUser(req).organizationId);
    res.status(201).json({ success: true, data: interview });
});

export const listInterviews = asyncHandler(async (req: Request, res: Response) => {
    const query = interviewQuerySchema.parse(req.query);
    const auth = getAuthUser(req);
    const result = await InterviewService.listInterviews(query, auth.organizationId, {
        userId: auth.userId,
        role: auth.workspaceRole,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getInterview = asyncHandler(async (req: Request, res: Response) => {
    const result = await InterviewService.getInterviewById(
        req.params.id,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: result });
});

export const updateInterview = asyncHandler(async (req: Request, res: Response) => {
    const dto = updateInterviewSchema.parse(req.body);
    const interview = await InterviewService.updateInterview(
        req.params.id,
        dto,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: interview });
});

export const deleteInterview = asyncHandler(async (req: Request, res: Response) => {
    await InterviewService.deleteInterview(req.params.id, getAuthUser(req).organizationId);
    res.status(204).send();
});

export const replaceTranscript = asyncHandler(async (req: Request, res: Response) => {
    const dto = transcriptBodySchema.parse(req.body);
    const result = await InterviewService.replaceTranscript(
        req.params.id,
        dto,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: result });
});

export const uploadAudio = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const dto = uploadFileSchema.parse({
        ...req.body,
        ownerType: 'interview',
        ownerId: req.params.id,
        kind: 'audio',
    });
    const asset = await FileService.uploadFile(dto, auth.userId, auth.organizationId);
    await Interview.updateOne(
        { _id: req.params.id, organizationId: auth.organizationId },
        { $set: { audioFileId: asset._id } }
    );
    res.status(201).json({ success: true, data: asset });
});

export const analyzeInterview = asyncHandler(async (req: Request, res: Response) => {
    const result = await InterviewService.queueInterviewAnalysis(
        req.params.id,
        getAuthUser(req).organizationId
    );
    res.status(202).json({ success: true, data: result });
});
