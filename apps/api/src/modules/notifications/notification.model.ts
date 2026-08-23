import mongoose, { Schema } from 'mongoose';

const NotificationSchema = new Schema(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        recipientUserId: { type: String, default: null, index: true },
        type: { type: String, required: true, index: true },
        message: { type: String, required: true, trim: true, maxlength: 500 },
        link: { type: String, default: null, maxlength: 500 },
        read: { type: Boolean, default: false, index: true },
        readAt: { type: Date, default: null },
    },
    { timestamps: true }
);
NotificationSchema.index({ organizationId: 1, recipientUserId: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', NotificationSchema);
