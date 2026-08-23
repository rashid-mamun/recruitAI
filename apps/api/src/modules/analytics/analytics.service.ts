import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { HiringDecision } from '@/modules/decisions/hiring-decision.model';

export async function getAnalytics(organizationId: string, jobId?: string) {
    const scope: Record<string, unknown> = { organizationId };
    if (jobId) scope.jobId = jobId;
    const [jobs, candidates, interviews, evaluations, decisions] = await Promise.all([
        Job.find(jobId ? { _id: jobId, organizationId } : { organizationId }).lean(),
        Candidate.find(scope).lean(),
        Interview.find(scope).lean(),
        Evaluation.find(scope).lean(),
        HiringDecision.find(scope).lean(),
    ]);
    const contacted = candidates.filter(candidate => candidate.contactedAt).length;
    const responded = candidates.filter(candidate => candidate.respondedAt).length;
    const completedInterviews = interviews.filter(interview =>
        ['completed', 'analysis_ready', 'reviewed'].includes(interview.status)
    ).length;
    const scores = evaluations.map(item => item.overallScore);
    const shortlistHours = decisions
        .filter(item => item.decision === 'shortlist')
        .map(item => {
            const candidate = candidates.find(
                value => value._id.toString() === item.candidateId.toString()
            );
            return candidate ? (+item.createdAt - +candidate.createdAt) / 3_600_000 : null;
        })
        .filter((value): value is number => value !== null && value >= 0);

    const funnel = Object.fromEntries(
        [
            'new',
            'sourced',
            'scored',
            'contacted',
            'responded',
            'interested',
            'not_interested',
            'rejected',
            'hired',
        ].map(status => [
            status,
            candidates.filter(candidate => candidate.status === status).length,
        ])
    );
    const sourceQuality = Object.values(
        candidates.reduce<
            Record<
                string,
                { source: string; candidates: number; hired: number; averageScore: number }
            >
        >((acc, candidate) => {
            const source = candidate.source || 'unknown';
            acc[source] ??= { source, candidates: 0, hired: 0, averageScore: 0 };
            acc[source].candidates += 1;
            if (candidate.status === 'hired') acc[source].hired += 1;
            acc[source].averageScore += candidate.score?.value ?? 0;
            return acc;
        }, {})
    ).map(item => ({
        ...item,
        averageScore: item.candidates ? Math.round(item.averageScore / item.candidates) : 0,
        hireRate: item.candidates ? Math.round((item.hired / item.candidates) * 100) : 0,
    }));

    return {
        totals: { jobs: jobs.length, candidates: candidates.length, interviews: interviews.length },
        responseRate: contacted ? Math.round((responded / contacted) * 100) : 0,
        interviewCompletionRate: interviews.length
            ? Math.round((completedInterviews / interviews.length) * 100)
            : 0,
        averageScore: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0,
        timeToShortlistHours: shortlistHours.length
            ? Math.round(shortlistHours.reduce((a, b) => a + b, 0) / shortlistHours.length)
            : null,
        scoreDistribution: [
            { range: '0-49', count: scores.filter(score => score < 50).length },
            { range: '50-69', count: scores.filter(score => score >= 50 && score < 70).length },
            { range: '70-84', count: scores.filter(score => score >= 70 && score < 85).length },
            { range: '85-100', count: scores.filter(score => score >= 85).length },
        ],
        funnel,
        sourceQuality,
        decisionCounts: Object.fromEntries(
            ['shortlist', 'hold', 'reject', 'offer', 'hired'].map(value => [
                value,
                decisions.filter(item => item.decision === value).length,
            ])
        ),
    };
}

export function analyticsCsv(data: Awaited<ReturnType<typeof getAnalytics>>): string {
    const rows = [
        ['metric', 'value'],
        ['jobs', data.totals.jobs],
        ['candidates', data.totals.candidates],
        ['interviews', data.totals.interviews],
        ['response_rate', data.responseRate],
        ['interview_completion_rate', data.interviewCompletionRate],
        ['average_score', data.averageScore],
        ['time_to_shortlist_hours', data.timeToShortlistHours ?? ''],
        ...Object.entries(data.funnel).map(([key, value]) => [`funnel_${key}`, value]),
    ];
    return rows
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
}
