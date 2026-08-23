import { Router, IRouter } from 'express';
import * as PublicController from './public.controller';

const router: IRouter = Router();

router.post('/demo-requests', PublicController.createDemoRequest);
router.post('/contact', PublicController.createContactRequest);

const adminRouter: IRouter = Router();

adminRouter.get('/demo-requests', PublicController.listPublicLeads);

export { router as publicRouter, adminRouter as publicAdminRouter };
