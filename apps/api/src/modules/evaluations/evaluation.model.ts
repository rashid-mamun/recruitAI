import mongoose, { Schema } from 'mongoose';
import type { IEvaluationDocument } from '@/types';

const CompetencyScoreSchema = new Schema(
    {
        competencyId: { type: String, required: true },
        name: { type: String, required: true },
        score: { type: Number, min: 0, max: 100, required: true },
        weight: { type: Number, min: 1, max: 100, required: true },
        rationale: { type: String, default: '' },
        evidence: { type: [String], default: [] },
        humanOverrideScore: { type: Number, min: 0, max: 100, default: null },
        humanOverrideReason: { type: String, default: null, maxlength: 2000 },
    },
    { _id: false }
);

const EvaluationSchema = new Schema<IEvaluationDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
            index: true,
        },
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: 'Candidate',
            required: true,
            index: true,
        },
        scorecardId: {
            type: Schema.Types.ObjectId,
            ref: 'JobScorecard',
            required: true,
        },
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        recommendation: {
            type: String,
            enum: ['strong_yes', 'yes', 'maybe', 'no'],
            default: 'maybe',
        },
        competencyScores: {
            type: [CompetencyScoreSchema],
            default: [],
        },
        summary: {
            type: String,
            default: '',
        },
        source: {
            type: String,
            enum: ['ai', 'fallback'],
            default: 'fallback',
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
        reviewStatus: {
            type: String,
            enum: ['pending', 'reviewed'],
            default: 'pending',
            index: true,
        },
        reviewedBy: { type: String, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

EvaluationSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true });
EvaluationSchema.index({ organizationId: 1, jobId: 1, overallScore: -1 });

export const Evaluation = mongoose.model<IEvaluationDocument>('Evaluation', EvaluationSchema);
