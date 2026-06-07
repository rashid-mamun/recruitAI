import { Document, Types } from 'mongoose';

export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type JobStatus = 'active' | 'paused' | 'closed';

export type UserRole = 'admin' | 'recruiter';

export type CandidateStatus =
    | 'new'
    | 'sourced'
    | 'scored'
    | 'contacted'
    | 'interested'
    | 'responded'
    | 'scheduling'
    | 'hired'
    | 'rejected'
    | 'not_interested';

export type TaskType = 'sourcing' | 'scoring' | 'outreach';
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type MessageChannel = 'email' | 'linkedin';
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'replied';
export type IntentType = 'interested' | 'not_interested' | 'maybe';

export type SourcingProvider = 'serper' | 'puppeteer' | 'mock';

export interface IUser {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    authProvider?: 'email' | 'google';
    googleId?: string;
    password?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IJob {
    _id: string;
    title: string;
    description: string;
    requirements: string[];
    location: string;
    type: JobType;
    status: JobStatus;
    sourcingQueries: string[];
    candidateCount?: number;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICandidateScore {
    value: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    cachedAt: Date;
    source: 'ai' | 'fallback';
}

export interface ICandidate {
    _id: string;
    jobId: string;
    name: string;
    email?: string;
    linkedinUrl: string;
    headline: string;
    summary: string;
    skills: string[];
    experience: string;
    location: string;
    source: SourcingProvider | 'manual';
    starred?: boolean;
    status: CandidateStatus;
    score?: ICandidateScore;
    scoredAt?: Date;
    contactedAt?: Date;
    respondedAt?: Date;
    hiredAt?: Date;
    outreachMessages: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ITask {
    _id: string;
    type: TaskType;
    jobId?: string;
    candidateId?: string;
    status: TaskStatus;
    progress: number;
    result?: Record<string, unknown>;
    error?: string;
    bullJobId?: string;
    attempts: number;
    createdAt: Date;
    completedAt?: Date;
}

export interface IMessage {
    _id: string;
    candidateId: string;
    jobId: string;
    content: string;
    role?: 'ai' | 'candidate' | 'system';
    channel: MessageChannel;
    status: MessageStatus;
    source?: 'ai' | 'fallback';
    intent?: IntentType;
    intentConfidence?: number;
    schedulingLink?: string;
    sentAt?: Date;
    repliedAt?: Date;
    createdAt: Date;
}

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: string;
    code?: string;
    details?: Record<string, unknown>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface QueueStats {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

export interface SSEEvent {
    event: string;
    data: any;
}

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IJobDocument extends Omit<IJob, '_id'>, Document {}

export interface ICandidateDocument
    extends Omit<ICandidate, '_id' | 'jobId' | 'outreachMessages'>, Document {
    jobId: Types.ObjectId;
    outreachMessages: Types.ObjectId[];
}

export interface ITaskDocument extends Omit<ITask, '_id' | 'jobId' | 'candidateId'>, Document {
    jobId?: Types.ObjectId;
    candidateId?: Types.ObjectId;
}

export interface IMessageDocument
    extends Omit<IMessage, '_id' | 'candidateId' | 'jobId'>, Document {
    candidateId: Types.ObjectId;
    jobId: Types.ObjectId;
    role: 'ai' | 'candidate' | 'system';
}
