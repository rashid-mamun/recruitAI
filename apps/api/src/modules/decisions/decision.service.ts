import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { HiringDecision } from './hiring-decision.model';
import { NotFoundError } from '@/middleware/errorHandler';
import type { z } from 'zod';
import type { createDecisionSchema } from './decision.schema';

type DecisionDto = z.infer<typeof createDecisionSchema>;

export async function createDecision(
    jobId: string,
    organizationId: string,
    userId: string,
    dto: DecisionDto
) {
    const [job, candidate] = await Promise.all([
        Job.exists({ _id: jobId, organizationId }),
        Candidate.exists({ _id: dto.candidateId, jobId, organizationId }),
    ]);
    if (!job) throw new NotFoundError('Job');
    if (!candidate) throw new NotFoundError('Candidate');

    const result = await HiringDecision.create({
        organizationId,
        jobId,
        candidateId: dto.candidateId,
        decision: dto.decision,
        reason: dto.reason,
        decidedBy: userId,
        approvedBy: dto.approvedBy ?? null,
    });
    if (dto.decision === 'hired') {
        await Candidate.updateOne(
            { _id: dto.candidateId, organizationId },
            { $set: { status: 'hired', hiredAt: new Date(), lastActivityAt: new Date() } }
        );
    }
    if (dto.decision === 'reject') {
        await Candidate.updateOne(
            { _id: dto.candidateId, organizationId },
            { $set: { status: 'rejected', lastActivityAt: new Date() } }
        );
    }
    return result.toJSON();
}

export async function listDecisions(jobId: string, organizationId: string) {
    const job = await Job.exists({ _id: jobId, organizationId });
    if (!job) throw new NotFoundError('Job');
    return HiringDecision.find({ jobId, organizationId }).sort({ createdAt: -1 }).lean();
}
