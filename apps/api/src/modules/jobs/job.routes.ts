import { Router, IRouter } from 'express';
import * as JobController from './job.controller';

const router: IRouter = Router();

router.post('/', JobController.createJob);
router.get('/', JobController.getJobs);
router.get('/:id', JobController.getJob);
router.patch('/:id', JobController.updateJob);
router.delete('/:id', JobController.deleteJob);
router.get('/:id/stats', JobController.getJobStats);
router.post('/:id/duplicate', JobController.duplicateJob);

export { router as jobRouter };
