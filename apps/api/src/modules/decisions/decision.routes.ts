import { Router, IRouter } from 'express';
import * as controller from './decision.controller';

const router: IRouter = Router({ mergeParams: true });
router.get('/decisions', controller.list);
router.post('/decisions', controller.create);
export { router as decisionRouter };
