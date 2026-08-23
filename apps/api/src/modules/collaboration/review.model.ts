import mongoose, { Schema } from 'mongoose';
import type { CollaborationResourceType, IReviewDocument } from '@/types';

const ReviewSchema = new Schema<IReviewDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        resourceType: {
            type: String,
            enum: [
                'candidate',
                'interview',
                'evaluation',
                'report',
            ] satisfies CollaborationResourceType[],
            required: true,
            index: true,
        },
        resourceId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['open', 'approved', 'changes_requested', 'rejected'],
            default: 'open',
            index: true,
        },
        decision: {
            type: String,
            enum: ['strong_yes', 'yes', 'maybe', 'no', null],
            default: null,
        },
        note: {
            type: String,
            default: '',
            trim: true,
            maxlength: 5000,
        },
        assignedTo: { type: String, default: null, index: true },
        createdBy: { type: String, default: null, index: true },
        reviewedBy: { type: String, default: null },
        reviewedAt: { type: Date, default: null },
        dueAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

ReviewSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1, updatedAt: -1 });

export const Review = mongoose.model<IReviewDocument>('Review', ReviewSchema);
