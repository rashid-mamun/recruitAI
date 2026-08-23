import fs from 'fs/promises';
import path from 'path';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/config/env';
import { AppError, ValidationError } from '@/middleware/errorHandler';

export interface StoredObject {
    key: string;
    provider: 'local' | 's3' | 'cloudinary';
}

export interface StorageProvider {
    readonly name: 'local' | 's3' | 'cloudinary';
    put(key: string, buffer: Buffer): Promise<StoredObject>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
    readonly name = 'local' as const;

    async put(key: string, buffer: Buffer): Promise<StoredObject> {
        const targetPath = path.join(env.LOCAL_STORAGE_DIR, key);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, buffer);
        return { key, provider: this.name };
    }

    async get(key: string): Promise<Buffer> {
        return fs.readFile(path.join(env.LOCAL_STORAGE_DIR, key));
    }

    async delete(key: string): Promise<void> {
        await fs.rm(path.join(env.LOCAL_STORAGE_DIR, key), { force: true });
    }
}

class S3StorageProvider implements StorageProvider {
    readonly name = 's3' as const;
    private readonly client: S3Client;

    constructor() {
        if (
            !env.S3_BUCKET ||
            !env.S3_REGION ||
            !env.S3_ACCESS_KEY_ID ||
            !env.S3_SECRET_ACCESS_KEY
        ) {
            throw new ValidationError('S3 storage is missing bucket, region, or credentials');
        }

        this.client = new S3Client({
            region: env.S3_REGION,
            endpoint: env.S3_ENDPOINT,
            forcePathStyle: env.S3_FORCE_PATH_STYLE,
            credentials: {
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            },
        });
    }

    async put(key: string, buffer: Buffer): Promise<StoredObject> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: key,
                Body: buffer,
            })
        );
        return { key, provider: this.name };
    }

    async get(key: string): Promise<Buffer> {
        const result = await this.client.send(
            new GetObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: key,
            })
        );

        if (!result.Body) {
            throw new AppError('Stored file body is empty', 500, 'STORAGE_READ_FAILED');
        }

        const chunks: Buffer[] = [];
        for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    async delete(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    }
}

class CloudinaryStorageProvider implements StorageProvider {
    readonly name = 'cloudinary' as const;

    constructor() {
        if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
            throw new ValidationError('Cloudinary storage credentials are missing');
        }
        cloudinary.config({
            cloud_name: env.CLOUDINARY_CLOUD_NAME,
            api_key: env.CLOUDINARY_API_KEY,
            api_secret: env.CLOUDINARY_API_SECRET,
            secure: true,
        });
    }

    async put(key: string, buffer: Buffer): Promise<StoredObject> {
        await new Promise<void>((resolve, reject) => {
            const upload = cloudinary.uploader.upload_stream(
                { public_id: key, resource_type: 'raw', type: 'authenticated', overwrite: true },
                error => (error ? reject(error) : resolve())
            );
            upload.end(buffer);
        });
        return { key, provider: this.name };
    }

    async get(key: string): Promise<Buffer> {
        const signedUrl = cloudinary.url(key, {
            resource_type: 'raw',
            type: 'authenticated',
            sign_url: true,
            secure: true,
        });
        const response = await axios.get<ArrayBuffer>(signedUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }

    async delete(key: string): Promise<void> {
        await cloudinary.uploader.destroy(key, {
            resource_type: 'raw',
            type: 'authenticated',
            invalidate: true,
        });
    }
}

export function getStorageProvider(provider = env.STORAGE_PROVIDER): StorageProvider {
    if (provider === 's3') return new S3StorageProvider();
    if (provider === 'cloudinary') return new CloudinaryStorageProvider();
    return new LocalStorageProvider();
}
