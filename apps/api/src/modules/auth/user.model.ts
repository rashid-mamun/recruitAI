import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import type { IUserDocument, UserRole } from '@/types';

const UserSchema = new Schema<IUserDocument>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            select: false,
        },
        name: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['admin', 'recruiter'] satisfies UserRole[],
            default: 'recruiter',
        },
    },
    {
        timestamps: true,
    }
);

UserSchema.pre<IUserDocument>('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password as string, salt);
        return next();
    } catch (error) {
        return next(error as Error);
    }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUserDocument>('User', UserSchema);
