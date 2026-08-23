import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { getAuthUser } from '@/utils/tenant';
import { globalSearch } from './search.service';

const schema = z.object({
    q: z.string().trim().min(2).max(200),
    limit: z.coerce.number().int().min(1).max(25).default(8),
});

export const search = asyncHandler(async (req: Request, res: Response) => {
    const query = schema.parse(req.query);
    const data = await globalSearch(getAuthUser(req).organizationId!, query.q, query.limit);
    res.json({ success: true, data });
});
