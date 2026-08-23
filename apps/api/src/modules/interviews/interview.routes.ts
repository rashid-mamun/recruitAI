import { Router, IRouter } from 'express';
import * as InterviewController from './interview.controller';
import { sendInterviewInvite } from '@/modules/communications/communication.controller';
import type { Request, Response, NextFunction } from 'express';
import { Interview } from './interview.model';
import { getAuthUser } from '@/utils/tenant';
import { NotFoundError } from '@/middleware/errorHandler';

const router: IRouter = Router();
const assignedGuard = (req: Request, _res: Response, next: NextFunction) => {
    const auth = getAuthUser(req);
    if (auth.workspaceRole !== 'interviewer') return next();
    void Interview.exists({
        _id: req.params.id,
        organizationId: auth.organizationId,
        interviewerIds: auth.userId,
    })
        .then(exists => (exists ? next() : next(new NotFoundError('Assigned interview'))))
        .catch(next);
};

/**
 * @swagger
 * tags:
 *   name: Interviews
 *   description: Interview records, transcripts, and AI analysis
 */

router.post('/', InterviewController.createInterview);
router.get('/', InterviewController.listInterviews);
router.get('/:id', assignedGuard, InterviewController.getInterview);
router.patch('/:id', assignedGuard, InterviewController.updateInterview);
router.delete('/:id', assignedGuard, InterviewController.deleteInterview);
router.post('/:id/transcript', assignedGuard, InterviewController.replaceTranscript);
router.post('/:id/audio', assignedGuard, InterviewController.uploadAudio);
router.post('/:id/analyze', assignedGuard, InterviewController.analyzeInterview);
router.post('/:id/invite', assignedGuard, sendInterviewInvite);

export { router as interviewRouter };
