import { Router, IRouter } from 'express';
import * as controller from './evaluation.controller';

const router: IRouter = Router();
router.get('/scorecard-templates', controller.listTemplates);
router.post('/scorecard-templates', controller.createTemplate);
router.put('/scorecard-templates/:id', controller.updateTemplate);
router.delete('/scorecard-templates/:id', controller.deleteTemplate);
router.post('/jobs/:jobId/scorecard/apply-template', controller.applyTemplate);
router.patch('/evaluations/:id/override', controller.overrideEvaluation);
router.patch('/evaluations/:id/review', controller.reviewEvaluation);
export { router as evaluationAdminRouter };
