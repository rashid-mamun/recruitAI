export interface User {
    id: string;
    name: string;
    email: string;
    role?: string;
    workspaceRole?: 'owner' | 'admin' | 'recruiter' | 'interviewer' | 'viewer';
    defaultOrganizationId?: string | null;
    organization?: {
        _id: string;
        name: string;
        slug: string;
        plan: 'free' | 'pro' | 'enterprise';
        status: 'active' | 'suspended';
    } | null;
}

export interface Organization {
    _id: string;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'suspended';
    subscriptionStatus?: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
    currentPeriodEnd?: string | null;
}

export interface Membership {
    _id: string;
    organizationId: string;
    userId?: string;
    role: 'owner' | 'admin' | 'recruiter' | 'interviewer' | 'viewer';
    status: 'active' | 'invited' | 'disabled';
    invitedEmail?: string | null;
    inviteToken?: string;
    user?: { id: string; name: string; email: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    loginWithGoogle: (credential: string) => Promise<void>;
    logout: () => void;
    switchWorkspace: (organizationId: string) => Promise<void>;
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

export type TaskType = 'sourcing' | 'scoring' | 'outreach' | 'interview_analysis';
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
    stats?: {
        new?: number;
        scored?: number;
        contacted?: number;
        interested?: number;
        hired?: number;
        topScore?: number | null;
        avgScore?: number | null;
    };
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
    phone?: string;
    currentCompany?: string;
    currentTitle?: string;
    linkedinUrl: string;
    headline: string;
    summary: string;
    skills: string[];
    experience: string;
    location: string;
    source: string;
    status: CandidateStatus;
    score?: CandidateScore;
    scoredAt?: string;
    contactedAt?: string;
    respondedAt?: string;
    hiredAt?: string;
    outreachMessages: string[];
    tags?: string[];
    notes?: string;
    starred?: boolean;
    resumeFileId?: string | null;
    resumeText?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    sourceDetails?: Record<string, unknown>;
    consentStatus?: 'unknown' | 'granted' | 'withdrawn';
    privacyRegion?: string;
    ownerUserId?: string | null;
    assignedRecruiterIds?: string[];
    lastActivityAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface FileAsset {
    _id: string;
    ownerType: 'candidate' | 'interview' | 'report' | 'general';
    ownerId?: string | null;
    kind: 'resume' | 'transcript' | 'audio' | 'report' | 'other';
    filename: string;
    mimeType: string;
    size: number;
    checksum: string;
    storageProvider?: 'local' | 's3' | 'cloudinary';
    scanStatus?: 'pending' | 'clean' | 'infected' | 'skipped';
    scanDetails?: string;
    extractedText?: string;
    uploadedBy?: string | null;
    createdAt: string;
    updatedAt: string;
}

export type InterviewType = 'screening' | 'technical' | 'behavioral' | 'system_design' | 'final';
export type InterviewStatus =
    | 'draft'
    | 'scheduled'
    | 'completed'
    | 'analyzing'
    | 'analysis_ready'
    | 'reviewed'
    | 'cancelled';

export interface TranscriptSegment {
    _id: string;
    interviewId: string;
    speaker: string;
    speakerRole: 'candidate' | 'interviewer' | 'unknown';
    text: string;
    createdAt: string;
    updatedAt: string;
}

export interface Interview {
    _id: string;
    jobId: string;
    candidateId: string;
    title: string;
    round: string;
    type: InterviewType;
    status: InterviewStatus;
    scheduledAt?: string | null;
    durationMinutes?: number | null;
    interviewerNames: string[];
    interviewerIds?: string[];
    transcriptFileId?: string | null;
    audioFileId?: string | null;
    notes: string;
    transcriptText?: string;
    analysisId?: string | null;
    calendarEventUrl?: string | null;
    inviteSentAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface InterviewAnalysis {
    _id: string;
    interviewId: string;
    candidateId: string;
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    executiveSummary: string;
    technicalSignals: string[];
    behavioralSignals: string[];
    communicationSignals: string[];
    riskFlags: string[];
    evidence: Array<{ label: string; quote: string; speaker?: string }>;
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
    confidence: number;
    aiModel: string;
    source: 'ai' | 'fallback';
    error?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ScorecardCompetency {
    id: string;
    name: string;
    description: string;
    weight: number;
}

export interface JobScorecard {
    _id: string;
    jobId: string;
    name: string;
    competencies: ScorecardCompetency[];
    passingScore: number;
    createdAt: string;
    updatedAt: string;
}

export interface ScorecardTemplate {
    _id: string;
    name: string;
    roleFamily: string;
    competencies: ScorecardCompetency[];
    passingScore: number;
    createdAt: string;
    updatedAt: string;
}

export interface EvaluationCompetencyScore {
    competencyId: string;
    name: string;
    score: number;
    weight: number;
    rationale: string;
    evidence: string[];
    humanOverrideScore?: number | null;
    humanOverrideReason?: string | null;
}

export interface Evaluation {
    _id: string;
    jobId: string;
    candidateId: string;
    scorecardId: string;
    overallScore: number;
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
    competencyScores: EvaluationCompetencyScore[];
    summary: string;
    source: 'ai' | 'fallback';
    reviewStatus?: 'pending' | 'reviewed';
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CandidateComparison {
    scorecard: JobScorecard;
    candidates: Array<{
        candidate: Candidate;
        evaluation: Evaluation;
    }>;
}

export interface CandidateReport {
    _id: string;
    jobId: string;
    candidateId: string;
    evaluationId?: string | null;
    title: string;
    status: 'generated' | 'archived';
    executiveSummary: string;
    scorecardSnapshot: EvaluationCompetencyScore[];
    interviewHighlights: string[];
    strengths: string[];
    risks: string[];
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
    overallScore: number;
    reportMarkdown: string;
    generatedBy?: string | null;
    humanReviewStatus?: 'pending' | 'reviewed';
    reviewedBy?: string | null;
    createdAt: string;
    updatedAt: string;
}

export type CollaborationResourceType = 'candidate' | 'interview' | 'evaluation' | 'report';

export interface Comment {
    _id: string;
    resourceType: CollaborationResourceType;
    resourceId: string;
    body: string;
    visibility: 'team' | 'private';
    createdBy?: string | null;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Review {
    _id: string;
    resourceType: CollaborationResourceType;
    resourceId: string;
    status: 'open' | 'approved' | 'changes_requested' | 'rejected';
    decision?: 'strong_yes' | 'yes' | 'maybe' | 'no' | null;
    note: string;
    assignedTo?: string | null;
    createdBy?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    dueAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLog {
    _id: string;
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    createdAt: string;
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

export interface HiringAnalytics {
    totals: { jobs: number; candidates: number; interviews: number };
    responseRate: number;
    interviewCompletionRate: number;
    averageScore: number;
    timeToShortlistHours: number | null;
    scoreDistribution: { range: string; count: number }[];
    funnel: Record<string, number>;
    sourceQuality: {
        source: string;
        candidates: number;
        hired: number;
        averageScore: number;
        hireRate: number;
    }[];
    decisionCounts: Record<string, number>;
}

export interface HiringDecision {
    _id: string;
    jobId: string;
    candidateId: string;
    decision: 'shortlist' | 'hold' | 'reject' | 'offer' | 'hired';
    reason: string;
    decidedBy: string;
    approvedBy?: string | null;
    createdAt: string;
}

export interface CommunicationTemplate {
    _id: string;
    name: string;
    kind: 'outreach' | 'rejection' | 'interview_invite';
    subject: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

export interface EmailDelivery {
    _id: string;
    candidateId: string;
    jobId: string;
    interviewId?: string | null;
    to: string;
    subject: string;
    body: string;
    status: 'preview' | 'sent' | 'delivered' | 'failed' | 'replied';
    provider: 'smtp' | 'preview';
    sentAt?: string | null;
    deliveredAt?: string | null;
    repliedAt?: string | null;
    createdAt: string;
}
