import { Router, IRouter } from 'express';
import * as controller from './notification.controller';
const router: IRouter = Router();
router.get('/notifications', controller.list);
router.post('/notifications', controller.create);
router.patch('/notifications/read-all', controller.readAll);
router.patch('/notifications/:id/read', controller.read);
router.delete('/notifications', controller.clear);
export { router as notificationRouter };
