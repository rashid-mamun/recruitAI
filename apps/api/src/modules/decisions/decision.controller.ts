import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { getAuthUser } from '@/utils/tenant';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { createDecisionSchema } from './decision.schema';
import * as service from './decision.service';
import { createNotification } from '@/modules/notifications/notification.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const dto = createDecisionSchema.parse(req.body);
    const decision = await service.createDecision(
        req.params.jobId,
        auth.organizationId!,
        auth.userId!,
        dto
    );
    await recordAuditLog({
        req,
        action: 'hiring_decision.created',
        resourceType: 'candidate',
        resourceId: dto.candidateId,
        after: { decision: dto.decision, reason: dto.reason },
    });
    await createNotification({
        organizationId: auth.organizationId!,
        recipientUserId: auth.userId,
        type: 'decision_changed',
        message: `Decision changed to ${dto.decision}`,
        link: `/candidates/${dto.candidateId}`,
    });
    res.status(201).json({ success: true, data: decision });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
    const decisions = await service.listDecisions(
        req.params.jobId,
        getAuthUser(req).organizationId!
    );
    res.json({ success: true, data: decisions });
});
