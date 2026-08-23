import mongoose, { Schema } from 'mongoose';
import type { IFileAssetDocument } from '@/types';

const FileAssetSchema = new Schema<IFileAssetDocument>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
            index: true,
        },
        ownerType: {
            type: String,
            enum: ['candidate', 'interview', 'report', 'general'],
            default: 'general',
            index: true,
        },
        ownerId: {
            type: Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        kind: {
            type: String,
            enum: ['resume', 'transcript', 'audio', 'report', 'other'],
            default: 'other',
            index: true,
        },
        filename: { type: String, required: true, trim: true },
        mimeType: { type: String, required: true, trim: true },
        size: { type: Number, required: true, min: 0 },
        storageKey: { type: String, required: true },
        storageProvider: {
            type: String,
            enum: ['local', 's3', 'cloudinary'],
            default: 'local',
            index: true,
        },
        checksum: { type: String, required: true, index: true },
        scanStatus: {
            type: String,
            enum: ['pending', 'clean', 'infected', 'skipped'],
            default: 'pending',
            index: true,
        },
        scanDetails: { type: String, default: '' },
        uploadedBy: { type: String, default: null },
        extractedText: { type: String, default: '' },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

FileAssetSchema.index({ organizationId: 1, ownerType: 1, ownerId: 1, createdAt: -1 });
FileAssetSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });

export const FileAsset = mongoose.model<IFileAssetDocument>('FileAsset', FileAssetSchema);
