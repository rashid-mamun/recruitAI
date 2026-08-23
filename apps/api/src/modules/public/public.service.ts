import type { Request } from 'express';
import { sendPublicLeadEmail } from '@/services/email.service';
import { DemoRequest } from './demo-request.model';
import type { PublicLeadDto } from './public.schema';

export async function createPublicLead(req: Request, type: 'demo' | 'contact', dto: PublicLeadDto) {
    const lead = await DemoRequest.create({
        type,
        ...dto,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
    });

    await sendPublicLeadEmail({ type, ...dto });

    return lead.toJSON();
}

export async function listPublicLeads(query: {
    type?: 'demo' | 'contact';
    status?: 'new' | 'contacted' | 'closed';
    page: number;
    limit: number;
}) {
    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
        DemoRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        DemoRequest.countDocuments(filter),
    ]);

    return {
        data,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
}
