import { Router, Request, Response, IRouter } from 'express';
import mongoose from 'mongoose';
import { redis } from '@/config/redis';

const router: IRouter = Router();

router.get('/', (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        },
    });
});

router.get('/ready', async (_req: Request, res: Response) => {
    const checks = {
        mongodb: false,
        redis: false,
    };

    try {
        checks.mongodb = mongoose.connection.readyState === 1;
    } catch {
        checks.mongodb = false;
    }

    try {
        const pong = await redis.ping();
        checks.redis = pong === 'PONG';
    } catch {
        checks.redis = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);

    res.status(allHealthy ? 200 : 503).json({
        success: allHealthy,
        data: {
            status: allHealthy ? 'ready' : 'not_ready',
            checks,
            timestamp: new Date().toISOString(),
        },
    });
});

export { router as healthRouter };
