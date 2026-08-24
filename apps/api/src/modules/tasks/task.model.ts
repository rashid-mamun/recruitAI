import mongoose, { Schema } from 'mongoose';
import type { ITaskDocument, TaskType, TaskStatus } from '@/types';

const TaskSchema = new Schema<ITaskDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
            index: true,
        },
        type: {
            type: String,
            enum: ['sourcing', 'scoring', 'outreach', 'interview_analysis'] satisfies TaskType[],
            required: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            default: null,
        },
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: 'Candidate',
            default: null,
        },
        interviewId: {
            type: Schema.Types.ObjectId,
            ref: 'Interview',
            default: null,
        },
        status: {
            type: String,
            enum: ['queued', 'processing', 'completed', 'failed'] satisfies TaskStatus[],
            default: 'queued',
        },
        progress: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        result: {
            type: Schema.Types.Mixed,
            default: null,
        },
        error: {
            type: String,
            default: null,
        },
        bullJobId: {
            type: String,
            default: null,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        completedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

TaskSchema.index({ jobId: 1 });
TaskSchema.index({ candidateId: 1 });
TaskSchema.index({ interviewId: 1 });
TaskSchema.index({ status: 1, createdAt: -1 });
TaskSchema.index({ organizationId: 1, createdAt: -1 });

export const Task = mongoose.model<ITaskDocument>('Task', TaskSchema);
