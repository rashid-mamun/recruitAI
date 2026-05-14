import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as JobService from './job.service';
import { createJobSchema, updateJobSchema, jobQuerySchema } from './job.schema';

export const createJob = asyncHandler(async (req: Request, res: Response) => {
    const dto = createJobSchema.parse(req.body);
    const job = await JobService.createJob(dto);
    res.status(201).json({ success: true, data: job });
});

export const getJobs = asyncHandler(async (req: Request, res: Response) => {
    const query = jobQuerySchema.parse(req.query);
    const result = await JobService.listJobs(query);
    res.json({ success: true, ...result });
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
    const job = await JobService.getJobById(req.params.id);
    res.json({ success: true, data: job });
});

export const updateJob = asyncHandler(async (req: Request, res: Response) => {
    const dto = updateJobSchema.parse(req.body);
    const job = await JobService.updateJob(req.params.id, dto);
    res.json({ success: true, data: job });
});

export const deleteJob = asyncHandler(async (req: Request, res: Response) => {
    await JobService.deleteJob(req.params.id);
    res.json({ success: true, data: { message: 'Job deleted successfully' } });
});

/**
 * GET /api/jobs/:id/stats — pipeline funnel counts
 */
export const getJobStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await JobService.getJobStats(req.params.id);
    res.json({ success: true, data: stats });
});

/**
 * POST /api/jobs/:id/duplicate — clone a job
 */
export const duplicateJob = asyncHandler(async (req: Request, res: Response) => {
    const job = await JobService.duplicateJob(req.params.id);
    res.status(201).json({ success: true, data: job });
});
