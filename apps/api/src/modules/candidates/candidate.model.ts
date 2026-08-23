import mongoose, { Schema, Document } from 'mongoose';
import type { ICandidateDocument, CandidateStatus } from '@/types';

const CandidateSchema = new Schema<ICandidateDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
            index: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: null,
        },
        phone: { type: String, trim: true, default: '' },
        currentCompany: { type: String, trim: true, default: '' },
        currentTitle: { type: String, trim: true, default: '' },
        linkedinUrl: {
            type: String,
            required: true,
            trim: true,
        },
        headline: {
            type: String,
            default: '',
            trim: true,
        },
        summary: {
            type: String,
            default: '',
        },
        skills: {
            type: [String],
            default: [],
        },
        experience: {
            type: String,
            default: '',
        },
        location: {
            type: String,
            default: '',
            trim: true,
        },
        source: {
            type: String,
            default: 'manual',
        },
        starred: {
            type: Boolean,
            default: false,
        },
        tags: {
            type: [String],
            default: [],
        },
        notes: {
            type: String,
            default: '',
        },
        resumeFileId: {
            type: Schema.Types.ObjectId,
            ref: 'FileAsset',
            default: null,
        },
        resumeText: {
            type: String,
            default: '',
        },
        portfolioUrl: { type: String, trim: true, default: '' },
        githubUrl: { type: String, trim: true, default: '' },
        sourceDetails: { type: Schema.Types.Mixed, default: {} },
        consentStatus: {
            type: String,
            enum: ['unknown', 'granted', 'withdrawn'],
            default: 'unknown',
        },
        privacyRegion: { type: String, trim: true, default: '' },
        ownerUserId: { type: String, default: null, index: true },
        assignedRecruiterIds: { type: [String], default: [] },
        lastActivityAt: { type: Date, default: null, index: true },
        status: {
            type: String,
            enum: [
                'new',
                'sourced',
                'scored',
                'contacted',
                'interested',
                'responded',
                'scheduling',
                'hired',
                'rejected',
                'not_interested',
            ] satisfies CandidateStatus[],
            default: 'new',
        },
        score: {
            value: { type: Number, min: 0, max: 100 },
            reasoning: { type: String },
            strengths: { type: [String], default: [] },
            weaknesses: { type: [String], default: [] },
            cachedAt: { type: Date },
            source: {
                type: String,
                enum: ['ai', 'fallback'],
                default: 'ai',
            },
        },
        scoredAt: { type: Date },
        contactedAt: { type: Date },
        respondedAt: { type: Date },
        hiredAt: { type: Date },
        outreachMessages: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Message',
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

CandidateSchema.index({ organizationId: 1, jobId: 1, linkedinUrl: 1 }, { unique: true });
CandidateSchema.index({ jobId: 1, status: 1 });
CandidateSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
CandidateSchema.index({ organizationId: 1, email: 1 }, { sparse: true });
CandidateSchema.index({ organizationId: 1, name: 1, currentCompany: 1, currentTitle: 1 });
CandidateSchema.index({ 'score.value': -1 });
CandidateSchema.index({ createdAt: -1 });

export const Candidate = mongoose.model<ICandidateDocument>('Candidate', CandidateSchema);
