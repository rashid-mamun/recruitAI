import { Router, IRouter } from 'express';
import * as ReportController from './report.controller';

const router: IRouter = Router();

router.post('/candidates/:candidateId/reports', ReportController.generateCandidateReport);
router.get('/candidates/:candidateId/reports', ReportController.listCandidateReports);
router.get('/reports/:reportId', ReportController.getReport);
router.get('/reports/:reportId/download', ReportController.downloadReport);
router.get('/reports/:reportId/pdf', ReportController.downloadReportPdf);

export { router as reportRouter };
