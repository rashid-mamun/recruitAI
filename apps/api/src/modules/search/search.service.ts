import { Candidate } from '@/modules/candidates/candidate.model';
import { Job } from '@/modules/jobs/job.model';
import { Interview } from '@/modules/interviews/interview.model';
import { TranscriptSegment } from '@/modules/interviews/transcript-segment.model';
import { CandidateReport } from '@/modules/reports/candidate-report.model';

export async function globalSearch(organizationId: string, query: string, limit = 8) {
    const pattern = new RegExp(escapeRegex(query), 'i');
    const [candidates, jobs, interviews, reports] = await Promise.all([
        Candidate.find({
            organizationId,
            $or: [
                { name: pattern },
                { email: pattern },
                { headline: pattern },
                { notes: pattern },
                { tags: pattern },
                { skills: pattern },
            ],
        })
            .select('name headline email jobId')
            .limit(limit)
            .lean(),
        Job.find({
            organizationId,
            $or: [{ title: pattern }, { description: pattern }, { requirements: pattern }],
        })
            .select('title status location')
            .limit(limit)
            .lean(),
        Interview.find({
            organizationId,
            $or: [{ title: pattern }, { notes: pattern }, { transcriptText: pattern }],
        })
            .select('title candidateId jobId status transcriptText')
            .limit(limit)
            .lean(),
        CandidateReport.find({
            organizationId,
            $or: [{ title: pattern }, { executiveSummary: pattern }, { reportMarkdown: pattern }],
        })
            .select('title candidateId jobId executiveSummary')
            .limit(limit)
            .lean(),
    ]);
    const interviewIds = interviews.map(interview => interview._id);
    const transcriptSegments = interviewIds.length
        ? await TranscriptSegment.find({ interviewId: { $in: interviewIds }, text: pattern })
              .select('interviewId speaker text startTime')
              .limit(limit)
              .lean()
        : [];
    return { candidates, jobs, interviews, transcriptSegments, reports };
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
