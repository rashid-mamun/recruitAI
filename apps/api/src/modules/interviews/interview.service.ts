import mongoose from 'mongoose';
import { Interview } from './interview.model';
import { TranscriptSegment } from './transcript-segment.model';
import { InterviewAnalysis } from './interview-analysis.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Job } from '@/modules/jobs/job.model';
import { createTask } from '@/modules/tasks/task.service';
import { interviewAnalysisQueue } from '@/queues';
import { NotFoundError } from '@/middleware/errorHandler';
import { organizationFilter, organizationObjectId } from '@/utils/tenant';
import { FileAsset } from '@/modules/files/file-asset.model';
import { Task } from '@/modules/tasks/task.model';
import type {
    CreateInterviewDto,
    InterviewQueryDto,
    TranscriptBodyDto,
    UpdateInterviewDto,
} from './interview.schema';
import type {
    IInterview,
    IInterviewAnalysis,
    ITranscriptSegment,
    PaginatedResponse,
} from '@/types';

export async function createInterview(
    dto: CreateInterviewDto,
    organizationId?: string
): Promise<IInterview> {
    const [candidate, job] = await Promise.all([
        Candidate.findOne({ _id: dto.candidateId, ...organizationFilter(organizationId) }).lean(),
        Job.findOne({ _id: dto.jobId, ...organizationFilter(organizationId) }).lean(),
    ]);
    if (!candidate) throw new NotFoundError('Candidate');
    if (!job) throw new NotFoundError('Job');
    if ((candidate as any).jobId.toString() !== dto.jobId) {
        throw new NotFoundError('Candidate for this job');
    }

    const interview = await Interview.create({
        ...dto,
        organizationId: organizationObjectId(organizationId) ?? null,
        jobId: new mongoose.Types.ObjectId(dto.jobId),
        candidateId: new mongoose.Types.ObjectId(dto.candidateId),
        status: dto.transcriptText ? 'completed' : dto.status,
    });

    if (dto.transcriptText?.trim()) {
        await replaceTranscript(
            interview._id.toString(),
            { transcriptText: dto.transcriptText },
            organizationId
        );
    }

    return (await getInterviewById(interview._id.toString(), organizationId)).interview;
}

export async function listInterviews(
    query: InterviewQueryDto,
    organizationId?: string,
    access?: { userId?: string; role?: string }
): Promise<PaginatedResponse<IInterview>> {
    await recoverStaleAnalysis(organizationId);
    const { page, limit, jobId, candidateId, status, sort } = query;

    const filter: Record<string, unknown> = { ...organizationFilter(organizationId) };
    if (access?.role === 'interviewer') filter.interviewerIds = access.userId;
    if (jobId) filter.jobId = new mongoose.Types.ObjectId(jobId);
    if (candidateId) filter.candidateId = new mongoose.Types.ObjectId(candidateId);
    if (status) filter.status = status;

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir: 1 | -1 = sort.startsWith('-') ? -1 : 1;

    const [interviews, total] = await Promise.all([
        Interview.find(filter)
            .sort({ [sortField]: sortDir })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Interview.countDocuments(filter),
    ]);

    return {
        data: interviews as unknown as IInterview[],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function getInterviewById(
    id: string,
    organizationId?: string
): Promise<{
    interview: IInterview;
    transcriptSegments: ITranscriptSegment[];
    analysis: IInterviewAnalysis | null;
}> {
    await recoverStaleAnalysis(organizationId, id);
    const interview = await Interview.findOne({
        _id: id,
        ...organizationFilter(organizationId),
    }).lean();
    if (!interview) throw new NotFoundError('Interview');

    const [segments, analysis] = await Promise.all([
        TranscriptSegment.find({ interviewId: interview._id }).sort({ createdAt: 1 }).lean(),
        InterviewAnalysis.findOne({ interviewId: interview._id }).sort({ createdAt: -1 }).lean(),
    ]);

    return {
        interview: interview as unknown as IInterview,
        transcriptSegments: segments as unknown as ITranscriptSegment[],
        analysis: (analysis as unknown as IInterviewAnalysis) ?? null,
    };
}

async function recoverStaleAnalysis(organizationId?: string, interviewId?: string) {
    const staleBefore = new Date(Date.now() - 5 * 60_000);
    const stale = await Interview.find({
        ...organizationFilter(organizationId),
        ...(interviewId ? { _id: interviewId } : {}),
        status: 'analyzing',
        updatedAt: { $lt: staleBefore },
    })
        .select('_id')
        .lean();
    if (!stale.length) return;

    const staleIds = stale.map(item => item._id);
    const activeTaskInterviewIds = await Task.distinct('interviewId', {
        interviewId: { $in: staleIds },
        type: 'interview_analysis',
        status: { $in: ['queued', 'processing'] },
        updatedAt: { $gte: staleBefore },
    });
    await Interview.updateMany(
        { _id: { $in: staleIds, $nin: activeTaskInterviewIds }, status: 'analyzing' },
        { $set: { status: 'completed' } }
    );
}

export async function updateInterview(
    id: string,
    dto: UpdateInterviewDto,
    organizationId?: string
): Promise<IInterview> {
    const interview = await Interview.findOneAndUpdate(
        { _id: id, ...organizationFilter(organizationId) },
        { $set: dto },
        { new: true, runValidators: true }
    ).lean();
    if (!interview) throw new NotFoundError('Interview');
    return interview as unknown as IInterview;
}

export async function deleteInterview(id: string, organizationId?: string): Promise<void> {
    const interview = await Interview.findOne({
        _id: id,
        ...organizationFilter(organizationId),
    }).lean();
    if (!interview) throw new NotFoundError('Interview');
    await Promise.all([
        TranscriptSegment.deleteMany({ interviewId: id }),
        InterviewAnalysis.deleteMany({ interviewId: id }),
        FileAsset.deleteMany({ organizationId, ownerType: 'interview', ownerId: id }),
    ]);
    await Interview.deleteOne({ _id: id, ...organizationFilter(organizationId) });
}

export async function replaceTranscript(
    id: string,
    dto: TranscriptBodyDto,
    organizationId?: string
): Promise<{
    interview: IInterview;
    transcriptSegments: ITranscriptSegment[];
}> {
    const interview = await Interview.findOne({ _id: id, ...organizationFilter(organizationId) });
    if (!interview) throw new NotFoundError('Interview');

    const transcriptText = dto.transcriptText.trim();

    await TranscriptSegment.deleteMany({ interviewId: interview._id });
    const parsed = parseTranscript(transcriptText).map(segment => ({
        ...segment,
        interviewId: interview._id,
    }));

    if (parsed.length > 0) {
        await TranscriptSegment.insertMany(parsed);
    }

    interview.transcriptText = transcriptText;
    if (interview.status === 'draft' || interview.status === 'scheduled') {
        interview.status = 'completed';
    }
    await interview.save();

    const segments = await TranscriptSegment.find({ interviewId: interview._id })
        .sort({ createdAt: 1 })
        .lean();

    return {
        interview: interview.toJSON() as unknown as IInterview,
        transcriptSegments: segments as unknown as ITranscriptSegment[],
    };
}

export async function queueInterviewAnalysis(
    id: string,
    organizationId?: string
): Promise<{ taskId: string; status: string }> {
    const interview = await Interview.findOne({
        _id: id,
        ...organizationFilter(organizationId),
    }).lean();
    if (!interview) throw new NotFoundError('Interview');

    const task = await createTask({
        type: 'interview_analysis',
        organizationId,
        jobId: (interview as any).jobId.toString(),
        candidateId: (interview as any).candidateId.toString(),
        interviewId: id,
    });

    await Interview.findByIdAndUpdate(id, { $set: { status: 'analyzing' } });

    await interviewAnalysisQueue.add(
        'analyze-interview',
        {
            taskId: task._id.toString(),
            interviewId: id,
            jobId: (interview as any).jobId.toString(),
            candidateId: (interview as any).candidateId.toString(),
        },
        { jobId: task._id.toString() }
    );

    return { taskId: task._id.toString(), status: 'queued' };
}

function parseTranscript(text: string): Array<{
    speaker: string;
    speakerRole: 'candidate' | 'interviewer' | 'unknown';
    text: string;
}> {
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const speakerLines = lines
        .map(line => {
            const match = line.match(/^([^:]{2,60}):\s*(.+)$/);
            if (!match) return null;
            return {
                speaker: match[1].trim(),
                speakerRole: inferSpeakerRole(match[1]),
                text: match[2].trim(),
            };
        })
        .filter(Boolean) as Array<{
        speaker: string;
        speakerRole: 'candidate' | 'interviewer' | 'unknown';
        text: string;
    }>;

    if (speakerLines.length >= Math.max(2, Math.floor(lines.length * 0.4))) {
        return speakerLines;
    }

    return text
        .split(/\n{2,}/)
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => ({
            speaker: 'Unknown',
            speakerRole: 'unknown' as const,
            text: chunk,
        }));
}

function inferSpeakerRole(speaker: string): 'candidate' | 'interviewer' | 'unknown' {
    const normalized = speaker.toLowerCase();
    if (normalized.includes('candidate') || normalized.includes('applicant')) return 'candidate';
    if (
        normalized.includes('interviewer') ||
        normalized.includes('recruiter') ||
        normalized.includes('hiring') ||
        normalized.includes('manager')
    ) {
        return 'interviewer';
    }
    return 'unknown';
}
