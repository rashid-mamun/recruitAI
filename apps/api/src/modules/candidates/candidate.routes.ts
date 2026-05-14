import { Router, IRouter } from 'express';
import * as CandidateController from './candidate.controller';

const router: IRouter = Router();

// ── Global candidate list (cross-job) ──────
router.get('/candidates', CandidateController.listAllCandidates);

// ── Per-job candidate list ─────────
router.get('/jobs/:jobId/candidates', CandidateController.listCandidates);

// ── Single candidate ─
router.get('/candidates/:id', CandidateController.getById);
router.patch('/candidates/:id', CandidateController.updateCandidate);

// ── Candidate actions
router.post('/candidates/:id/scores', CandidateController.score);
router.post('/candidates/:id/outreach', CandidateController.sendOutreach);
router.post('/candidates/:id/responses', CandidateController.classifyResponse);
router.get('/candidates/:id/messages', CandidateController.getMessages);

export { router as candidateRouter };
