import type { Request } from 'express';
import { AuditLog } from './audit-log.model';
import type { IAuditLog } from '@/types';
import { organizationObjectId } from '@/utils/tenant';

export async function recordAuditLog(opts: {
    req?: Request;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
}): Promise<void> {
    const user = opts.req ? (opts.req as any).user : null;
    if (!user?.organizationId) return;

    await AuditLog.create({
        organizationId: organizationObjectId(user.organizationId),
        actorUserId: user?.userId ?? user?.id ?? null,
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId ?? null,
        before: opts.before ?? null,
        after: opts.after ?? null,
        ip: opts.req?.ip ?? null,
        userAgent: opts.req?.headers['user-agent'] ?? null,
    });
}

export async function listAuditLogs(query: {
    organizationId: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
}): Promise<IAuditLog[]> {
    const filter: Record<string, unknown> = { organizationId: query.organizationId };
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.resourceId) filter.resourceId = query.resourceId;

    return (await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(query.limit ?? 50)
        .lean()) as unknown as IAuditLog[];
}
