import { Router, Request, Response, IRouter } from 'express';

const router: IRouter = Router();

// Generic events endpoint (kept for backwards compat, main SSE is at /api/tasks/:taskId/stream)
router.get('/events', (_req: Request, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    res.write(`data: {"connected": true}\n\n`);
    // No client registration needed — consumers should use /api/tasks/:taskId/stream
});

export { router as streamRouter };
