import { z } from 'zod';

export const publicLeadSchema = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    company: z.string().trim().max(160).optional().default(''),
    role: z.string().trim().max(160).optional().default(''),
    message: z.string().trim().min(10).max(5000),
    sourcePage: z.string().trim().max(300).optional().default(''),
});
export type PublicLeadDto = z.infer<typeof publicLeadSchema>;

export const demoRequestQuerySchema = z.object({
    status: z.enum(['new', 'contacted', 'closed']).optional(),
    type: z.enum(['demo', 'contact']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(25),
});
