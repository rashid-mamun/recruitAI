import mongoose, { Schema } from 'mongoose';
import type { IInterviewAnalysisDocument } from '@/types';

const EvidenceSchema = new Schema(
    {
        label: { type: String, required: true, trim: true },
        quote: { type: String, required: true, trim: true },
        speaker: { type: String, default: '' },
        segmentId: { type: Schema.Types.ObjectId, ref: 'TranscriptSegment', default: null },
    },
    { _id: false }
);

const InterviewAnalysisSchema = new Schema<IInterviewAnalysisDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        interviewId: {
            type: Schema.Types.ObjectId,
            ref: 'Interview',
            required: true,
            index: true,
        },
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: 'Candidate',
            required: true,
            index: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['processing', 'completed', 'failed'],
            default: 'processing',
        },
        executiveSummary: { type: String, default: '' },
        technicalSignals: { type: [String], default: [] },
        behavioralSignals: { type: [String], default: [] },
        communicationSignals: { type: [String], default: [] },
        riskFlags: { type: [String], default: [] },
        evidence: { type: [EvidenceSchema], default: [] },
        recommendation: {
            type: String,
            enum: ['strong_yes', 'yes', 'maybe', 'no'],
            default: 'maybe',
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
        },
        aiModel: { type: String, default: 'local-rule-based' },
        source: {
            type: String,
            enum: ['ai', 'fallback'],
            default: 'fallback',
        },
        error: { type: String, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

InterviewAnalysisSchema.index({ organizationId: 1, interviewId: 1, createdAt: -1 });
InterviewAnalysisSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 });

export const InterviewAnalysis = mongoose.model<IInterviewAnalysisDocument>(
    'InterviewAnalysis',
    InterviewAnalysisSchema
);
