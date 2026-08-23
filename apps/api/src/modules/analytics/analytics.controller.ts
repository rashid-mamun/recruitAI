import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { getAuthUser } from '@/utils/tenant';
import { analyticsCsv, getAnalytics } from './analytics.service';
import { z } from 'zod';

const querySchema = z.object({
    jobId: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
});

export const get = asyncHandler(async (req: Request, res: Response) => {
    const query = querySchema.parse(req.query);
    const data = await getAnalytics(getAuthUser(req).organizationId!, query.jobId);
    res.json({ success: true, data });
});

export const csv = asyncHandler(async (req: Request, res: Response) => {
    const query = querySchema.parse(req.query);
    const data = await getAnalytics(getAuthUser(req).organizationId!, query.jobId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="recruitai-analytics.csv"');
    res.send(analyticsCsv(data));
});
