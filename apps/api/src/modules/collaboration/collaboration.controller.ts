import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { listAuditLogs } from '@/modules/audit/audit.service';
import * as CollaborationService from './collaboration.service';
import {
    auditQuerySchema,
    createCommentSchema,
    createReviewSchema,
    resourceParamsSchema,
    updateReviewSchema,
} from './collaboration.schema';
import { getAuthUser } from '@/utils/tenant';
import { createNotification } from '@/modules/notifications/notification.service';

export const listComments = asyncHandler(async (req: Request, res: Response) => {
    const params = resourceParamsSchema.parse(req.params);
    const comments = await CollaborationService.listComments(
        params.resourceType,
        params.resourceId,
        getAuthUser(req).organizationId!
    );
    res.json({ success: true, data: comments });
});

export const createComment = asyncHandler(async (req: Request, res: Response) => {
    const params = resourceParamsSchema.parse(req.params);
    const dto = createCommentSchema.parse(req.body);
    const comment = await CollaborationService.createComment(
        req,
        params.resourceType,
        params.resourceId,
        dto
    );
    res.status(201).json({ success: true, data: comment });
});

export const listReviews = asyncHandler(async (req: Request, res: Response) => {
    const params = resourceParamsSchema.parse(req.params);
    const reviews = await CollaborationService.listReviews(
        params.resourceType,
        params.resourceId,
        getAuthUser(req).organizationId!
    );
    res.json({ success: true, data: reviews });
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
    const params = resourceParamsSchema.parse(req.params);
    const dto = createReviewSchema.parse(req.body);
    const review = await CollaborationService.createReview(
        req,
        params.resourceType,
        params.resourceId,
        dto
    );
    if (dto.assignedTo) {
        await createNotification({
            organizationId: getAuthUser(req).organizationId!,
            recipientUserId: dto.assignedTo,
            type: 'review_assigned',
            message: `A ${params.resourceType} review was assigned to you`,
            link:
                params.resourceType === 'candidate'
                    ? `/candidates/${params.resourceId}`
                    : undefined,
        });
    }
    res.status(201).json({ success: true, data: review });
});

export const updateReview = asyncHandler(async (req: Request, res: Response) => {
    const dto = updateReviewSchema.parse(req.body);
    const review = await CollaborationService.updateReview(req, req.params.reviewId, dto);
    res.json({ success: true, data: review });
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = auditQuerySchema.parse(req.query);
    const logs = await listAuditLogs({
        ...query,
        organizationId: getAuthUser(req).organizationId!,
    });
    res.json({ success: true, data: logs });
});
