import mongoose, { Schema } from 'mongoose';
import type { IMembershipDocument, MembershipRole, MembershipStatus } from '@/types';

const MembershipSchema = new Schema<IMembershipDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: [
                'owner',
                'admin',
                'recruiter',
                'interviewer',
                'viewer',
            ] satisfies MembershipRole[],
            default: 'recruiter',
        },
        status: {
            type: String,
            enum: ['active', 'invited', 'disabled'] satisfies MembershipStatus[],
            default: 'active',
            index: true,
        },
        invitedEmail: {
            type: String,
            lowercase: true,
            trim: true,
            default: null,
        },
        inviteTokenHash: {
            type: String,
            default: null,
            select: false,
            index: true,
        },
        inviteExpiresAt: {
            type: Date,
            default: null,
            select: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

MembershipSchema.index(
    { organizationId: 1, userId: 1 },
    { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);
MembershipSchema.index({ organizationId: 1, invitedEmail: 1, status: 1 });

export const Membership = mongoose.model<IMembershipDocument>('Membership', MembershipSchema);
