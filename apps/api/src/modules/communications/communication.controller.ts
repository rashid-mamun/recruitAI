import type { Request, Response } from 'express';
import { asyncHandler, AppError } from '@/middleware/errorHandler';
import { getAuthUser } from '@/utils/tenant';
import { env } from '@/config/env';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { deliveryEventSchema, sendEmailSchema, templateSchema } from './communication.schema';
import * as service from './communication.service';

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: await service.listTemplates(getAuthUser(req).organizationId!),
    });
});
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const data = await service.saveTemplate(
        auth.organizationId!,
        auth.userId!,
        templateSchema.parse(req.body)
    );
    res.status(201).json({ success: true, data });
});
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const data = await service.saveTemplate(
        auth.organizationId!,
        auth.userId!,
        templateSchema.parse(req.body),
        req.params.id
    );
    res.json({ success: true, data });
});
export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    await service.deleteTemplate(getAuthUser(req).organizationId!, req.params.id);
    res.status(204).send();
});
export const sendCandidateEmail = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const data = await service.sendCandidateEmail(
        auth.organizationId!,
        auth.userId!,
        req.params.candidateId,
        sendEmailSchema.parse(req.body)
    );
    await recordAuditLog({
        req,
        action: 'candidate.email_sent',
        resourceType: 'candidate',
        resourceId: req.params.candidateId,
        after: { deliveryId: data._id, status: data.status },
    });
    res.status(201).json({ success: true, data });
});
export const listDeliveries = asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: await service.listDeliveries(
            getAuthUser(req).organizationId!,
            req.params.candidateId
        ),
    });
});
export const deliveryWebhook = asyncHandler(async (req: Request, res: Response) => {
    if (!env.EMAIL_WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== env.EMAIL_WEBHOOK_SECRET) {
        throw new AppError('Invalid webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE');
    }
    const dto = deliveryEventSchema.parse(req.body);
    await service.applyDeliveryEvent(dto.providerMessageId, dto.event, dto.error);
    res.json({ success: true, data: { accepted: true } });
});

export const sendInterviewInvite = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const data = await service.sendInterviewInvite(
        auth.organizationId!,
        auth.userId!,
        req.params.id
    );
    await recordAuditLog({
        req,
        action: 'interview.invite_sent',
        resourceType: 'interview',
        resourceId: req.params.id,
        after: { deliveryId: data.delivery._id },
    });
    res.status(201).json({ success: true, data });
});
