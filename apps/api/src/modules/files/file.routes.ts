import { Router, type Router as ExpressRouter } from 'express';
import * as FileController from './file.controller';

const router: ExpressRouter = Router();

router.post('/files', FileController.uploadFile);
router.get('/files', FileController.listFiles);
router.get('/files/:fileId/download', FileController.downloadFile);

export { router as fileRouter };
