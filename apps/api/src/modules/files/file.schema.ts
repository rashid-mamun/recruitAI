import { z } from 'zod';

export const uploadFileSchema = z.object({
    ownerType: z.enum(['candidate', 'interview', 'report', 'general']).default('general'),
    ownerId: z
        .string()
        .regex(/^[a-f\d]{24}$/i, 'Owner ID must be a valid Mongo ID')
        .optional()
        .nullable(),
    kind: z.enum(['resume', 'transcript', 'audio', 'report', 'other']).default('other'),
    filename: z.string().trim().min(1).max(220),
    mimeType: z.string().trim().min(1).max(160),
    contentBase64: z.string().min(1),
    extractedText: z.string().max(200000).optional().default(''),
});
export type UploadFileDto = z.infer<typeof uploadFileSchema>;

export const fileQuerySchema = z.object({
    ownerType: z.enum(['candidate', 'interview', 'report', 'general']),
    ownerId: z
        .string()
        .regex(/^[a-f\d]{24}$/i, 'Owner ID must be a valid Mongo ID')
        .optional(),
});
export type FileQueryDto = z.infer<typeof fileQuerySchema>;
