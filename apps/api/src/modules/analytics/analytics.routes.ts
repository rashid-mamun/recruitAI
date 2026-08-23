import { Router, IRouter } from 'express';
import * as controller from './analytics.controller';

const router: IRouter = Router();
router.get('/analytics', controller.get);
router.get('/analytics.csv', controller.csv);
export { router as analyticsRouter };
