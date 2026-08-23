import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as ReportService from './report.service';
import { getAuthUser } from '@/utils/tenant';
import { createNotification } from '@/modules/notifications/notification.service';

export const generateCandidateReport = asyncHandler(async (req: Request, res: Response) => {
    const report = await ReportService.generateCandidateReport(
        req.params.candidateId,
        getAuthUser(req).organizationId!,
        getAuthUser(req).userId
    );
    const auth = getAuthUser(req);
    await createNotification({
        organizationId: auth.organizationId!,
        recipientUserId: auth.userId,
        type: 'report_generated',
        message: 'Candidate report generated',
        link: `/candidates/${req.params.candidateId}`,
    });
    res.status(201).json({ success: true, data: report });
});

export const listCandidateReports = asyncHandler(async (req: Request, res: Response) => {
    const reports = await ReportService.listCandidateReports(
        req.params.candidateId,
        getAuthUser(req).organizationId!
    );
    res.json({ success: true, data: reports });
});

export const getReport = asyncHandler(async (req: Request, res: Response) => {
    const report = await ReportService.getReportById(
        req.params.reportId,
        getAuthUser(req).organizationId!
    );
    res.json({ success: true, data: report });
});

export const downloadReport = asyncHandler(async (req: Request, res: Response) => {
    const { filename, content } = await ReportService.getReportText(
        req.params.reportId,
        getAuthUser(req).organizationId!
    );
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
});

export const downloadReportPdf = asyncHandler(async (req: Request, res: Response) => {
    const { filename, content } = await ReportService.getReportPdf(
        req.params.reportId,
        getAuthUser(req).organizationId!
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
});
