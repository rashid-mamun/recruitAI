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
import { NotFoundError } from '@/middleware/errorHandler';
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
    query: CandidateQueryDto
): Promise<PaginatedResponse<ICandidate>> {
    const { page, limit, status, sort } = query;

    const cacheKey = CacheKeys.candidates(jobId, page);
    if (!status && sort === '-createdAt') {
        const cached = await cacheGet<PaginatedResponse<ICandidate>>(cacheKey);
        if (cached) return cached;
    }

    const filter: Record<string, unknown> = { jobId: new mongoose.Types.ObjectId(jobId) };
    if (status) filter.status = status;

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

    if (!status && sort === '-createdAt') {
        await cacheSet(cacheKey, result, CacheTTL.CANDIDATES);
    }

    return result;
}

/**
 * List ALL candidates across all jobs (global, filtered)
 */
export async function listAllCandidates(
    query: GlobalCandidateQueryDto
): Promise<PaginatedResponse<ICandidate>> {
    const { page, limit, jobId, status, minScore, maxScore, search, sort } = query;

    const filter: Record<string, unknown> = {};

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
export async function getCandidateById(id: string): Promise<ICandidate> {
    const candidate = await Candidate.findById(id).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    return candidate as unknown as ICandidate;
}

/**
 * Update candidate fields (status, tags, notes)
 */
export async function updateCandidateById(
    id: string,
    dto: UpdateCandidateDto
): Promise<ICandidate> {
    const candidate = await Candidate.findByIdAndUpdate(
        id,
        { $set: dto },
        { new: true, runValidators: true }
    ).lean();

    if (!candidate) throw new NotFoundError('Candidate');

    // Invalidate candidate list caches
    await cacheDel(CacheKeys.candidates((candidate as any).jobId.toString(), 1));

    return candidate as unknown as ICandidate;
}

/**
 * Queue candidate for scoring
 */
export async function scoreCandidate(
    candidateId: string,
    forceRefresh: boolean
): Promise<{ taskId: string; status: string } | { cached: true; score: ICandidateScore }> {
    const candidate = await Candidate.findById(candidateId).lean();
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

    await cacheDel(CacheKeys.candidates((candidate as any).jobId.toString(), 1));

    return { taskId: task._id.toString(), status: 'queued' };
}

/**
 * Queue candidate for outreach
 */
export async function sendOutreach(
    candidateId: string,
    jobId: string
): Promise<{ taskId: string; status: string }> {
    const candidate = await Candidate.findById(candidateId).lean();
    if (!candidate) throw new NotFoundError('Candidate');

    const task = await createTask({ type: 'outreach', jobId, candidateId });

    if (
        (candidate as any).status === 'new' ||
        (candidate as any).status === 'scored' ||
        (candidate as any).status === 'sourced'
    ) {
        await Candidate.findByIdAndUpdate(candidateId, { $set: { status: 'contacted' } });
        await cacheDel(CacheKeys.candidates(jobId, 1));
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
    message: string
): Promise<{
    intent: 'interested' | 'not_interested' | 'maybe';
    confidence: number;
    reason: string;
    candidateStatus: string;
    schedulingLink: string | null;
}> {
    const candidate = await Candidate.findById(candidateId).lean();
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
export async function getCandidateMessages(candidateId: string) {
    const candidate = await Candidate.findById(candidateId).lean();
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
