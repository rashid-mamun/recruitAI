import mongoose, { Schema } from 'mongoose';
import type { ITranscriptSegmentDocument } from '@/types';

const TranscriptSegmentSchema = new Schema<ITranscriptSegmentDocument>(
    {
        interviewId: {
            type: Schema.Types.ObjectId,
            ref: 'Interview',
            required: true,
            index: true,
        },
        speaker: {
            type: String,
            required: true,
            trim: true,
            default: 'Unknown',
        },
        speakerRole: {
            type: String,
            enum: ['candidate', 'interviewer', 'unknown'],
            default: 'unknown',
        },
        startTime: {
            type: Number,
            default: null,
        },
        endTime: {
            type: Number,
            default: null,
        },
        text: {
            type: String,
            required: true,
            trim: true,
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

TranscriptSegmentSchema.index({ interviewId: 1, createdAt: 1 });
TranscriptSegmentSchema.index({ text: 'text' });

export const TranscriptSegment = mongoose.model<ITranscriptSegmentDocument>(
    'TranscriptSegment',
    TranscriptSegmentSchema
);
