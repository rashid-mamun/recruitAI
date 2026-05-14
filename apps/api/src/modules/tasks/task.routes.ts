import { Router, Request, Response, IRouter } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { getTaskById } from './task.service';
import { sse } from '@/services/sse.service';
import { logger } from '@/config/logger';

const router: IRouter = Router();

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   get:
 *     summary: Get background task status
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task status
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   properties:
 *                     _id: { type: string }
 *                     type: { type: string }
 *                     status: { type: string, enum: [queued, processing, completed, failed] }
 *                     progress: { type: number }
 *                     result: { type: object }
 *                     error: { type: string }
 *       404:
 *         description: Task not found
 */
router.get(
    '/:taskId',
    asyncHandler(async (req: Request, res: Response) => {
        const task = await getTaskById(req.params.taskId);
        res.json({ success: true, data: task });
    })
);

/**
 * @swagger
 * /api/tasks/{taskId}/stream:
 *   get:
 *     summary: Server-Sent Events stream for real-time task progress
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: SSE stream of task_updated events
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/:taskId/stream', async (req: Request, res: Response) => {
    const { taskId } = req.params;

    let task;
    try {
        task = await getTaskById(taskId);
    } catch {
        res.status(404).json({ success: false, message: 'Task not found' });
        return;
    }

    // If already terminal, respond with final state immediately (no SSE needed)
    if (task.status === 'completed' || task.status === 'failed') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.flushHeaders?.();
        res.write(`event: task_updated\ndata: ${JSON.stringify(task)}\n\n`);
        res.end();
        return;
    }

    // Open SSE connection
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering if proxied
    });
    res.flushHeaders?.();

    // Immediately send the current DB snapshot so the frontend can render initial state
    res.write(`event: task_updated\ndata: ${JSON.stringify(task)}\n\n`);

    // Register this client for live push updates via Redis Pub/Sub
    sse.addClient(taskId, res);

    // Heartbeat to keep the connection alive through proxies
    const ping = setInterval(() => {
        res.write(`event: ping\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
    }, 25_000);

    req.on('close', () => {
        clearInterval(ping);
        logger.debug('SSE client disconnected', { taskId });
    });
});

export { router as taskRouter };
