import mongoose, { Schema } from 'mongoose';
import type { ICandidateReportDocument } from '@/types';

const CompetencySnapshotSchema = new Schema(
    {
        competencyId: { type: String, required: true },
        name: { type: String, required: true },
        score: { type: Number, min: 0, max: 100, required: true },
        weight: { type: Number, min: 1, max: 100, required: true },
        rationale: { type: String, default: '' },
        evidence: { type: [String], default: [] },
        humanOverrideScore: { type: Number, min: 0, max: 100, default: null },
        humanOverrideReason: { type: String, default: null },
    },
    { _id: false }
);

const CandidateReportSchema = new Schema<ICandidateReportDocument>(
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
        evaluationId: {
            type: Schema.Types.ObjectId,
            ref: 'Evaluation',
            default: null,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ['generated', 'archived'],
            default: 'generated',
        },
        executiveSummary: { type: String, default: '' },
        scorecardSnapshot: { type: [CompetencySnapshotSchema], default: [] },
        interviewHighlights: { type: [String], default: [] },
        strengths: { type: [String], default: [] },
        risks: { type: [String], default: [] },
        recommendation: {
            type: String,
            enum: ['strong_yes', 'yes', 'maybe', 'no'],
            default: 'maybe',
        },
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        reportMarkdown: {
            type: String,
            required: true,
        },
        generatedBy: {
            type: String,
            default: null,
        },
        humanReviewStatus: { type: String, enum: ['pending', 'reviewed'], default: 'pending' },
        reviewedBy: { type: String, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

CandidateReportSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 });
CandidateReportSchema.index({ organizationId: 1, jobId: 1, createdAt: -1 });

export const CandidateReport = mongoose.model<ICandidateReportDocument>(
    'CandidateReport',
    CandidateReportSchema
);
