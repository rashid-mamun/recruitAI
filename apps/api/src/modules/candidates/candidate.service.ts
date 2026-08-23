import mongoose from 'mongoose';
import { Candidate } from './candidate.model';
import { Message } from './message.model';
import { Job } from '@/modules/jobs/job.model';
import { scoringQueue, outreachQueue } from '@/queues';
import { createTask } from '@/modules/tasks/task.service';
import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL } from '@/config/redis';
import { smartAiRetry } from '@/utils/smartRetry';
import { AiFactory } from '@/services/ai/ai.factory';
import { groqProvider } from '@/services/ai/providers/groq.provider';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ConflictError, NotFoundError, ValidationError } from '@/middleware/errorHandler';
import { organizationFilter } from '@/utils/tenant';
import { Interview } from '@/modules/interviews/interview.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { CandidateReport } from '@/modules/reports/candidate-report.model';
import { Comment } from '@/modules/collaboration/comment.model';
import { Review } from '@/modules/collaboration/review.model';
import { FileAsset } from '@/modules/files/file-asset.model';
import { getStorageProvider } from '@/modules/files/storage.provider';
import type {
    CandidateQueryDto,
    GlobalCandidateQueryDto,
    UpdateCandidateDto,
} from './candidate.schema';
import type { ICandidate, ICandidateScore, PaginatedResponse } from '@/types';

/**
 * List candidates for a specific job with pagination and caching
 */
export async function listCandidates(
    jobId: string,
    query: CandidateQueryDto,
    organizationId?: string
): Promise<PaginatedResponse<ICandidate>> {
    const { page, limit, status, stage, sort } = query;

    const jobExists = await Job.exists({
        _id: jobId,
        ...organizationFilter(organizationId),
    });
    if (!jobExists) throw new NotFoundError('Job');

    const tenantId = organizationId ?? 'missing';
    const cacheKey = CacheKeys.candidates(tenantId, jobId, page);
    if (!status && !stage && sort === '-createdAt') {
        const cached = await cacheGet<PaginatedResponse<ICandidate>>(cacheKey);
        if (cached) return cached;
    }

    const filter: Record<string, unknown> = {
        ...organizationFilter(organizationId),
        jobId: new mongoose.Types.ObjectId(jobId),
    };
    if (status) filter.status = status;
    if (stage === 'scored') filter['score.value'] = { $gt: 0 };
    if (stage === 'contacted') {
        filter.status = {
            $in: ['contacted', 'responded', 'interested', 'scheduling', 'not_interested', 'hired'],
        };
    }
    if (stage === 'interested') filter.status = { $in: ['interested', 'scheduling', 'hired'] };
    if (stage === 'hired') filter.status = 'hired';

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir: 1 | -1 = sort.startsWith('-') ? -1 : 1;
    const sortQuery = sortField === 'score' ? { 'score.value': sortDir } : { [sortField]: sortDir };

    const [candidates, total] = await Promise.all([
        Candidate.find(filter)
            .sort(sortQuery)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Candidate.countDocuments(filter),
    ]);

    const result: PaginatedResponse<ICandidate> = {
        data: candidates as unknown as ICandidate[],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    if (!status && !stage && sort === '-createdAt') {
        await cacheSet(cacheKey, result, CacheTTL.CANDIDATES);
    }

    return result;
}

/**
 * List ALL candidates across all jobs (global, filtered)
 */
export async function listAllCandidates(
    query: GlobalCandidateQueryDto,
    organizationId?: string
): Promise<PaginatedResponse<ICandidate>> {
    const { page, limit, jobId, status, minScore, maxScore, search, sort } = query;

    const filter: Record<string, unknown> = { ...organizationFilter(organizationId) };

    if (jobId) filter.jobId = new mongoose.Types.ObjectId(jobId);
    if (status) {
        const statuses = status
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);

        if (statuses.length === 1) {
            filter.status = statuses[0];
        } else if (statuses.length > 1) {
            filter.status = { $in: statuses };
        }
    }
    if (minScore !== undefined || maxScore !== undefined) {
        filter['score.value'] = {};
        if (minScore !== undefined) (filter['score.value'] as any).$gte = minScore;
        if (maxScore !== undefined) (filter['score.value'] as any).$lte = maxScore;
    }
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { headline: { $regex: search, $options: 'i' } },
        ];
    }

    const sortMap: Record<string, { field: string; dir: 1 | -1 }> = {
        score_desc: { field: 'score', dir: -1 },
        score_asc: { field: 'score', dir: 1 },
        name: { field: 'name', dir: 1 },
        recent: { field: 'createdAt', dir: -1 },
        '-score': { field: 'score', dir: -1 },
        score: { field: 'score', dir: 1 },
        '-createdAt': { field: 'createdAt', dir: -1 },
        createdAt: { field: 'createdAt', dir: 1 },
        '-updatedAt': { field: 'updatedAt', dir: -1 },
    };

    const sortConfig = sortMap[sort] ?? sortMap.score_desc;
    const sortQuery =
        sortConfig.field === 'score'
            ? { 'score.value': sortConfig.dir }
            : { [sortConfig.field]: sortConfig.dir };

    const [candidates, total] = await Promise.all([
        Candidate.find(filter)
            .sort(sortQuery)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Candidate.countDocuments(filter),
    ]);

    return {
        data: candidates as unknown as ICandidate[],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

/**
 * Get candidate by ID
 */
export async function getCandidateById(id: string, organizationId?: string): Promise<ICandidate> {
    const candidate = await Candidate.findOne({
        _id: id,
        ...organizationFilter(organizationId),
    }).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    return candidate as unknown as ICandidate;
}

/**
 * Update candidate fields (status, tags, notes)
 */
export async function updateCandidateById(
    id: string,
    dto: UpdateCandidateDto,
    organizationId?: string
): Promise<ICandidate> {
    const candidate = await Candidate.findOneAndUpdate(
        { _id: id, ...organizationFilter(organizationId) },
        { $set: dto },
        { new: true, runValidators: true }
    ).lean();

    if (!candidate) throw new NotFoundError('Candidate');

    // Invalidate candidate list caches
    await cacheDel(
        CacheKeys.candidates(organizationId ?? 'missing', (candidate as any).jobId.toString(), 1)
    );

    return candidate as unknown as ICandidate;
}

export async function findCandidateDuplicates(candidateId: string, organizationId: string) {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
    if (!candidate) throw new NotFoundError('Candidate');

    const signals: Record<string, unknown>[] = [];
    if (candidate.email) signals.push({ email: candidate.email });
    if (candidate.linkedinUrl) signals.push({ linkedinUrl: candidate.linkedinUrl });
    signals.push({
        name: { $regex: `^${escapeRegex(candidate.name)}$`, $options: 'i' },
        currentCompany: {
            $regex: `^${escapeRegex(candidate.currentCompany ?? '')}$`,
            $options: 'i',
        },
        currentTitle: { $regex: `^${escapeRegex(candidate.currentTitle ?? '')}$`, $options: 'i' },
    });

    return Candidate.find({
        organizationId,
        _id: { $ne: candidateId },
        $or: signals,
    })
        .limit(20)
        .lean();
}

export async function mergeCandidates(
    primaryCandidateId: string,
    duplicateCandidateId: string,
    organizationId: string
): Promise<ICandidate> {
    const [primary, duplicate] = await Promise.all([
        Candidate.findOne({ _id: primaryCandidateId, organizationId }).lean(),
        Candidate.findOne({ _id: duplicateCandidateId, organizationId }).lean(),
    ]);
    if (!primary) throw new NotFoundError('Primary candidate');
    if (!duplicate) throw new NotFoundError('Duplicate candidate');
    if (primary.jobId.toString() !== duplicate.jobId.toString()) {
        throw new ValidationError('Candidates must belong to the same job');
    }

    const merged = await Candidate.findOneAndUpdate(
        { _id: primaryCandidateId, organizationId },
        {
            $set: {
                email: primary.email || duplicate.email,
                phone: primary.phone || duplicate.phone,
                headline: primary.headline || duplicate.headline,
                summary: primary.summary || duplicate.summary,
                experience: primary.experience || duplicate.experience,
                currentCompany: primary.currentCompany || duplicate.currentCompany,
                currentTitle: primary.currentTitle || duplicate.currentTitle,
                resumeFileId: primary.resumeFileId || duplicate.resumeFileId,
                notes: [primary.notes, duplicate.notes].filter(Boolean).join('\n\n'),
                tags: [...new Set([...(primary.tags ?? []), ...(duplicate.tags ?? [])])],
                skills: [...new Set([...(primary.skills ?? []), ...(duplicate.skills ?? [])])],
                assignedRecruiterIds: [
                    ...new Set([
                        ...(primary.assignedRecruiterIds ?? []),
                        ...(duplicate.assignedRecruiterIds ?? []),
                    ]),
                ],
                lastActivityAt: new Date(),
            },
        },
        { new: true, runValidators: true }
    ).lean();

    const primaryEvaluationExists = await Evaluation.exists({
        candidateId: primaryCandidateId,
        organizationId,
    });
    const evaluationMove = primaryEvaluationExists
        ? Evaluation.deleteMany({ candidateId: duplicateCandidateId, organizationId })
        : Evaluation.updateMany(
              { candidateId: duplicateCandidateId, organizationId },
              { candidateId: primaryCandidateId }
          );

    await Promise.all([
        Interview.updateMany(
            { candidateId: duplicateCandidateId, organizationId },
            { candidateId: primaryCandidateId }
        ),
        evaluationMove,
        CandidateReport.updateMany(
            { candidateId: duplicateCandidateId, organizationId },
            { candidateId: primaryCandidateId }
        ),
        Message.updateMany(
            { candidateId: duplicateCandidateId },
            { candidateId: primaryCandidateId }
        ),
        FileAsset.updateMany(
            { ownerType: 'candidate', ownerId: duplicateCandidateId, organizationId },
            { ownerId: primaryCandidateId }
        ),
        Comment.updateMany(
            { resourceType: 'candidate', resourceId: duplicateCandidateId, organizationId },
            { resourceId: primaryCandidateId }
        ),
        Review.updateMany(
            { resourceType: 'candidate', resourceId: duplicateCandidateId, organizationId },
            { resourceId: primaryCandidateId }
        ),
    ]);
    await Candidate.deleteOne({ _id: duplicateCandidateId, organizationId });
    return merged as unknown as ICandidate;
}

export async function exportCandidateData(candidateId: string, organizationId: string) {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    const [messages, interviews, evaluations, reports, files, comments, reviews] =
        await Promise.all([
            Message.find({ candidateId }).lean(),
            Interview.find({ candidateId, organizationId }).lean(),
            Evaluation.find({ candidateId, organizationId }).lean(),
            CandidateReport.find({ candidateId, organizationId }).lean(),
            FileAsset.find({ ownerType: 'candidate', ownerId: candidateId, organizationId }).lean(),
            Comment.find({
                resourceType: 'candidate',
                resourceId: candidateId,
                organizationId,
            }).lean(),
            Review.find({
                resourceType: 'candidate',
                resourceId: candidateId,
                organizationId,
            }).lean(),
        ]);
    return {
        exportedAt: new Date(),
        candidate,
        messages,
        interviews,
        evaluations,
        reports,
        files,
        comments,
        reviews,
    };
}

export async function deleteCandidateData(
    candidateId: string,
    organizationId: string
): Promise<void> {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    const fileAssets = await FileAsset.find({
        ownerType: 'candidate',
        ownerId: candidateId,
        organizationId,
    }).lean();
    await Promise.all(
        fileAssets.map(asset =>
            getStorageProvider(asset.storageProvider)
                .delete(asset.storageKey)
                .catch(error => {
                    logger.warn('Unable to delete candidate storage object', {
                        candidateId,
                        storageKey: asset.storageKey,
                        error: error instanceof Error ? error.message : String(error),
                    });
                })
        )
    );
    await Promise.all([
        Message.deleteMany({ candidateId }),
        Interview.deleteMany({ candidateId, organizationId }),
        Evaluation.deleteMany({ candidateId, organizationId }),
        CandidateReport.deleteMany({ candidateId, organizationId }),
        FileAsset.deleteMany({ ownerType: 'candidate', ownerId: candidateId, organizationId }),
        Comment.deleteMany({ resourceType: 'candidate', resourceId: candidateId, organizationId }),
        Review.deleteMany({ resourceType: 'candidate', resourceId: candidateId, organizationId }),
    ]);
    await Candidate.deleteOne({ _id: candidateId, organizationId });
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Queue candidate for scoring
 */
export async function scoreCandidate(
    candidateId: string,
    forceRefresh: boolean,
    organizationId?: string
): Promise<{ taskId: string; status: string } | { cached: true; score: ICandidateScore }> {
    const candidate = await Candidate.findOne({
        _id: candidateId,
        ...organizationFilter(organizationId),
    }).lean();
    if (!candidate) throw new NotFoundError('Candidate');

    const cacheKey = CacheKeys.score(candidateId, (candidate as any).jobId.toString());
    if (!forceRefresh) {
        const cached = await cacheGet<ICandidateScore>(cacheKey);
        if (cached) {
            if (cached.source === 'fallback') {
                await cacheDel(cacheKey);
            } else {
                return { cached: true, score: cached };
            }
        }
    }

    const task = await createTask({
        type: 'scoring',
        organizationId,
        jobId: (candidate as any).jobId.toString(),
        candidateId,
    });

    await scoringQueue.add(
        'score-candidate',
        {
            taskId: task._id.toString(),
            candidateId,
            jobId: (candidate as any).jobId.toString(),
            forceRefresh,
        },
        { jobId: task._id.toString() }
    );

    await cacheDel(
        CacheKeys.candidates(organizationId ?? 'missing', (candidate as any).jobId.toString(), 1)
    );

    return { taskId: task._id.toString(), status: 'queued' };
}

/**
 * Queue candidate for outreach
 */
export async function sendOutreach(
    candidateId: string,
    jobId: string,
    organizationId?: string
): Promise<{ taskId: string; status: string }> {
    const candidate = await Candidate.findOne({
        _id: candidateId,
        ...organizationFilter(organizationId),
    }).lean();
    if (!candidate) throw new NotFoundError('Candidate');

    if ((candidate as any).jobId.toString() !== jobId) {
        throw new ValidationError('Candidate does not belong to this role.');
    }
    const job = await Job.findOne({
        _id: jobId,
        ...organizationFilter(organizationId),
    })
        .select('status')
        .lean();
    if (!job) throw new NotFoundError('Job');
    if (job.status !== 'active') {
        throw new ConflictError('Resume this role before sending candidate outreach.');
    }
    if (!['new', 'sourced', 'scored'].includes((candidate as any).status)) {
        throw new ConflictError('Outreach has already started for this candidate.');
    }

    const task = await createTask({ type: 'outreach', organizationId, jobId, candidateId });

    if (
        (candidate as any).status === 'new' ||
        (candidate as any).status === 'scored' ||
        (candidate as any).status === 'sourced'
    ) {
        await Candidate.findByIdAndUpdate(candidateId, { $set: { status: 'contacted' } });
        await cacheDel(CacheKeys.candidates(organizationId ?? 'missing', jobId, 1));
    }

    await outreachQueue.add(
        'send-outreach',
        { taskId: task._id.toString(), candidateId, jobId },
        { jobId: task._id.toString() }
    );

    return { taskId: task._id.toString(), status: 'queued' };
}

/**
 * Classify candidate response and update status
 */
export async function classifyResponse(
    candidateId: string,
    message: string,
    organizationId?: string
): Promise<{
    intent: 'interested' | 'not_interested' | 'maybe';
    confidence: number;
    reason: string;
    candidateStatus: string;
    schedulingLink: string | null;
}> {
    const candidate = await Candidate.findOne({
        _id: candidateId,
        ...organizationFilter(organizationId),
    }).lean();
    if (!candidate) throw new NotFoundError('Candidate');

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
        return {
            intent: 'maybe',
            confidence: 0,
            reason: 'Empty message',
            candidateStatus: (candidate as any).status,
            schedulingLink: null,
        };
    }

    const messageToClassify =
        trimmedMessage.length > 5000 ? trimmedMessage.substring(0, 5000) : trimmedMessage;

    const hasAnyAiKey = !!(env.GEMINI_API_KEY || env.OPENAI_API_KEY);
    const hasGroqKey = !!env.GROQ_API_KEY;

    let intentResult:
        | { intent: 'interested' | 'not_interested' | 'maybe'; confidence: number; reason: string }
        | undefined;

    if (hasAnyAiKey) {
        try {
            intentResult = await smartAiRetry(
                () => AiFactory.getProvider().classifyIntent(messageToClassify),
                'intent-classification'
            );
        } catch (err) {
            logger.warn('classifyResponse: primary AI failed, trying Groq', {
                candidateId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    if (!intentResult && hasGroqKey) {
        try {
            intentResult = await smartAiRetry(
                () => groqProvider.classifyIntent(messageToClassify),
                'intent-classification-groq'
            );
            logger.info('classifyResponse: classified via Groq (free fallback)', { candidateId });
        } catch (err) {
            logger.warn('classifyResponse: Groq also failed, using keyword fallback', {
                candidateId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    if (!intentResult) {
        logger.info('classifyResponse: using keyword-based fallback', { candidateId });
        intentResult = classifyResponseLocally(messageToClassify);
    }

    let schedulingLink: string | null = null;
    let newStatus = (candidate as any).status;

    if (intentResult.intent === 'interested') {
        newStatus = 'interested';
        schedulingLink = `https://cal.recruitai.app/schedule/${candidateId}`;
    } else if (intentResult.intent === 'not_interested') {
        newStatus = 'not_interested';
    }

    await Candidate.findByIdAndUpdate(candidateId, {
        $set: {
            status: newStatus,
            respondedAt: new Date(),
            ...(newStatus === 'hired' ? { hiredAt: new Date() } : {}),
        },
    });

    // Save candidate's response
    await Message.create({
        candidateId,
        jobId: (candidate as any).jobId,
        content: trimmedMessage,
        role: 'candidate',
        channel: 'linkedin',
        status: 'sent',
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        sentAt: new Date(),
    });

    if ((candidate as any).outreachMessages.length > 0) {
        const lastMsgId = (candidate as any).outreachMessages[
            (candidate as any).outreachMessages.length - 1
        ];
        await Message.findByIdAndUpdate(lastMsgId, {
            $set: {
                status: 'replied',
                intent: intentResult.intent,
                intentConfidence: intentResult.confidence,
                ...(schedulingLink ? { schedulingLink } : {}),
                repliedAt: new Date(),
            },
        });
    }

    return {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        candidateStatus: newStatus,
        schedulingLink,
    };
}

/**
 * Get all messages for a candidate
 */
export async function getCandidateMessages(candidateId: string, organizationId?: string) {
    const candidate = await Candidate.findOne({
        _id: candidateId,
        ...organizationFilter(organizationId),
    }).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    return Message.find({ candidateId }).sort({ createdAt: 1 }).lean();
}

function classifyResponseLocally(message: string): {
    intent: 'interested' | 'not_interested' | 'maybe';
    confidence: number;
    reason: string;
} {
    const normalized = message.toLowerCase();

    if (
        normalized.includes('yes') ||
        normalized.includes('interested') ||
        normalized.includes('sure') ||
        normalized.includes('great') ||
        normalized.includes('love')
    ) {
        return {
            intent: 'interested',
            confidence: 0.82,
            reason: 'Keyword-based fallback classified the reply as interested.',
        };
    }

    if (
        normalized.includes('no') ||
        normalized.includes('not interested') ||
        normalized.includes('pass') ||
        normalized.includes('not looking')
    ) {
        return {
            intent: 'not_interested',
            confidence: 0.8,
            reason: 'Keyword-based fallback classified the reply as not interested.',
        };
    }

    return {
        intent: 'maybe',
        confidence: 0.5,
        reason: 'Keyword-based fallback could not determine a strong intent.',
    };
}
