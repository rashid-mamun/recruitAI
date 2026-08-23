import mongoose, { Schema } from 'mongoose';
import type { CollaborationResourceType, ICommentDocument } from '@/types';

const CommentSchema = new Schema<ICommentDocument>(
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
        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000,
        },
        visibility: {
            type: String,
            enum: ['team', 'private'],
            default: 'team',
        },
        createdBy: {
            type: String,
            default: null,
            index: true,
        },
        createdByName: {
            type: String,
            default: '',
            trim: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

CommentSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1, createdAt: -1 });

export const Comment = mongoose.model<ICommentDocument>('Comment', CommentSchema);
