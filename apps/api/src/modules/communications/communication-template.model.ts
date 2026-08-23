import mongoose, { Schema } from 'mongoose';

const CommunicationTemplateSchema = new Schema(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        name: { type: String, required: true, trim: true, maxlength: 160 },
        kind: {
            type: String,
            enum: ['outreach', 'rejection', 'interview_invite'],
            required: true,
            index: true,
        },
        subject: { type: String, required: true, trim: true, maxlength: 300 },
        body: { type: String, required: true, maxlength: 30000 },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);
CommunicationTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });
export const CommunicationTemplate = mongoose.model(
    'CommunicationTemplate',
    CommunicationTemplateSchema
);
