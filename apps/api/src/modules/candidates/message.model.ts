import mongoose, { Schema, Document } from 'mongoose';
import type { IMessageDocument, MessageChannel, MessageStatus, IntentType } from '@/types';

const MessageSchema = new Schema<IMessageDocument>(
    {
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: 'Candidate',
            required: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['ai', 'candidate', 'system'],
            default: 'ai',
        },
        channel: {
            type: String,
            enum: ['email', 'linkedin'] satisfies MessageChannel[],
            default: 'linkedin',
        },
        source: {
            type: String,
            enum: ['ai', 'fallback'],
            default: 'ai',
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed', 'replied'] satisfies MessageStatus[],
            default: 'pending',
        },
        intent: {
            type: String,
            enum: ['interested', 'not_interested', 'maybe'] satisfies IntentType[],
            default: null,
        },
        intentConfidence: {
            type: Number,
            min: 0,
            max: 1,
            default: null,
        },
        schedulingLink: {
            type: String,
            default: null,
        },
        sentAt: {
            type: Date,
            default: null,
        },
        repliedAt: {
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

MessageSchema.index({ candidateId: 1 });
MessageSchema.index({ jobId: 1 });
MessageSchema.index({ status: 1 });

export const Message = mongoose.model<IMessageDocument>('Message', MessageSchema);
