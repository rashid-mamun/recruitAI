import mongoose, { Schema, Document } from 'mongoose';
import type { IJobDocument, JobType, JobStatus } from '@/types';

const JobSchema = new Schema<IJobDocument>(
    {
        title: {
            type: String,
            required: [true, 'Job title is required'],
            trim: true,
            maxlength: [200, 'Title must be under 200 characters'],
        },
        description: {
            type: String,
            required: [true, 'Job description is required'],
            trim: true,
        },
        requirements: {
            type: [String],
            default: [],
        },
        location: {
            type: String,
            required: [true, 'Location is required'],
            trim: true,
        },
        type: {
            type: String,
            enum: ['full-time', 'part-time', 'contract', 'internship'] satisfies JobType[],
            default: 'full-time',
        },
        status: {
            type: String,
            enum: ['active', 'paused', 'closed'] satisfies JobStatus[],
            default: 'active',
        },
        sourcingQueries: {
            type: [String],
            default: [],
        },
        deletedAt: {
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

JobSchema.index({ status: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ title: 'text', description: 'text' });

JobSchema.pre(/^find/, function (this: mongoose.Query<unknown, IJobDocument>, next) {
    this.where({ deletedAt: null });
    next();
});

export const Job = mongoose.model<IJobDocument>('Job', JobSchema);
