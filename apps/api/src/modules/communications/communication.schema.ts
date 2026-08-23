import { z } from 'zod';

export const templateSchema = z.object({
    name: z.string().trim().min(2).max(160),
    kind: z.enum(['outreach', 'rejection', 'interview_invite']),
    subject: z.string().trim().min(1).max(300),
    body: z.string().min(1).max(30000),
});
export const sendEmailSchema = z
    .object({
        templateId: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .optional(),
        subject: z.string().trim().min(1).max(300).optional(),
        body: z.string().min(1).max(30000).optional(),
    })
    .refine(value => value.templateId || (value.subject && value.body), {
        message: 'Provide templateId or subject and body',
    });
export const deliveryEventSchema = z.object({
    providerMessageId: z.string().min(1),
    event: z.enum(['delivered', 'failed', 'replied']),
    error: z.string().max(2000).optional(),
});
