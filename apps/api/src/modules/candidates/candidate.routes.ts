import { Router, IRouter } from 'express';
import * as CandidateController from './candidate.controller';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Candidates
 *   description: Candidate management and AI processing
 */

/**
 * @swagger
 * /api/candidates:
 *   get:
 *     summary: List all candidates across all jobs
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all candidates
 */
router.get('/candidates', CandidateController.listAllCandidates);

/**
 * @swagger
 * /api/jobs/{jobId}/candidates:
 *   get:
 *     summary: List candidates for a specific job
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of candidates for the job
 */
router.get('/jobs/:jobId/candidates', CandidateController.listCandidates);

/**
 * @swagger
 * /api/candidates/{id}:
 *   get:
 *     summary: Get a specific candidate by ID
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Candidate details
 *       404:
 *         description: Candidate not found
 */
router.get('/candidates/:id', CandidateController.getById);

/**
 * @swagger
 * /api/candidates/{id}:
 *   patch:
 *     summary: Update a candidate's information
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Candidate updated
 *       404:
 *         description: Candidate not found
 */
router.patch('/candidates/:id', CandidateController.updateCandidate);

/**
 * @swagger
 * /api/candidates/{id}/scores:
 *   post:
 *     summary: Score a candidate against their job's requirements using AI
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Candidate score response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Score'
 *       404:
 *         description: Candidate not found
 */
router.post('/candidates/:id/scores', CandidateController.score);

/**
 * @swagger
 * /api/candidates/{id}/outreach:
 *   post:
 *     summary: Generate and queue personalized outreach for a candidate
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Background task queued for outreach generation
 *       404:
 *         description: Candidate not found
 */
router.post('/candidates/:id/outreach', CandidateController.sendOutreach);

/**
 * @swagger
 * /api/candidates/{id}/responses:
 *   post:
 *     summary: Simulate and classify a candidate reply
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Candidate intent classification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IntentResult'
 *       404:
 *         description: Candidate not found
 */
router.post('/candidates/:id/responses', CandidateController.classifyResponse);

/**
 * @swagger
 * /api/candidates/{id}/messages:
 *   get:
 *     summary: Get all messages (outreach & replies) for a candidate
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of messages
 *       404:
 *         description: Candidate not found
 */
router.get('/candidates/:id/messages', CandidateController.getMessages);

export { router as candidateRouter };
