import { Notification } from './notification.model';

export async function createNotification(input: {
    organizationId: string;
    recipientUserId?: string | null;
    type: string;
    message: string;
    link?: string | null;
}) {
    return (await Notification.create(input)).toJSON();
}
export async function listNotifications(organizationId: string, userId: string) {
    return Notification.find({
        organizationId,
        $or: [{ recipientUserId: userId }, { recipientUserId: null }],
    })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
}
export async function markRead(organizationId: string, userId: string, id: string) {
    return Notification.findOneAndUpdate(
        { _id: id, organizationId, $or: [{ recipientUserId: userId }, { recipientUserId: null }] },
        { $set: { read: true, readAt: new Date() } },
        { new: true }
    ).lean();
}
export async function markAllRead(organizationId: string, userId: string) {
    await Notification.updateMany(
        {
            organizationId,
            $or: [{ recipientUserId: userId }, { recipientUserId: null }],
            read: false,
        },
        { $set: { read: true, readAt: new Date() } }
    );
}
export async function clearNotifications(organizationId: string, userId: string) {
    await Notification.deleteMany({ organizationId, recipientUserId: userId });
}
