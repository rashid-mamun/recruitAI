import mongoose, { Schema } from 'mongoose';
import type { IInterviewDocument, InterviewStatus, InterviewType } from '@/types';

const InterviewSchema = new Schema<IInterviewDocument>(
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
            index: true,
        },
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: 'Candidate',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 180,
        },
        round: {
            type: String,
            default: 'Round 1',
            trim: true,
            maxlength: 80,
        },
        type: {
            type: String,
            enum: [
                'screening',
                'technical',
                'behavioral',
                'system_design',
                'final',
            ] satisfies InterviewType[],
            default: 'technical',
        },
        status: {
            type: String,
            enum: [
                'draft',
                'scheduled',
                'completed',
                'analyzing',
                'analysis_ready',
                'reviewed',
                'cancelled',
            ] satisfies InterviewStatus[],
            default: 'draft',
        },
        scheduledAt: {
            type: Date,
            default: null,
        },
        durationMinutes: {
            type: Number,
            min: 0,
            max: 600,
            default: null,
        },
        interviewerNames: {
            type: [String],
            default: [],
        },
        interviewerIds: { type: [String], default: [], index: true },
        transcriptFileId: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
        audioFileId: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
        notes: {
            type: String,
            default: '',
        },
        transcriptText: {
            type: String,
            default: '',
        },
        analysisId: {
            type: Schema.Types.ObjectId,
            ref: 'InterviewAnalysis',
            default: null,
        },
        calendarEventUrl: { type: String, default: null },
        inviteSentAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

InterviewSchema.index({ jobId: 1, candidateId: 1, createdAt: -1 });
InterviewSchema.index({ organizationId: 1, jobId: 1, candidateId: 1, createdAt: -1 });
InterviewSchema.index({ status: 1, updatedAt: -1 });

export const Interview = mongoose.model<IInterviewDocument>('Interview', InterviewSchema);
