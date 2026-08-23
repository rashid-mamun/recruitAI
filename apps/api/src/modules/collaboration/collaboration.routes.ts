import { Router, IRouter } from 'express';
import * as CollaborationController from './collaboration.controller';
import { requireWorkspaceRoles } from '@/middleware/authHandler';

const router: IRouter = Router();

router.get(
    '/collaboration/:resourceType/:resourceId/comments',
    CollaborationController.listComments
);
router.post(
    '/collaboration/:resourceType/:resourceId/comments',
    CollaborationController.createComment
);
router.get('/collaboration/:resourceType/:resourceId/reviews', CollaborationController.listReviews);
router.post(
    '/collaboration/:resourceType/:resourceId/reviews',
    CollaborationController.createReview
);
router.patch('/collaboration/reviews/:reviewId', CollaborationController.updateReview);
router.get(
    '/audit-logs',
    requireWorkspaceRoles('owner', 'admin'),
    CollaborationController.getAuditLogs
);

export { router as collaborationRouter };
