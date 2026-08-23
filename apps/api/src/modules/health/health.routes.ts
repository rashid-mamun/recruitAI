import { Router, Request, Response, IRouter } from 'express';
import mongoose from 'mongoose';
import { redis } from '@/config/redis';
import { env } from '@/config/env';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: System health and readiness checks
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy
 */
function livenessPayload() {
    return {
        success: true,
        data: {
            status: 'ok',
            uptime: process.uptime(),
            environment: env.NODE_ENV,
            timestamp: new Date().toISOString(),
        },
    };
}

router.get('/', (_req: Request, res: Response) => {
    res.json(livenessPayload());
});

router.get('/live', (_req: Request, res: Response) => {
    res.json(livenessPayload());
});

router.get('/ready', async (_req: Request, res: Response) => {
    const checks = {
        mongodb: false,
        redis: false,
        worker: false,
    };

    try {
        checks.mongodb = mongoose.connection.readyState === 1;
    } catch {
        checks.mongodb = false;
    }

    try {
        const pong = await redis.ping();
        checks.redis = pong === 'PONG';
        checks.worker = Boolean(await redis.get('worker:heartbeat'));
    } catch {
        checks.redis = false;
    }

    const allHealthy =
        checks.mongodb && checks.redis && (env.NODE_ENV !== 'production' || checks.worker);

    res.status(allHealthy ? 200 : 503).json({
        success: allHealthy,
        data: {
            status: allHealthy ? 'ready' : 'not_ready',
            checks,
            uptime: process.uptime(),
            environment: env.NODE_ENV,
            timestamp: new Date().toISOString(),
        },
    });
});

export { router as healthRouter };
