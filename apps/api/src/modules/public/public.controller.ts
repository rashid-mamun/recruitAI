import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { demoRequestQuerySchema, publicLeadSchema } from './public.schema';
import * as PublicService from './public.service';

export const createDemoRequest = asyncHandler(async (req: Request, res: Response) => {
    const dto = publicLeadSchema.parse(req.body);
    const lead = await PublicService.createPublicLead(req, 'demo', dto);
    res.status(201).json({ success: true, data: lead });
});

export const createContactRequest = asyncHandler(async (req: Request, res: Response) => {
    const dto = publicLeadSchema.parse(req.body);
    const lead = await PublicService.createPublicLead(req, 'contact', dto);
    res.status(201).json({ success: true, data: lead });
});

export const listPublicLeads = asyncHandler(async (req: Request, res: Response) => {
    const query = demoRequestQuerySchema.parse(req.query);
    const result = await PublicService.listPublicLeads(query);
    res.json({ success: true, ...result });
});
