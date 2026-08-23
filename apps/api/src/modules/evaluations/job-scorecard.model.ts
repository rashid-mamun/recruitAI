import mongoose, { Schema } from 'mongoose';
import type { IJobScorecardDocument } from '@/types';

const CompetencySchema = new Schema(
    {
        id: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        weight: { type: Number, min: 1, max: 100, required: true },
    },
    { _id: false }
);

const JobScorecardSchema = new Schema<IJobScorecardDocument>(
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
        name: {
            type: String,
            required: true,
            trim: true,
            default: 'Role Scorecard',
        },
        competencies: {
            type: [CompetencySchema],
            default: [],
        },
        passingScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 70,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

JobScorecardSchema.index({ organizationId: 1, jobId: 1 }, { unique: true });

export const JobScorecard = mongoose.model<IJobScorecardDocument>(
    'JobScorecard',
    JobScorecardSchema
);
