import crypto from 'crypto';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '@/config/env';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { NotFoundError, ValidationError } from '@/middleware/errorHandler';
import { organizationFilter, organizationObjectId } from '@/utils/tenant';
import { FileAsset } from './file-asset.model';
import { scanFile } from './file-scan.service';
import { getStorageProvider } from './storage.provider';
import type { IFileAsset } from '@/types';
import type { UploadFileDto } from './file.schema';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
]);

export async function uploadFile(
    dto: UploadFileDto,
    uploadedBy?: string | null,
    organizationId?: string
): Promise<IFileAsset> {
    const buffer = Buffer.from(dto.contentBase64, 'base64');
    if (buffer.byteLength === 0) throw new ValidationError('Uploaded file is empty');
    const maxBytes =
        dto.kind === 'audio'
            ? env.STORAGE_PROVIDER === 'cloudinary'
                ? 10 * 1024 * 1024
                : MAX_AUDIO_BYTES
            : MAX_FILE_BYTES;
    if (buffer.byteLength > maxBytes)
        throw new ValidationError(`File must be ${maxBytes / 1024 / 1024}MB or smaller`);

    if (dto.kind === 'resume' && !ALLOWED_MIME_TYPES.has(dto.mimeType)) {
        throw new ValidationError('Resume must be a PDF, DOC, DOCX, or plain text file');
    }
    if (dto.kind === 'audio' && !dto.mimeType.startsWith('audio/')) {
        throw new ValidationError('Audio upload must use an audio MIME type');
    }

    if (dto.ownerType === 'candidate' && dto.ownerId) {
        const candidate = await Candidate.findOne({
            _id: dto.ownerId,
            ...organizationFilter(organizationId),
        }).lean();
        if (!candidate) throw new NotFoundError('Candidate');
    }
    if (dto.ownerType === 'interview' && dto.ownerId) {
        const interview = await Interview.findOne({
            _id: dto.ownerId,
            ...organizationFilter(organizationId),
        }).lean();
        if (!interview) throw new NotFoundError('Interview');
    }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = path.extname(dto.filename).slice(0, 16);
    const storageKey = `${dto.ownerType}/${dto.kind}/${Date.now()}-${checksum.slice(0, 16)}${ext}`;
    const scan = await scanFile(buffer, dto.filename);
    if (scan.status === 'infected') {
        throw new ValidationError(`File rejected by malware scan: ${scan.details}`);
    }

    const stored = await getStorageProvider().put(storageKey, buffer);

    const asset = await FileAsset.create({
        ownerType: dto.ownerType,
        organizationId: organizationObjectId(organizationId) ?? null,
        ownerId: dto.ownerId ? new mongoose.Types.ObjectId(dto.ownerId) : null,
        kind: dto.kind,
        filename: dto.filename,
        mimeType: dto.mimeType,
        size: buffer.byteLength,
        storageKey: stored.key,
        storageProvider: stored.provider,
        checksum,
        scanStatus: scan.status,
        scanDetails: scan.details,
        uploadedBy: uploadedBy ?? null,
        extractedText: dto.extractedText || extractPlainText(dto.mimeType, buffer),
    });

    if (dto.ownerType === 'candidate' && dto.kind === 'resume' && dto.ownerId) {
        await Candidate.findByIdAndUpdate(dto.ownerId, {
            $set: {
                resumeFileId: asset._id,
                resumeText: asset.extractedText ?? '',
            },
        });
    }

    return asset.toJSON() as unknown as IFileAsset;
}

export async function listFiles(
    ownerType: string,
    ownerId?: string,
    organizationId?: string
): Promise<IFileAsset[]> {
    const filter: Record<string, unknown> = { ownerType, ...organizationFilter(organizationId) };
    if (ownerId) filter.ownerId = new mongoose.Types.ObjectId(ownerId);

    return (await FileAsset.find(filter).sort({ createdAt: -1 }).lean()) as unknown as IFileAsset[];
}

export async function getFileContent(
    fileId: string,
    organizationId?: string
): Promise<{
    asset: IFileAsset;
    buffer: Buffer;
}> {
    const asset = await FileAsset.findOne({
        _id: fileId,
        ...organizationFilter(organizationId),
    }).lean();
    if (!asset) throw new NotFoundError('File');

    const buffer = await getStorageProvider((asset as any).storageProvider ?? 'local').get(
        (asset as any).storageKey
    );
    return { asset: asset as unknown as IFileAsset, buffer };
}

function extractPlainText(mimeType: string, buffer: Buffer): string {
    if (mimeType === 'text/plain') return buffer.toString('utf8').slice(0, 200000);
    return '';
}
