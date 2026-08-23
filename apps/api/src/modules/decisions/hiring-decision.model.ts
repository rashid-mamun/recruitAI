import mongoose, { Schema } from 'mongoose';

const HiringDecisionSchema = new Schema(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
        candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
        decision: {
            type: String,
            enum: ['shortlist', 'hold', 'reject', 'offer', 'hired'],
            required: true,
            index: true,
        },
        reason: { type: String, required: true, trim: true, maxlength: 5000 },
        decidedBy: { type: String, required: true },
        approvedBy: { type: String, default: null },
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

HiringDecisionSchema.index({ organizationId: 1, jobId: 1, candidateId: 1, createdAt: -1 });

export const HiringDecision = mongoose.model('HiringDecision', HiringDecisionSchema);
