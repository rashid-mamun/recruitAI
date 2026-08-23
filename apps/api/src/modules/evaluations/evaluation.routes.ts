import { Router, IRouter } from 'express';
import * as EvaluationController from './evaluation.controller';

const router: IRouter = Router({ mergeParams: true });

router.get('/scorecard', EvaluationController.getScorecard);
router.put('/scorecard', EvaluationController.upsertScorecard);
router.get('/evaluations', EvaluationController.listEvaluations);
router.post('/evaluations', EvaluationController.evaluateCandidate);
router.get('/compare', EvaluationController.compareCandidates);

export { router as evaluationRouter };
