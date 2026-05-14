import mongoose from 'mongoose';
import { Job } from './job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Message } from '@/modules/candidates/message.model';
import { NotFoundError } from '@/middleware/errorHandler';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, CacheKeys, CacheTTL } from '@/config/redis';
import type { CreateJobDto, UpdateJobDto, JobQueryDto } from './job.schema';
import type { IJob } from '@/types';

export async function createJob(dto: CreateJobDto): Promise<IJob> {
    const job = await Job.create(dto);
    await cacheDelPattern('candidates:*');
    return job.toJSON() as unknown as IJob;
}

export async function listJobs(query: JobQueryDto) {
    const { page, limit, status, search, sort } = query;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (search) filter.$text = { $search: search };

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir = sort.startsWith('-') ? -1 : 1;

    const [jobs, total] = await Promise.all([
        Job.find(filter)
            .sort({ [sortField]: sortDir })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Job.countDocuments(filter),
    ]);

    const jobIds = jobs.map(job => job._id);

    const [candidates, messages] = await Promise.all([
        Candidate.find({ jobId: { $in: jobIds } }).lean(),
        Message.find({ jobId: { $in: jobIds }, role: 'candidate' })
            .select('candidateId jobId')
            .lean(),
    ]);

    const candidatesByJob = candidates.reduce(
        (acc, c) => {
            const jId = (c as any).jobId.toString();
            if (!acc[jId]) acc[jId] = [];
            acc[jId].push(c);
            return acc;
        },
        {} as Record<string, any[]>
    );

    const messagesByJob = messages.reduce(
        (acc, m) => {
            const jId = (m as any).jobId.toString();
            if (!acc[jId]) acc[jId] = [];
            acc[jId].push(m);
            return acc;
        },
        {} as Record<string, any[]>
    );

    const data = jobs.map(job => {
        const jId = job._id.toString();
        const cands = candidatesByJob[jId] || [];
        const msgs = messagesByJob[jId] || [];

        const sourced = cands.length;
        const scored = cands.filter(c => c.score?.value > 0).length;
        const contacted = cands.filter(c =>
            ['contacted', 'interested', 'not_interested', 'hired'].includes(c.status)
        ).length;
        const interested = cands.filter(c => c.status === 'interested').length;
        const hired = cands.filter(c => c.status === 'hired').length;

        const respondedIds = new Set(msgs.map(m => m.candidateId.toString()));
        const responded = respondedIds.size;

        const responseRate = contacted > 0 ? Math.round((responded / contacted) * 1000) / 10 : 0;

        const scores = cands.filter(c => c.score?.value > 0).map(c => c.score.value);
        const avgScore =
            scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null;
        const topScore = scores.length > 0 ? Math.max(...scores) : null;

        return {
            ...job,
            candidateCount: sourced,
            stats: {
                new: cands.filter(c => c.status === 'new' || c.status === 'sourced').length,
                scored,
                contacted,
                interested,
                hired,
                topScore,
                avgScore,
            },
        };
    }) as unknown as IJob[];

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getJobById(id: string): Promise<IJob> {
    const cached = await cacheGet<IJob>(CacheKeys.job(id));
    if (cached) return cached;

    const job = await Job.findById(id).lean();
    if (!job) throw new NotFoundError('Job');

    await cacheSet(CacheKeys.job(id), job, CacheTTL.JOB);
    return job as unknown as IJob;
}

export async function updateJob(id: string, dto: UpdateJobDto): Promise<IJob> {
    const job = await Job.findByIdAndUpdate(
        id,
        { $set: dto },
        { new: true, runValidators: true }
    ).lean();

    if (!job) throw new NotFoundError('Job');

    await cacheDel(CacheKeys.job(id));
    return job as unknown as IJob;
}

export async function deleteJob(id: string): Promise<void> {
    const job = await Job.findByIdAndUpdate(id, { deletedAt: new Date() }).lean();
    if (!job) throw new NotFoundError('Job');
    await cacheDel(CacheKeys.job(id));
}

/**
 * Get pipeline funnel stats for a job
 * Returns counts of candidates at each pipeline stage
 */
export async function getJobStats(jobId: string) {
    const job = await Job.findById(jobId).lean();
    if (!job) throw new NotFoundError('Job');

    const [candidates, messages] = await Promise.all([
        Candidate.find({ jobId: new mongoose.Types.ObjectId(jobId) }).lean(),
        Message.find({ jobId: new mongoose.Types.ObjectId(jobId), role: 'candidate' })
            .select('candidateId')
            .lean(),
    ]);

    const total = candidates.length;
    const scored = candidates.filter(c => (c as any).score?.value > 0).length;
    const contacted = candidates.filter(c =>
        ['contacted', 'interested', 'not_interested', 'hired'].includes((c as any).status)
    ).length;
    const interested = candidates.filter(c => (c as any).status === 'interested').length;
    const not_interested = candidates.filter(c => (c as any).status === 'not_interested').length;
    const hired = candidates.filter(c => (c as any).status === 'hired').length;

    const respondedIds = new Set(messages.map(m => (m as any).candidateId.toString()));
    const responded = respondedIds.size;
    const neutral = Math.max(0, responded - interested - not_interested);

    const scores = candidates
        .filter(c => (c as any).score?.value > 0)
        .map(c => (c as any).score.value);
    const topScore = scores.length > 0 ? Math.max(...scores) : null;
    const avgScore =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return {
        sourced: total,
        scored,
        contacted,
        responded,
        interested,
        not_interested,
        neutral,
        hired,
        responseRate: contacted > 0 ? Math.round((responded / contacted) * 100) : null,
        interestRate: responded > 0 ? Math.round((interested / responded) * 100) : null,
        avgScore,
        topScore,
    };
}

/**
 * Duplicate a job — clone title/description/requirements, set status=paused
 */
export async function duplicateJob(jobId: string): Promise<IJob> {
    const original = await Job.findById(jobId).lean();
    if (!original) throw new NotFoundError('Job');

    const cloned = await Job.create({
        title: `${(original as any).title} (Copy)`,
        description: (original as any).description,
        requirements: (original as any).requirements ?? [],
        location: (original as any).location ?? 'Remote',
        type: (original as any).type ?? 'full-time',
        status: 'paused',
        sourcingQueries: (original as any).sourcingQueries ?? [],
    });

    return cloned.toJSON() as unknown as IJob;
}
