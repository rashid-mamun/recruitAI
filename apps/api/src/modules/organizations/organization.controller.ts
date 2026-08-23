import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as OrganizationService from './organization.service';
import { handleStripeWebhook } from './billing.service';
import {
    acceptInviteSchema,
    billingCheckoutSchema,
    inviteMemberSchema,
    updateMemberSchema,
} from './organization.schema';

export const listMyOrganizations = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await OrganizationService.listMyOrganizations(userId);
    res.json({ success: true, data: result });
});

export const getCurrentOrganization = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const organization = await OrganizationService.getOrganizationForUser(userId, organizationId);
    res.json({ success: true, data: organization });
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const members = await OrganizationService.listOrganizationMembers(userId, organizationId);
    res.json({ success: true, data: members });
});

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const dto = inviteMemberSchema.parse(req.body);
    const invite = await OrganizationService.inviteMember(userId, organizationId, dto);
    res.status(201).json({ success: true, data: invite });
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const dto = acceptInviteSchema.parse(req.body);
    const membership = await OrganizationService.acceptInvite(dto.token, userId);
    res.json({ success: true, data: membership });
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const dto = updateMemberSchema.parse(req.body);
    const membership = await OrganizationService.updateMember(
        userId,
        organizationId,
        req.params.membershipId,
        dto
    );
    res.json({ success: true, data: membership });
});

export const createBillingCheckout = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const dto = billingCheckoutSchema.parse(req.body);
    const checkout = await OrganizationService.createBillingCheckout(
        userId,
        organizationId,
        dto.plan
    );
    res.status(201).json({ success: true, data: checkout });
});

export const getBillingStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const billing = await OrganizationService.getBillingStatus(userId, organizationId);
    res.json({ success: true, data: billing });
});

export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
    await handleStripeWebhook(req.body as Buffer, req.get('stripe-signature') ?? undefined);
    res.json({ received: true });
});
