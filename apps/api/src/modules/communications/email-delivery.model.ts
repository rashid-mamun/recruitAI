import mongoose, { Schema } from 'mongoose';

const EmailDeliverySchema = new Schema(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
        interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', default: null },
        templateId: { type: Schema.Types.ObjectId, ref: 'CommunicationTemplate', default: null },
        to: { type: String, required: true },
        subject: { type: String, required: true },
        body: { type: String, required: true },
        status: {
            type: String,
            enum: ['preview', 'sent', 'delivered', 'failed', 'replied'],
            required: true,
            index: true,
        },
        provider: { type: String, enum: ['smtp', 'preview'], required: true },
        providerMessageId: { type: String, default: null, index: true },
        error: { type: String, default: null },
        sentBy: { type: String, required: true },
        sentAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        repliedAt: { type: Date, default: null },
    },
    { timestamps: true }
);
EmailDeliverySchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 });
export const EmailDelivery = mongoose.model('EmailDelivery', EmailDeliverySchema);
