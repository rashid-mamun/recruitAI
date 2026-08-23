import { z } from 'zod';

export const inviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'recruiter', 'interviewer', 'viewer']).default('recruiter'),
});

export const updateMemberSchema = z.object({
    role: z.enum(['owner', 'admin', 'recruiter', 'interviewer', 'viewer']).optional(),
    status: z.enum(['active', 'disabled']).optional(),
});

export const acceptInviteSchema = z.object({
    token: z.string().min(20),
});

export const billingCheckoutSchema = z.object({
    plan: z.enum(['pro', 'enterprise']),
});

export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
