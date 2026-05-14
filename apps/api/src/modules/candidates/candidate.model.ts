import mongoose, { Schema, Document } from 'mongoose';
import type { ICandidateDocument, CandidateStatus } from '@/types';

const CandidateSchema = new Schema<ICandidateDocument>(
    {
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

CandidateSchema.index({ jobId: 1, linkedinUrl: 1 }, { unique: true });
CandidateSchema.index({ jobId: 1, status: 1 });
CandidateSchema.index({ 'score.value': -1 });
CandidateSchema.index({ createdAt: -1 });

export const Candidate = mongoose.model<ICandidateDocument>('Candidate', CandidateSchema);
