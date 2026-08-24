import mongoose from 'mongoose';
import crypto from 'crypto';
import { Organization } from './organization.model';
import { Membership } from './membership.model';
import { User } from '@/modules/auth/user.model';
import { AppError, NotFoundError } from '@/middleware/errorHandler';
import { env } from '@/config/env';
import { createCheckoutSession } from './billing.service';
import type { IOrganization, IMembership, OrganizationPlan } from '@/types';
import type { InviteMemberDto, UpdateMemberDto } from './organization.schema';

export async function createDefaultOrganizationForUser(user: {
    _id: unknown;
    name: string;
    email: string;
    role?: string;
}): Promise<IOrganization> {
    const baseName = inferOrganizationName(user.email, user.name);
    const organization = await Organization.create({
        name: baseName,
        slug: await uniqueSlug(slugify(baseName)),
        plan: 'free',
        status: 'active',
        settings: {},
    });

    await Membership.create({
        organizationId: organization._id,
        userId: user._id,
        role: user.role === 'admin' ? 'admin' : 'owner',
        status: 'active',
    });

    await User.findByIdAndUpdate(user._id, {
        $set: { defaultOrganizationId: organization._id },
    });

    return organization.toJSON() as unknown as IOrganization;
}

export async function listOrganizationMembers(
    userId: string,
    organizationId: string
): Promise<Array<IMembership & { user?: { id: string; name: string; email: string } | null }>> {
    await requireManageAccess(userId, organizationId, false);
    const memberships = await Membership.find({ organizationId }).sort({ createdAt: 1 }).lean();
    const userIds = memberships.filter(item => item.userId).map(item => item.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const byId = new Map(users.map(user => [user._id.toString(), user]));

    return memberships.map(item => {
        const user = item.userId ? byId.get((item as any).userId.toString()) : null;
        return {
            ...(item as unknown as IMembership),
            user: user ? { id: user._id.toString(), name: user.name, email: user.email } : null,
        };
    });
}

export async function inviteMember(
    userId: string,
    organizationId: string,
    dto: InviteMemberDto
): Promise<IMembership & { inviteToken?: string }> {
    await requireManageAccess(userId, organizationId, true);
    const inviteToken = crypto.randomBytes(32).toString('base64url');
    const existingUser = await User.findOne({ email: dto.email.toLowerCase() }).lean();

    const membership = await Membership.findOneAndUpdate(
        {
            organizationId,
            invitedEmail: dto.email.toLowerCase(),
            status: { $in: ['invited', 'disabled'] },
        },
        {
            $set: {
                organizationId,
                userId: existingUser?._id ?? new mongoose.Types.ObjectId(),
                invitedEmail: dto.email.toLowerCase(),
                role: dto.role,
                status: 'invited',
                inviteTokenHash: hashToken(inviteToken),
                inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
        ...(membership.toJSON() as unknown as IMembership),
        inviteToken,
    };
}

export async function acceptInvite(token: string, userId: string): Promise<IMembership> {
    const membership = await Membership.findOne({
        inviteTokenHash: hashToken(token),
        status: 'invited',
        inviteExpiresAt: { $gt: new Date() },
    }).select('+inviteTokenHash +inviteExpiresAt');

    if (!membership) throw new AppError('Invalid or expired invite', 400, 'INVALID_INVITE');

    membership.userId = new mongoose.Types.ObjectId(userId) as any;
    membership.status = 'active';
    membership.inviteTokenHash = null;
    membership.inviteExpiresAt = null;
    await membership.save();

    await User.findByIdAndUpdate(userId, {
        $set: { defaultOrganizationId: membership.organizationId },
    });

    return membership.toJSON() as unknown as IMembership;
}

export async function updateMember(
    userId: string,
    organizationId: string,
    membershipId: string,
    dto: UpdateMemberDto
): Promise<IMembership> {
    await requireManageAccess(userId, organizationId, true);
    const membership = await Membership.findOne({ _id: membershipId, organizationId });
    if (!membership) throw new NotFoundError('Membership');

    if (membership.role === 'owner' && dto.status === 'disabled') {
        throw new AppError('Owner membership cannot be disabled', 400, 'OWNER_REQUIRED');
    }
    if (dto.role) membership.role = dto.role;
    if (dto.status) membership.status = dto.status;
    await membership.save();
    return membership.toJSON() as unknown as IMembership;
}

export async function createBillingCheckout(
    userId: string,
    organizationId: string,
    plan: Exclude<OrganizationPlan, 'free'>
): Promise<{ checkoutUrl: string; plan: string; mode: 'manual' | 'stripe'; sessionId?: string }> {
    await requireManageAccess(userId, organizationId, true);
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) throw new NotFoundError('Organization');

    if (env.BILLING_PROVIDER === 'stripe') {
        const session = await createCheckoutSession({
            organizationId,
            organizationName: organization.name,
            plan,
        });
        return {
            checkoutUrl: session.checkoutUrl,
            plan,
            mode: 'stripe',
            sessionId: session.sessionId,
        };
    }

    await Organization.findByIdAndUpdate(organizationId, {
        $set: {
            plan,
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
    });

    return {
        checkoutUrl: `/settings?billing=upgraded&plan=${plan}`,
        plan,
        mode: 'manual',
    };
}

export async function getBillingStatus(
    userId: string,
    organizationId: string
): Promise<Pick<IOrganization, 'plan' | 'subscriptionStatus' | 'currentPeriodEnd'>> {
    const organization = await getOrganizationForUser(userId, organizationId);
    return {
        plan: organization.plan,
        subscriptionStatus: organization.subscriptionStatus ?? 'none',
        currentPeriodEnd: organization.currentPeriodEnd ?? null,
    };
}

export async function ensureDefaultOrganization(
    user: any,
    preferredOrganizationId?: string | null
): Promise<IOrganization> {
    const preferredId = preferredOrganizationId ?? user.defaultOrganizationId?.toString?.();
    if (preferredId) {
        const [membership, organization] = await Promise.all([
            Membership.findOne({
                userId: user._id,
                organizationId: preferredId,
                status: 'active',
            }).lean(),
            Organization.findOne({ _id: preferredId, status: 'active' }).lean(),
        ]);
        if (membership && organization) {
            if (user.defaultOrganizationId?.toString?.() !== preferredId) {
                await User.findByIdAndUpdate(user._id, {
                    $set: { defaultOrganizationId: organization._id },
                });
            }
            return organization as unknown as IOrganization;
        }
    }

    const membership = await Membership.findOne({ userId: user._id, status: 'active' })
        .sort({ createdAt: 1 })
        .lean();
    if (membership) {
        const organization = await Organization.findOne({
            _id: membership.organizationId,
            status: 'active',
        }).lean();
        if (organization) {
            await User.findByIdAndUpdate(user._id, {
                $set: { defaultOrganizationId: organization._id },
            });
            return organization as unknown as IOrganization;
        }
    }

    return createDefaultOrganizationForUser(user);
}

export async function listMyOrganizations(userId: string): Promise<{
    memberships: Array<IMembership & { organization: IOrganization | null }>;
}> {
    const memberships = await Membership.find({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
    })
        .sort({ createdAt: 1 })
        .lean();

    const orgIds = memberships.map(item => item.organizationId);
    const organizations = await Organization.find({
        _id: { $in: orgIds },
        status: 'active',
    }).lean();
    const byId = new Map(organizations.map(org => [org._id.toString(), org]));

    return {
        memberships: memberships.map(item => ({
            ...(item as unknown as IMembership),
            organization:
                (byId.get((item as any).organizationId.toString()) as unknown as IOrganization) ??
                null,
        })),
    };
}

export async function getOrganizationForUser(
    userId: string,
    organizationId: string
): Promise<IOrganization> {
    const membership = await Membership.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        status: 'active',
    }).lean();
    if (!membership) throw new NotFoundError('Organization');

    const organization = await Organization.findById(organizationId).lean();
    if (!organization) throw new NotFoundError('Organization');
    return organization as unknown as IOrganization;
}

function inferOrganizationName(email: string, name: string): string {
    const domain = email.split('@')[1]?.split('.')[0];
    if (domain && !['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud'].includes(domain)) {
        return titleCase(domain);
    }
    return `${name}'s Workspace`;
}

function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'workspace'
    );
}

async function uniqueSlug(base: string): Promise<string> {
    for (let i = 0; i < 50; i += 1) {
        const slug = i === 0 ? base : `${base}-${i + 1}`;
        const exists = await Organization.exists({ slug });
        if (!exists) return slug;
    }
    return `${base}-${Date.now()}`;
}

function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

async function requireManageAccess(userId: string, organizationId: string, requireAdmin: boolean) {
    const membership = await Membership.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        status: 'active',
    }).lean();
    if (!membership) throw new NotFoundError('Organization');
    if (requireAdmin && !['owner', 'admin'].includes((membership as any).role)) {
        throw new AppError('You do not have permission to manage this workspace', 403, 'FORBIDDEN');
    }
    return membership;
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
