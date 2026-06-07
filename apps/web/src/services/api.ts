import axios from 'axios';
import type { Job, Candidate, Message, ApiSuccess, JobStats } from '@/types';

const TOKEN_KEY = 'recruit-ai-token';
const LEGACY_TOKEN_KEY = 'token';

function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}

function handleUnauthorized() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
}

function getFriendlyErrorMessage(error: any): string {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const raw = String(error.response?.data?.error ?? error.message ?? '').toLowerCase();

    if (!error.response) {
        return 'Unable to connect. Please check your internet connection and try again.';
    }

    if (code === 'AUTH_PROVIDER_UNAVAILABLE' || raw.includes('google sign-in is not configured')) {
        return 'Google sign-in is temporarily unavailable. Please use email and password.';
    }

    if (code === 'GOOGLE_AUTH_FAILED' || raw.includes('google credential')) {
        return 'Google sign-in failed. Please try again or use email and password.';
    }

    if (status === 401) {
        return 'Your session has expired. Please sign in again.';
    }

    if (status === 403) {
        return 'You do not have permission to perform this action.';
    }

    if (status === 404) {
        return 'We could not find what you were looking for.';
    }

    if (status === 409) {
        return 'This item already exists.';
    }

    if (status === 429) {
        return 'Too many requests. Please wait a moment and try again.';
    }

    if (status >= 500) {
        return 'Something went wrong on our side. Please try again.';
    }

    return error.response?.data?.error ?? error.message ?? 'An unexpected error occurred.';
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
});

export function buildApiUrl(path: string): string {
    const baseURL = api.defaults.baseURL || window.location.origin;
    return new URL(path, baseURL).toString();
}

// ─── Request interceptor ──────────
api.interceptors.request.use(
    (config) => {
        config.headers['X-Correlation-ID'] = crypto.randomUUID();
        const token = getToken();
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error),
);

// ─── Response interceptor ─────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            handleUnauthorized();
        }
        const message = getFriendlyErrorMessage(error);
        return Promise.reject(new Error(message));
    },
);

// ─── Jobs───
export const getJobs = (params?: Record<string, unknown>) =>
    api.get<ApiSuccess<Job[]>>('/api/jobs', { params }).then((r) => r.data.data);

export const getJob = (id: string) =>
    api.get<ApiSuccess<Job>>(`/api/jobs/${id}`).then((r) => r.data.data);

export const createJob = (dto: Partial<Job>) =>
    api.post<ApiSuccess<Job>>('/api/jobs', dto).then((r) => r.data.data);

export const updateJob = (id: string, dto: Partial<Job>) =>
    api.patch<ApiSuccess<Job>>(`/api/jobs/${id}`, dto).then((r) => r.data.data);

export const deleteJob = (id: string) => api.delete(`/api/jobs/${id}`).then((r) => r.data);

export const duplicateJob = (id: string) =>
    api.post<ApiSuccess<Job>>(`/api/jobs/${id}/duplicate`).then((r) => r.data.data);

export const getJobStats = (id: string) =>
    api.get<ApiSuccess<JobStats>>(`/api/jobs/${id}/stats`).then((r) => r.data.data);

export const getGlobalStats = () =>
    api.get<ApiSuccess<any>>('/api/stats/global').then((r) => r.data.data);

// ─── Candidates ──────
export interface CandidateFilters {
    jobId?: string;
    status?: string;
    minScore?: number;
    maxScore?: number;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
}

export const getCandidates = (filters: CandidateFilters = {}) =>
    api.get<any>('/api/candidates', { params: filters }).then((r) => {
        const candidates = r.data.candidates ?? r.data.data ?? [];
        const pagination = r.data.pagination ?? {
            page: r.data.page ?? 1,
            limit: r.data.limit ?? filters.limit ?? 25,
            total: r.data.total ?? 0,
            totalPages: r.data.pages ?? r.data.totalPages ?? 1,
        };
        return { data: candidates as Candidate[], pagination };
    });

export const getJobCandidates = (jobId: string, params?: Record<string, unknown>) =>
    api.get<any>(`/api/jobs/${jobId}/candidates`, { params }).then((r) => ({
        data: r.data.data as Candidate[],
        pagination: r.data.pagination,
    }));

export const getCandidate = (id: string) =>
    api.get<ApiSuccess<Candidate>>(`/api/candidates/${id}`).then((r) => r.data.data);

export const updateCandidate = (
    id: string,
    dto: { status?: string; tags?: string[]; notes?: string; starred?: boolean },
) =>
    api.patch<ApiSuccess<Candidate>>(`/api/candidates/${id}`, dto).then((r) => {
        window.dispatchEvent(new CustomEvent('recruit:stats-changed'));
        return r.data.data;
    });

export const scoreCandidate = (id: string) =>
    api
        .post<ApiSuccess<{ taskId: string; status: string }>>(`/api/candidates/${id}/scores`)
        .then((r) => r.data.data);

export const sendOutreach = (id: string, jobId: string) =>
    api
        .post<
            ApiSuccess<{ taskId: string; status: string }>
        >(`/api/candidates/${id}/outreach`, { jobId })
        .then((r) => {
            window.dispatchEvent(new CustomEvent('recruit:stats-changed'));
            return r.data.data;
        });

export const sendResponse = (id: string, message: string) =>
    api.post(`/api/candidates/${id}/responses`, { message }).then((r) => {
        window.dispatchEvent(new CustomEvent('recruit:stats-changed'));
        return r.data.data;
    });

export const getCandidateMessages = (id: string) =>
    api.get<ApiSuccess<Message[]>>(`/api/candidates/${id}/messages`).then((r) => r.data.data);
