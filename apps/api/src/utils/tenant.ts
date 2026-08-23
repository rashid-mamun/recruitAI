import mongoose from 'mongoose';
import type { Request } from 'express';

export function getAuthUser(req: Request): {
    userId?: string;
    role?: string;
    organizationId?: string;
    workspaceRole?: string;
} {
    const user = (req as any).user ?? {};
    return {
        userId: user.userId || user.id,
        role: user.role,
        organizationId: user.organizationId,
        workspaceRole: user.workspaceRole,
    };
}

export function organizationFilter(organizationId?: string): Record<string, unknown> {
    if (!organizationId) return { _id: { $exists: false } };
    return { organizationId: new mongoose.Types.ObjectId(organizationId) };
}

export function organizationObjectId(organizationId?: string): mongoose.Types.ObjectId | undefined {
    return organizationId ? new mongoose.Types.ObjectId(organizationId) : undefined;
}
