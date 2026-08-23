import mongoose, { Schema } from 'mongoose';
import type { ISessionDocument } from '@/types';

const SessionSchema = new Schema<ISessionDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
            index: true,
        },
        refreshTokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        userAgent: {
            type: String,
            default: null,
        },
        ip: {
            type: String,
            default: null,
        },
        revokedAt: {
            type: Date,
            default: null,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            expires: 0,
            index: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

SessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export const Session = mongoose.model<ISessionDocument>('Session', SessionSchema);
