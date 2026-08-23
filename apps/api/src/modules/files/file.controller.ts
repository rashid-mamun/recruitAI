import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import * as FileService from './file.service';
import { fileQuerySchema, uploadFileSchema } from './file.schema';
import { getAuthUser } from '@/utils/tenant';

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
    const dto = uploadFileSchema.parse(req.body);
    const auth = getAuthUser(req);
    const asset = await FileService.uploadFile(dto, auth.userId, auth.organizationId);
    res.status(201).json({ success: true, data: asset });
});

export const listFiles = asyncHandler(async (req: Request, res: Response) => {
    const query = fileQuerySchema.parse(req.query);
    const files = await FileService.listFiles(
        query.ownerType,
        query.ownerId,
        getAuthUser(req).organizationId
    );
    res.json({ success: true, data: files });
});

export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
    const { asset, buffer } = await FileService.getFileContent(
        req.params.fileId,
        getAuthUser(req).organizationId
    );
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', buffer.byteLength);
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeFilename(asset.filename)}"`
    );
    res.send(buffer);
});

function sanitizeFilename(filename: string): string {
    return filename.replace(/[\r\n"]/g, '').slice(0, 220) || 'download';
}
