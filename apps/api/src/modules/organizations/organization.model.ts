import mongoose, { Schema } from 'mongoose';
import type { IOrganizationDocument, OrganizationPlan, OrganizationStatus } from '@/types';

const OrganizationSchema = new Schema<IOrganizationDocument>(
    {
        name: { type: String, required: true, trim: true, maxlength: 160 },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 180,
        },
        plan: {
            type: String,
            enum: ['free', 'pro', 'enterprise'] satisfies OrganizationPlan[],
            default: 'free',
        },
        status: {
            type: String,
            enum: ['active', 'suspended'] satisfies OrganizationStatus[],
            default: 'active',
            index: true,
        },
        settings: {
            type: Schema.Types.Mixed,
            default: {},
        },
        billingCustomerId: { type: String, default: null },
        subscriptionStatus: {
            type: String,
            enum: ['none', 'trialing', 'active', 'past_due', 'canceled'],
            default: 'none',
            index: true,
        },
        currentPeriodEnd: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

export const Organization = mongoose.model<IOrganizationDocument>(
    'Organization',
    OrganizationSchema
);
