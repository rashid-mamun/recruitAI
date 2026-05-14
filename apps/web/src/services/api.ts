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

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
});

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
        const message =
            error.response?.data?.error ?? error.message ?? 'An unexpected error occurred';
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
