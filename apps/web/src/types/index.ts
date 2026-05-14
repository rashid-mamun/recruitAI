export interface User {
    id: string;
    name: string;
    email: string;
}

export interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// ─── Enums──
export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type JobStatus = 'active' | 'paused' | 'closed';

export type CandidateStatus =
    | 'sourced'
    | 'scored'
    | 'contacted'
    | 'responded'
    | 'scheduling'
    | 'rejected'
    | 'new'
    | 'interested'
    | 'hired'
    | 'not_interested';

export type TaskType = 'sourcing' | 'scoring' | 'outreach';
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type MessageChannel = 'email' | 'linkedin';
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'replied';
export type IntentType = 'interested' | 'not_interested' | 'maybe';

// ─── Job────
export interface Job {
    _id: string;
    title: string;
    description: string;
    requirements: string[];
    location: string;
    type: JobType;
    status: JobStatus;
    sourcingQueries: string[];
    candidateCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface JobStats {
    sourced: number;
    scored: number;
    contacted: number;
    responded: number;
    interested: number;
    not_interested: number;
    neutral: number;
    hired: number;
    responseRate: number;
    interestRate: number;
    avgScore: number;
    topScore: number | null;
    avgResponseTimeHours: number;
}

// ─── Candidate Score ──
export interface CandidateScore {
    value: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    cachedAt: string;
    source?: 'ai' | 'fallback';
}

// ─── Candidate
export interface Candidate {
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
    source: string;
    status: CandidateStatus;
    score?: CandidateScore;
    outreachMessages: string[];
    tags?: string[];
    notes?: string;
    starred?: boolean;
    createdAt: string;
    updatedAt: string;
}

// ─── Task───
export interface Task {
    _id: string;
    type: TaskType;
    jobId?: string;
    candidateId?: string;
    status: TaskStatus;
    progress: number;
    result?: Record<string, unknown>;
    error?: string;
    attempts: number;
    createdAt: string;
    completedAt?: string;
}

// ─── Message
export interface Message {
    _id: string;
    candidateId: string;
    jobId: string;
    content: string;
    role: 'ai' | 'candidate' | 'system';
    channel: MessageChannel;
    status: MessageStatus;
    source?: 'ai' | 'fallback';
    intent?: IntentType;
    intentConfidence?: number;
    schedulingLink?: string;
    sentAt?: string;
    repliedAt?: string;
    createdAt: string;
}

// ─── Notification ────
export type NotificationType = 'scored' | 'sourced' | 'responded' | 'outreach_sent' | 'hired';

export interface AppNotification {
    id: string;
    type: NotificationType;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
}

// ─── API Response Shapes ───────────
export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: string;
    code?: string;
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
