import { Router, IRouter } from 'express';
import * as controller from './communication.controller';

const router: IRouter = Router();
router.get('/communication-templates', controller.listTemplates);
router.post('/communication-templates', controller.createTemplate);
router.put('/communication-templates/:id', controller.updateTemplate);
router.delete('/communication-templates/:id', controller.deleteTemplate);
router.post('/candidates/:candidateId/emails', controller.sendCandidateEmail);
router.get('/candidates/:candidateId/email-deliveries', controller.listDeliveries);
export { router as communicationRouter };
