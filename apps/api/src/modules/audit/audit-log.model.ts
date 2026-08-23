import mongoose, { Schema } from 'mongoose';
import type { IAuditLogDocument } from '@/types';

const AuditLogSchema = new Schema<IAuditLogDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        actorUserId: { type: String, default: null, index: true },
        action: { type: String, required: true, trim: true, index: true },
        resourceType: { type: String, required: true, trim: true, index: true },
        resourceId: { type: String, default: null, index: true },
        before: { type: Schema.Types.Mixed, default: null },
        after: { type: Schema.Types.Mixed, default: null },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

AuditLogSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1, createdAt: -1 });
AuditLogSchema.index({ organizationId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
