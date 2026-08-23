import axios from 'axios';
import type {
    Job,
    Candidate,
    Message,
    ApiSuccess,
    JobStats,
    Interview,
    InterviewAnalysis,
    TranscriptSegment,
    JobScorecard,
    ScorecardCompetency,
    Evaluation,
    CandidateComparison,
    CandidateReport,
    CollaborationResourceType,
    Comment,
    Review,
    AuditLog,
    FileAsset,
    Membership,
    Organization,
    HiringAnalytics,
    HiringDecision,
    CommunicationTemplate,
    EmailDelivery,
    ScorecardTemplate,
} from '@/types';

const TOKEN_KEY = 'recruit-ai-token';
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'recruit-ai-refresh-token';

function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}

function handleUnauthorized() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
}

function getFriendlyErrorMessage(error: any): string {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const raw = String(error.response?.data?.error ?? error.message ?? '').toLowerCase();
    const requestUrl = String(error.config?.url ?? '');

    if (!error.response) {
        return 'Unable to connect. Please check your internet connection and try again.';
    }

    if (code === 'AUTH_PROVIDER_UNAVAILABLE' || raw.includes('google sign-in is not configured')) {
        return 'Google sign-in is temporarily unavailable. Please use email and password.';
    }

    if (code === 'GOOGLE_AUTH_FAILED' || raw.includes('google credential')) {
        return 'Google sign-in failed. Please try again or use email and password.';
    }

    if (code === 'AUTH_PROVIDER_CONFLICT') {
        return (
            error.response?.data?.error ??
            'This email already uses password sign-in. Please sign in with email and password.'
        );
    }

    if (code === 'GOOGLE_IDENTITY_MISMATCH') {
        return 'This Google identity does not match the existing account.';
    }

    if (status === 401) {
        if (requestUrl.includes('/api/auth/login')) {
            return error.response?.data?.error ?? 'Incorrect email or password.';
        }
        if (requestUrl.includes('/api/auth/google')) {
            return error.response?.data?.error ?? 'Google sign-in failed.';
        }
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
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    refreshPromise ??= axios
        .post(
            '/api/auth/refresh',
            { refreshToken },
            {
                baseURL: api.defaults.baseURL,
                timeout: 30_000,
                headers: { 'Content-Type': 'application/json' },
            },
        )
        .then((res) => {
            const nextToken = res.data?.token ?? res.data?.data?.token;
            const nextRefreshToken = res.data?.refreshToken ?? res.data?.data?.refreshToken;
            if (!nextToken || !nextRefreshToken) return null;
            localStorage.setItem(TOKEN_KEY, nextToken);
            localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
            return nextToken as string;
        })
        .catch(() => null)
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isRefreshRequest = originalRequest?.url?.includes('/api/auth/refresh');
        const isPublicAuthRequest = /\/api\/auth\/(login|register|google|password-reset)/.test(
            String(originalRequest?.url ?? ''),
        );

        if (
            error.response?.status === 401 &&
            !originalRequest?._retry &&
            !isRefreshRequest &&
            !isPublicAuthRequest
        ) {
            originalRequest._retry = true;
            const nextToken = await refreshAccessToken();
            if (nextToken) {
                originalRequest.headers = originalRequest.headers ?? {};
                originalRequest.headers.Authorization = `Bearer ${nextToken}`;
                return api(originalRequest);
            }
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

// ─── File Assets / Resumes ──────
export interface UploadFilePayload {
    ownerType: FileAsset['ownerType'];
    ownerId?: string | null;
    kind: FileAsset['kind'];
    filename: string;
    mimeType: string;
    contentBase64: string;
    extractedText?: string;
}

export const uploadFileAsset = (payload: UploadFilePayload) =>
    api.post<ApiSuccess<FileAsset>>('/api/files', payload).then((r) => r.data.data);

export const getFileAssets = (ownerType: FileAsset['ownerType'], ownerId?: string) =>
    api
        .get<ApiSuccess<FileAsset[]>>('/api/files', { params: { ownerType, ownerId } })
        .then((r) => r.data.data);

export const downloadFileAsset = (fileId: string) =>
    api.get(`/api/files/${fileId}/download`, { responseType: 'blob' }).then((r) => r.data as Blob);

export const uploadInterviewAudio = async (interviewId: string, file: File) => {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read audio file'));
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.readAsDataURL(file);
    });
    return api
        .post<ApiSuccess<FileAsset>>(`/api/interviews/${interviewId}/audio`, {
            filename: file.name,
            mimeType: file.type || 'audio/mpeg',
            contentBase64,
        })
        .then((r) => r.data.data);
};

// ─── Workspace / Billing ─────
export const getMyOrganizations = () =>
    api
        .get<
            ApiSuccess<{ memberships: Array<Membership & { organization: Organization | null }> }>
        >('/api/organizations')
        .then((r) => r.data.data.memberships);

export const getCurrentOrganization = () =>
    api.get<ApiSuccess<Organization>>('/api/organizations/current').then((r) => r.data.data);

export const getOrganizationMembers = () =>
    api
        .get<ApiSuccess<Membership[]>>('/api/organizations/current/members')
        .then((r) => r.data.data);

export const inviteOrganizationMember = (dto: {
    email: string;
    role: 'admin' | 'recruiter' | 'interviewer' | 'viewer';
}) =>
    api
        .post<ApiSuccess<Membership>>('/api/organizations/current/invites', dto)
        .then((r) => r.data.data);

export const updateOrganizationMember = (
    membershipId: string,
    dto: { role?: Membership['role']; status?: 'active' | 'disabled' },
) =>
    api
        .patch<ApiSuccess<Membership>>(`/api/organizations/current/members/${membershipId}`, dto)
        .then((r) => r.data.data);

export const getBillingStatus = () =>
    api
        .get<
            ApiSuccess<Pick<Organization, 'plan' | 'subscriptionStatus' | 'currentPeriodEnd'>>
        >('/api/billing/status')
        .then((r) => r.data.data);

export const createBillingCheckout = (plan: 'pro' | 'enterprise') =>
    api
        .post<
            ApiSuccess<{
                checkoutUrl: string;
                plan: string;
                mode: 'manual' | 'stripe';
                sessionId?: string;
            }>
        >('/api/billing/checkout', { plan })
        .then((r) => r.data.data);

// ─── Interviews ─────
export interface InterviewFilters {
    jobId?: string;
    candidateId?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
}

export interface InterviewDetails {
    interview: Interview;
    transcriptSegments: TranscriptSegment[];
    analysis: InterviewAnalysis | null;
}

export const getInterviews = (filters: InterviewFilters = {}) =>
    api.get<any>('/api/interviews', { params: filters }).then((r) => ({
        data: (r.data.data ?? []) as Interview[],
        pagination: r.data.pagination ?? {
            page: 1,
            limit: filters.limit ?? 25,
            total: 0,
            totalPages: 1,
        },
    }));

export const getInterview = (id: string) =>
    api.get<ApiSuccess<InterviewDetails>>(`/api/interviews/${id}`).then((r) => r.data.data);

export const createInterview = (dto: Partial<Interview> & { jobId: string; candidateId: string }) =>
    api.post<ApiSuccess<Interview>>('/api/interviews', dto).then((r) => r.data.data);

export const updateInterview = (id: string, dto: Partial<Interview>) =>
    api.patch<ApiSuccess<Interview>>(`/api/interviews/${id}`, dto).then((r) => r.data.data);

export const updateInterviewTranscript = (id: string, transcriptText: string) =>
    api
        .post<
            ApiSuccess<{ interview: Interview; transcriptSegments: TranscriptSegment[] }>
        >(`/api/interviews/${id}/transcript`, { transcriptText })
        .then((r) => r.data.data);

export const analyzeInterview = (id: string) =>
    api
        .post<ApiSuccess<{ taskId: string; status: string }>>(`/api/interviews/${id}/analyze`)
        .then((r) => r.data.data);

// ─── Scorecards / Evaluations ─────
export const getJobScorecard = (jobId: string) =>
    api.get<ApiSuccess<JobScorecard>>(`/api/jobs/${jobId}/scorecard`).then((r) => r.data.data);

export const saveJobScorecard = (
    jobId: string,
    dto: { name: string; passingScore: number; competencies: ScorecardCompetency[] },
) =>
    api.put<ApiSuccess<JobScorecard>>(`/api/jobs/${jobId}/scorecard`, dto).then((r) => r.data.data);

export const evaluateCandidate = (jobId: string, candidateId: string) =>
    api
        .post<ApiSuccess<Evaluation>>(`/api/jobs/${jobId}/evaluations`, { candidateId })
        .then((r) => r.data.data);

export const getJobEvaluations = (jobId: string) =>
    api.get<ApiSuccess<Evaluation[]>>(`/api/jobs/${jobId}/evaluations`).then((r) => r.data.data);

export const getScorecardTemplates = () =>
    api.get<ApiSuccess<ScorecardTemplate[]>>('/api/scorecard-templates').then((r) => r.data.data);
export const createScorecardTemplate = (dto: {
    name: string;
    roleFamily: string;
    passingScore: number;
    competencies: ScorecardCompetency[];
}) =>
    api
        .post<ApiSuccess<ScorecardTemplate>>('/api/scorecard-templates', dto)
        .then((r) => r.data.data);
export const deleteScorecardTemplate = (id: string) => api.delete(`/api/scorecard-templates/${id}`);
export const applyScorecardTemplate = (jobId: string, templateId: string) =>
    api
        .post<
            ApiSuccess<JobScorecard>
        >(`/api/jobs/${jobId}/scorecard/apply-template`, { templateId })
        .then((r) => r.data.data);
export const overrideEvaluationScore = (
    evaluationId: string,
    dto: { competencyId: string; score: number; reason: string },
) =>
    api
        .patch<ApiSuccess<Evaluation>>(`/api/evaluations/${evaluationId}/override`, dto)
        .then((r) => r.data.data);
export const reviewEvaluation = (evaluationId: string) =>
    api
        .patch<
            ApiSuccess<Evaluation>
        >(`/api/evaluations/${evaluationId}/review`, { reviewStatus: 'reviewed' })
        .then((r) => r.data.data);

export const compareCandidates = (jobId: string, candidateIds: string[]) =>
    api
        .get<ApiSuccess<CandidateComparison>>(`/api/jobs/${jobId}/compare`, {
            params: { candidateIds: candidateIds.join(',') },
        })
        .then((r) => r.data.data);

// ─── Candidate Reports ─────
export const generateCandidateReport = (candidateId: string) =>
    api
        .post<ApiSuccess<CandidateReport>>(`/api/candidates/${candidateId}/reports`)
        .then((r) => r.data.data);

export const getCandidateReports = (candidateId: string) =>
    api
        .get<ApiSuccess<CandidateReport[]>>(`/api/candidates/${candidateId}/reports`)
        .then((r) => r.data.data);

export const getReportDownloadUrl = (reportId: string) =>
    buildApiUrl(`/api/reports/${reportId}/download`);

export const getReportPdfUrl = (reportId: string) => buildApiUrl(`/api/reports/${reportId}/pdf`);

export const downloadReportPdf = async (reportId: string) => {
    const response = await api.get<Blob>(`/api/reports/${reportId}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `candidate-report-${reportId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
};

export const getAnalytics = (jobId?: string) =>
    api
        .get<ApiSuccess<HiringAnalytics>>('/api/analytics', { params: { jobId } })
        .then((r) => r.data.data);

export const downloadAnalyticsCsv = async () => {
    const response = await api.get<Blob>('/api/analytics.csv', { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recruitai-analytics.csv';
    anchor.click();
    URL.revokeObjectURL(url);
};

export const createHiringDecision = (
    jobId: string,
    dto: {
        candidateId: string;
        decision: HiringDecision['decision'];
        reason: string;
        approvedBy?: string | null;
    },
) =>
    api
        .post<ApiSuccess<HiringDecision>>(`/api/jobs/${jobId}/decisions`, dto)
        .then((r) => r.data.data);

export const getHiringDecisions = (jobId: string) =>
    api.get<ApiSuccess<HiringDecision[]>>(`/api/jobs/${jobId}/decisions`).then((r) => r.data.data);

export interface GlobalSearchResults {
    candidates: Pick<Candidate, '_id' | 'name' | 'headline' | 'email' | 'jobId'>[];
    jobs: Pick<Job, '_id' | 'title' | 'status' | 'location'>[];
    interviews: Pick<Interview, '_id' | 'title' | 'candidateId' | 'jobId' | 'status'>[];
    transcriptSegments: {
        _id: string;
        interviewId: string;
        speaker: string;
        text: string;
        startTime?: number | null;
    }[];
    reports: Pick<
        CandidateReport,
        '_id' | 'title' | 'candidateId' | 'jobId' | 'executiveSummary'
    >[];
}

export const globalSearch = (q: string) =>
    api
        .get<ApiSuccess<GlobalSearchResults>>('/api/search', { params: { q } })
        .then((r) => r.data.data);

export const getCommunicationTemplates = () =>
    api
        .get<ApiSuccess<CommunicationTemplate[]>>('/api/communication-templates')
        .then((r) => r.data.data);
export const createCommunicationTemplate = (
    dto: Omit<CommunicationTemplate, '_id' | 'createdAt' | 'updatedAt'>,
) =>
    api
        .post<ApiSuccess<CommunicationTemplate>>('/api/communication-templates', dto)
        .then((r) => r.data.data);
export const deleteCommunicationTemplate = (id: string) =>
    api.delete(`/api/communication-templates/${id}`);
export const sendCandidateEmail = (
    candidateId: string,
    dto: { templateId?: string; subject?: string; body?: string },
) =>
    api
        .post<ApiSuccess<EmailDelivery>>(`/api/candidates/${candidateId}/emails`, dto)
        .then((r) => r.data.data);
export const getCandidateEmailDeliveries = (candidateId: string) =>
    api
        .get<ApiSuccess<EmailDelivery[]>>(`/api/candidates/${candidateId}/email-deliveries`)
        .then((r) => r.data.data);
export const sendInterviewInvite = (interviewId: string) =>
    api
        .post<
            ApiSuccess<{ delivery: EmailDelivery; calendarEventUrl: string }>
        >(`/api/interviews/${interviewId}/invite`)
        .then((r) => r.data.data);

// ─── Collaboration / Reviews / Audit ─────
export const getComments = (resourceType: CollaborationResourceType, resourceId: string) =>
    api
        .get<ApiSuccess<Comment[]>>(`/api/collaboration/${resourceType}/${resourceId}/comments`)
        .then((r) => r.data.data);

export const createComment = (
    resourceType: CollaborationResourceType,
    resourceId: string,
    body: string,
    visibility: 'team' | 'private' = 'team',
) =>
    api
        .post<ApiSuccess<Comment>>(`/api/collaboration/${resourceType}/${resourceId}/comments`, {
            body,
            visibility,
        })
        .then((r) => r.data.data);

export const getReviews = (resourceType: CollaborationResourceType, resourceId: string) =>
    api
        .get<ApiSuccess<Review[]>>(`/api/collaboration/${resourceType}/${resourceId}/reviews`)
        .then((r) => r.data.data);

export const createReview = (
    resourceType: CollaborationResourceType,
    resourceId: string,
    dto: { note?: string; assignedTo?: string | null; dueAt?: string | null },
) =>
    api
        .post<ApiSuccess<Review>>(`/api/collaboration/${resourceType}/${resourceId}/reviews`, dto)
        .then((r) => r.data.data);

export const updateReview = (
    reviewId: string,
    dto: {
        status?: Review['status'];
        decision?: Review['decision'];
        note?: string;
        assignedTo?: string | null;
        dueAt?: string | null;
    },
) =>
    api
        .patch<ApiSuccess<Review>>(`/api/collaboration/reviews/${reviewId}`, dto)
        .then((r) => r.data.data);

export const getAuditLogs = (params: {
    resourceType?: string;
    resourceId?: string;
    limit?: number;
}) => api.get<ApiSuccess<AuditLog[]>>('/api/audit-logs', { params }).then((r) => r.data.data);

// ─── Public Website Forms ─────
export interface PublicLeadPayload {
    name: string;
    email: string;
    company?: string;
    role?: string;
    message: string;
    sourcePage?: string;
}

export const submitDemoRequest = (payload: PublicLeadPayload) =>
    api.post<ApiSuccess<any>>('/api/public/demo-requests', payload).then((r) => r.data.data);

export const submitContactRequest = (payload: PublicLeadPayload) =>
    api.post<ApiSuccess<any>>('/api/public/contact', payload).then((r) => r.data.data);
