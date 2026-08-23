import mongoose, { Schema, Document } from 'mongoose';

export interface IDemoRequestDocument extends Document {
    type: 'demo' | 'contact';
    name: string;
    email: string;
    company?: string;
    role?: string;
    message: string;
    status: 'new' | 'contacted' | 'closed';
    sourcePage?: string;
    ip?: string | null;
    userAgent?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const DemoRequestSchema = new Schema<IDemoRequestDocument>(
    {
        type: {
            type: String,
            enum: ['demo', 'contact'],
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 180,
            index: true,
        },
        company: {
            type: String,
            default: '',
            trim: true,
            maxlength: 160,
        },
        role: {
            type: String,
            default: '',
            trim: true,
            maxlength: 160,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000,
        },
        status: {
            type: String,
            enum: ['new', 'contacted', 'closed'],
            default: 'new',
            index: true,
        },
        sourcePage: {
            type: String,
            default: '',
            trim: true,
        },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

DemoRequestSchema.index({ createdAt: -1 });

export const DemoRequest = mongoose.model<IDemoRequestDocument>('DemoRequest', DemoRequestSchema);
