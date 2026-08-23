import { Candidate } from '@/modules/candidates/candidate.model';
import { Job } from '@/modules/jobs/job.model';
import { InterviewAnalysis } from '@/modules/interviews/interview-analysis.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { evaluateCandidate } from '@/modules/evaluations/evaluation.service';
import { NotFoundError } from '@/middleware/errorHandler';
import { CandidateReport } from './candidate-report.model';
import type { ICandidateReport, IEvaluation } from '@/types';
import { organizationObjectId } from '@/utils/tenant';
import puppeteer from 'puppeteer';

export async function generateCandidateReport(
    candidateId: string,
    organizationId: string,
    generatedBy?: string
): Promise<ICandidateReport> {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
    if (!candidate) throw new NotFoundError('Candidate');

    const jobId = (candidate as any).jobId.toString();
    const job = await Job.findOne({ _id: jobId, organizationId }).lean();
    if (!job) throw new NotFoundError('Job');

    let evaluation = (await Evaluation.findOne({
        candidateId,
        jobId,
        organizationId,
    }).lean()) as IEvaluation | null;

    if (!evaluation) {
        evaluation = await evaluateCandidate(jobId, candidateId, organizationId);
    }

    const analyses = await InterviewAnalysis.find({
        candidateId,
        jobId,
        organizationId,
        status: 'completed',
    })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    const interviewHighlights = analyses
        .flatMap(analysis => [
            (analysis as any).executiveSummary,
            ...((analysis as any).technicalSignals ?? []),
            ...((analysis as any).behavioralSignals ?? []),
            ...((analysis as any).communicationSignals ?? []),
        ])
        .filter(Boolean)
        .slice(0, 10);

    const strengths = [
        ...((candidate as any).score?.strengths ?? []),
        ...evaluation.competencyScores
            .filter(item => (item.humanOverrideScore ?? item.score) >= 75)
            .map(item => `${item.name}: ${item.humanOverrideScore ?? item.score}/100`),
    ].slice(0, 8);

    const risks = [
        ...((candidate as any).score?.weaknesses ?? []),
        ...evaluation.competencyScores
            .filter(item => (item.humanOverrideScore ?? item.score) < 55)
            .map(item => `${item.name}: ${item.humanOverrideScore ?? item.score}/100`),
        ...analyses.flatMap(analysis => (analysis as any).riskFlags ?? []),
    ].slice(0, 8);

    const title = `${(candidate as any).name} - ${(job as any).title} Candidate Report`;
    const executiveSummary = buildExecutiveSummary(candidate, job, evaluation);
    const reportMarkdown = buildMarkdownReport({
        title,
        candidate,
        job,
        evaluation,
        executiveSummary,
        strengths,
        risks,
        interviewHighlights,
    });

    const report = await CandidateReport.create({
        organizationId: organizationObjectId(organizationId),
        jobId,
        candidateId,
        evaluationId: evaluation._id,
        title,
        status: 'generated',
        executiveSummary,
        scorecardSnapshot: evaluation.competencyScores,
        interviewHighlights,
        strengths,
        risks,
        recommendation: evaluation.recommendation,
        overallScore: evaluation.overallScore,
        reportMarkdown,
        generatedBy,
        humanReviewStatus: evaluation.reviewStatus ?? 'pending',
        reviewedBy: evaluation.reviewedBy ?? null,
    });

    return report.toJSON() as unknown as ICandidateReport;
}

export async function listCandidateReports(
    candidateId: string,
    organizationId: string
): Promise<ICandidateReport[]> {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    return (await CandidateReport.find({ candidateId, organizationId })
        .sort({ createdAt: -1 })
        .lean()) as unknown as ICandidateReport[];
}

export async function getReportById(
    reportId: string,
    organizationId: string
): Promise<ICandidateReport> {
    const report = await CandidateReport.findOne({ _id: reportId, organizationId }).lean();
    if (!report) throw new NotFoundError('Report');
    return report as unknown as ICandidateReport;
}

export async function getReportText(
    reportId: string,
    organizationId: string
): Promise<{
    filename: string;
    content: string;
}> {
    const report = await getReportById(reportId, organizationId);
    return {
        filename: `${safeFilename(report.title)}.md`,
        content: report.reportMarkdown,
    };
}

export async function getReportPdf(
    reportId: string,
    organizationId: string
): Promise<{ filename: string; content: Buffer }> {
    const report = await getReportById(reportId, organizationId);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setContent(markdownReportHtml(report.title, report.reportMarkdown), {
            waitUntil: 'networkidle0',
        });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
        });
        return {
            filename: `${safeFilename(report.title)}.pdf`,
            content: Buffer.from(pdf),
        };
    } finally {
        await browser.close();
    }
}

function markdownReportHtml(title: string, markdown: string): string {
    const body = escapeHtml(markdown)
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^[-] (.+)$/gm, '<div class="item">• $1</div>')
        .replace(/\n/g, '<br>');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font:14px/1.55 Arial,sans-serif;color:#172033}h1{color:#5b21b6;border-bottom:3px solid #7c3aed;padding-bottom:10px}h2{margin-top:24px;color:#312e81}.item{margin:4px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:7px}</style>
</head><body>${body}</body></html>`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return entities[character];
    });
}

function buildExecutiveSummary(candidate: any, job: any, evaluation: IEvaluation): string {
    return `${candidate.name} scored ${evaluation.overallScore}/100 for ${job.title} with a ${evaluation.recommendation.replace(
        '_',
        ' '
    )} recommendation. ${evaluation.summary}`;
}

function buildMarkdownReport({
    title,
    candidate,
    job,
    evaluation,
    executiveSummary,
    strengths,
    risks,
    interviewHighlights,
}: {
    title: string;
    candidate: any;
    job: any;
    evaluation: IEvaluation;
    executiveSummary: string;
    strengths: string[];
    risks: string[];
    interviewHighlights: string[];
}): string {
    const competencyRows = evaluation.competencyScores
        .map(
            item =>
                `| ${escapePipe(item.name)} | ${item.humanOverrideScore ?? item.score} | ${item.weight}% | ${escapePipe(
                    item.rationale
                )}${item.humanOverrideReason ? ` Human override: ${escapePipe(item.humanOverrideReason)}` : ''} |`
        )
        .join('\n');

    return `# ${title}

## Executive Summary

${executiveSummary}

## Candidate

- Name: ${candidate.name}
- Headline: ${candidate.headline || 'N/A'}
- Location: ${candidate.location || 'N/A'}
- Source: ${candidate.source || 'N/A'}

## Role

- Title: ${job.title}
- Location: ${job.location}
- Requirements: ${(job.requirements ?? []).join(', ') || 'N/A'}

## Recommendation

- Overall Score: ${evaluation.overallScore}/100
- Recommendation: ${evaluation.recommendation.replace('_', ' ')}
- Evaluation Source: ${evaluation.source}
- Human Review: ${evaluation.reviewStatus ?? 'pending'}

## Scorecard

| Competency | Score | Weight | Rationale |
| --- | ---: | ---: | --- |
${competencyRows}

## Strengths

${listOrFallback(strengths)}

## Risks

${listOrFallback(risks)}

## Interview Highlights

${listOrFallback(interviewHighlights)}
`;
}

function listOrFallback(items: string[]): string {
    if (!items.length) return '- No items captured yet.';
    return items.map(item => `- ${item}`).join('\n');
}

function escapePipe(value: string): string {
    return value.replace(/\|/g, '\\|');
}

function safeFilename(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 90);
}
