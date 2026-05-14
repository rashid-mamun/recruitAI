import { Router, Request, Response, IRouter } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { sourcingQueue } from '@/queues';
import { createTask } from '@/modules/tasks/task.service';

const router: IRouter = Router({ mergeParams: true });

const sourcingBodySchema = z.object({
    query: z.string().optional(),
    limit: z.coerce.number().min(1).max(50).default(10),
});

/**
 * @swagger
 * /api/jobs/{jobId}/sourcing-tasks:
 *   post:
 *     summary: Start a candidate sourcing background job
 *     tags: [Sourcing]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               query:  { type: string, example: "Node.js Developer Remote" }
 *               limit:  { type: integer, default: 10 }
 *     responses:
 *       202:
 *         description: Background job queued
 */
router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        const { jobId } = req.params;
        const { query, limit } = sourcingBodySchema.parse(req.body);

        const searchQuery = query ?? `${jobId} developer`;

        const task = await createTask({ type: 'sourcing', jobId });

        await sourcingQueue.add(
            'source-candidates',
            { taskId: task._id.toString(), jobId, query: searchQuery, limit },
            { jobId: task._id.toString() }
        );

        res.status(202).json({
            success: true,
            data: {
                taskId: task._id.toString(),
                status: 'queued',
            },
        });
    })
);

export { router as sourcingRouter };
