import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { getAuthUser } from '@/utils/tenant';
import * as service from './notification.service';

const createSchema = z.object({
    type: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
    link: z.string().max(500).optional(),
});
export const list = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    res.json({
        success: true,
        data: await service.listNotifications(auth.organizationId!, auth.userId!),
    });
});
export const create = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    const dto = createSchema.parse(req.body);
    res.status(201).json({
        success: true,
        data: await service.createNotification({
            organizationId: auth.organizationId!,
            recipientUserId: auth.userId,
            ...dto,
        }),
    });
});
export const read = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    res.json({
        success: true,
        data: await service.markRead(auth.organizationId!, auth.userId!, req.params.id),
    });
});
export const readAll = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    await service.markAllRead(auth.organizationId!, auth.userId!);
    res.json({ success: true, data: { updated: true } });
});
export const clear = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuthUser(req);
    await service.clearNotifications(auth.organizationId!, auth.userId!);
    res.status(204).send();
});
