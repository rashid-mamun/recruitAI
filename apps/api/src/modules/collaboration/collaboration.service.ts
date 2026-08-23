import mongoose from 'mongoose';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { CandidateReport } from '@/modules/reports/candidate-report.model';
import { NotFoundError } from '@/middleware/errorHandler';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { Comment } from './comment.model';
import { Review } from './review.model';
import type { Request } from 'express';
import type { CollaborationResourceType, IComment, IReview } from '@/types';
import type { CreateCommentDto, CreateReviewDto, UpdateReviewDto } from './collaboration.schema';
import { getAuthUser, organizationObjectId } from '@/utils/tenant';

export async function listComments(
    resourceType: CollaborationResourceType,
    resourceId: string,
    organizationId: string
): Promise<IComment[]> {
    await ensureResourceExists(resourceType, resourceId, organizationId);
    return (await Comment.find({ resourceType, resourceId, organizationId })
        .sort({ createdAt: -1 })
        .lean()) as unknown as IComment[];
}

export async function createComment(
    req: Request,
    resourceType: CollaborationResourceType,
    resourceId: string,
    dto: CreateCommentDto
): Promise<IComment> {
    const auth = getAuthUser(req);
    await ensureResourceExists(resourceType, resourceId, auth.organizationId!);
    const user = (req as any).user;
    const comment = await Comment.create({
        organizationId: organizationObjectId(auth.organizationId),
        resourceType,
        resourceId: new mongoose.Types.ObjectId(resourceId),
        body: dto.body,
        visibility: dto.visibility,
        createdBy: user?.id ?? null,
        createdByName: user?.name ?? '',
    });

    await recordAuditLog({
        req,
        action: 'comment.created',
        resourceType,
        resourceId,
        after: { body: dto.body, visibility: dto.visibility },
    });

    return comment.toJSON() as unknown as IComment;
}

export async function listReviews(
    resourceType: CollaborationResourceType,
    resourceId: string,
    organizationId: string
): Promise<IReview[]> {
    await ensureResourceExists(resourceType, resourceId, organizationId);
    return (await Review.find({ resourceType, resourceId, organizationId })
        .sort({ updatedAt: -1 })
        .lean()) as unknown as IReview[];
}

export async function createReview(
    req: Request,
    resourceType: CollaborationResourceType,
    resourceId: string,
    dto: CreateReviewDto
): Promise<IReview> {
    const auth = getAuthUser(req);
    await ensureResourceExists(resourceType, resourceId, auth.organizationId!);
    const user = (req as any).user;
    const review = await Review.create({
        organizationId: organizationObjectId(auth.organizationId),
        resourceType,
        resourceId: new mongoose.Types.ObjectId(resourceId),
        status: 'open',
        note: dto.note,
        assignedTo: dto.assignedTo ?? null,
        dueAt: dto.dueAt ?? null,
        createdBy: user?.id ?? null,
    });

    await recordAuditLog({
        req,
        action: 'review.created',
        resourceType,
        resourceId,
        after: { status: 'open', note: dto.note, assignedTo: dto.assignedTo ?? null },
    });

    return review.toJSON() as unknown as IReview;
}

export async function updateReview(
    req: Request,
    reviewId: string,
    dto: UpdateReviewDto
): Promise<IReview> {
    const organizationId = getAuthUser(req).organizationId!;
    const before = await Review.findOne({ _id: reviewId, organizationId }).lean();
    if (!before) throw new NotFoundError('Review');

    const user = (req as any).user;
    const shouldMarkReviewed =
        dto.status && ['approved', 'changes_requested', 'rejected'].includes(dto.status);

    const review = await Review.findOneAndUpdate(
        { _id: reviewId, organizationId },
        {
            $set: {
                ...dto,
                reviewedBy: shouldMarkReviewed ? (user?.id ?? null) : (before as any).reviewedBy,
                reviewedAt: shouldMarkReviewed ? new Date() : (before as any).reviewedAt,
            },
        },
        { new: true, runValidators: true }
    ).lean();

    await recordAuditLog({
        req,
        action: 'review.updated',
        resourceType: (before as any).resourceType,
        resourceId: (before as any).resourceId.toString(),
        before: {
            status: (before as any).status,
            decision: (before as any).decision,
            note: (before as any).note,
        },
        after: {
            status: (review as any).status,
            decision: (review as any).decision,
            note: (review as any).note,
        },
    });

    return review as unknown as IReview;
}

async function ensureResourceExists(
    resourceType: CollaborationResourceType,
    resourceId: string,
    organizationId: string
) {
    const model =
        resourceType === 'candidate'
            ? Candidate
            : resourceType === 'interview'
              ? Interview
              : resourceType === 'evaluation'
                ? Evaluation
                : CandidateReport;

    const exists = await model.exists({ _id: resourceId, organizationId });
    if (!exists) throw new NotFoundError(resourceType);
}
