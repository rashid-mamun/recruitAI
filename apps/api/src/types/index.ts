import { Document, Types } from 'mongoose';

export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type JobStatus = 'active' | 'paused' | 'closed';

export type UserRole = 'admin' | 'recruiter';
export type OrganizationPlan = 'free' | 'pro' | 'enterprise';
export type OrganizationStatus = 'active' | 'suspended';
export type MembershipRole = 'owner' | 'admin' | 'recruiter' | 'interviewer' | 'viewer';
export type MembershipStatus = 'active' | 'invited' | 'disabled';

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

export type TaskType = 'sourcing' | 'scoring' | 'outreach' | 'interview_analysis';
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
    defaultOrganizationId?: string | null;
    authProvider?: 'email' | 'google';
    googleId?: string;
    password?: string;
    emailVerified?: boolean;
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
    resetPasswordTokenHash?: string | null;
    resetPasswordExpiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IOrganization {
    _id: string;
    name: string;
    slug: string;
    plan: OrganizationPlan;
    status: OrganizationStatus;
    settings?: Record<string, unknown>;
    billingCustomerId?: string | null;
    subscriptionStatus?: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
    currentPeriodEnd?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IMembership {
    _id: string;
    organizationId: string;
    userId: string;
    role: MembershipRole;
    status: MembershipStatus;
    invitedEmail?: string | null;
    inviteTokenHash?: string | null;
    inviteExpiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISession {
    _id: string;
    userId: string;
    organizationId?: string | null;
    refreshTokenHash: string;
    userAgent?: string | null;
    ip?: string | null;
    revokedAt?: Date | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IJob {
    _id: string;
    organizationId?: string | null;
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
    organizationId?: string | null;
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
    source: SourcingProvider | 'manual';
    starred?: boolean;
    tags?: string[];
    notes?: string;
    resumeFileId?: string | null;
    resumeText?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    sourceDetails?: Record<string, unknown>;
    consentStatus?: 'unknown' | 'granted' | 'withdrawn';
    privacyRegion?: string;
    ownerUserId?: string | null;
    assignedRecruiterIds?: string[];
    lastActivityAt?: Date | null;
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

export type InterviewType = 'screening' | 'technical' | 'behavioral' | 'system_design' | 'final';
export type InterviewStatus =
    | 'draft'
    | 'scheduled'
    | 'completed'
    | 'analyzing'
    | 'analysis_ready'
    | 'reviewed'
    | 'cancelled';

export interface ITranscriptSegment {
    _id: string;
    interviewId: string;
    speaker: string;
    speakerRole: 'candidate' | 'interviewer' | 'unknown';
    startTime?: number | null;
    endTime?: number | null;
    text: string;
    confidence?: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IInterview {
    _id: string;
    organizationId?: string | null;
    jobId: string;
    candidateId: string;
    title: string;
    round: string;
    type: InterviewType;
    status: InterviewStatus;
    scheduledAt?: Date | null;
    durationMinutes?: number | null;
    interviewerNames: string[];
    interviewerIds?: string[];
    transcriptFileId?: string | null;
    audioFileId?: string | null;
    notes: string;
    transcriptText?: string;
    analysisId?: string | null;
    calendarEventUrl?: string | null;
    inviteSentAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface InterviewEvidence {
    label: string;
    quote: string;
    speaker?: string;
    segmentId?: string;
}

export interface IInterviewAnalysis {
    _id: string;
    organizationId: string;
    interviewId: string;
    candidateId: string;
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    executiveSummary: string;
    technicalSignals: string[];
    behavioralSignals: string[];
    communicationSignals: string[];
    riskFlags: string[];
    evidence: InterviewEvidence[];
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
    confidence: number;
    aiModel: string;
    source: 'ai' | 'fallback';
    error?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ScorecardCompetency {
    id: string;
    name: string;
    description: string;
    weight: number;
}

export interface IJobScorecard {
    _id: string;
    organizationId: string;
    jobId: string;
    name: string;
    competencies: ScorecardCompetency[];
    passingScore: number;
    createdAt: Date;
    updatedAt: Date;
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

export interface IEvaluation {
    _id: string;
    organizationId: string;
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
    reviewedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICandidateReport {
    _id: string;
    organizationId: string;
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
    createdAt: Date;
    updatedAt: Date;
}

export type CollaborationResourceType = 'candidate' | 'interview' | 'evaluation' | 'report';

export interface IComment {
    _id: string;
    organizationId: string;
    resourceType: CollaborationResourceType;
    resourceId: string;
    body: string;
    visibility: 'team' | 'private';
    createdBy?: string | null;
    createdByName?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IReview {
    _id: string;
    organizationId: string;
    resourceType: CollaborationResourceType;
    resourceId: string;
    status: 'open' | 'approved' | 'changes_requested' | 'rejected';
    decision?: 'strong_yes' | 'yes' | 'maybe' | 'no' | null;
    note: string;
    assignedTo?: string | null;
    createdBy?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
    dueAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IAuditLog {
    _id: string;
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
    createdAt: Date;
}

export interface IFileAsset {
    _id: string;
    organizationId?: string | null;
    ownerType: 'candidate' | 'interview' | 'report' | 'general';
    ownerId?: string | null;
    kind: 'resume' | 'transcript' | 'audio' | 'report' | 'other';
    filename: string;
    mimeType: string;
    size: number;
    storageKey: string;
    storageProvider?: 'local' | 's3' | 'cloudinary';
    checksum: string;
    scanStatus?: 'pending' | 'clean' | 'infected' | 'skipped';
    scanDetails?: string;
    uploadedBy?: string | null;
    extractedText?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITask {
    _id: string;
    organizationId?: string;
    type: TaskType;
    jobId?: string;
    candidateId?: string;
    interviewId?: string;
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

export interface IOrganizationDocument extends Omit<IOrganization, '_id'>, Document {}

export interface IMembershipDocument
    extends Omit<IMembership, '_id' | 'organizationId' | 'userId'>, Document {
    organizationId: Types.ObjectId;
    userId: Types.ObjectId;
}

export interface ISessionDocument
    extends Omit<ISession, '_id' | 'userId' | 'organizationId'>, Document {
    userId: Types.ObjectId;
    organizationId?: Types.ObjectId | null;
}

export interface IJobDocument extends Omit<IJob, '_id' | 'organizationId'>, Document {
    organizationId?: Types.ObjectId | null;
}

export interface ICandidateDocument
    extends Omit<ICandidate, '_id' | 'organizationId' | 'jobId' | 'outreachMessages'>, Document {
    organizationId?: Types.ObjectId | null;
    jobId: Types.ObjectId;
    outreachMessages: Types.ObjectId[];
}

export interface ITaskDocument
    extends
        Omit<ITask, '_id' | 'organizationId' | 'jobId' | 'candidateId' | 'interviewId'>,
        Document {
    organizationId?: Types.ObjectId;
    jobId?: Types.ObjectId;
    candidateId?: Types.ObjectId;
    interviewId?: Types.ObjectId;
}

export interface IMessageDocument
    extends Omit<IMessage, '_id' | 'candidateId' | 'jobId'>, Document {
    candidateId: Types.ObjectId;
    jobId: Types.ObjectId;
    role: 'ai' | 'candidate' | 'system';
}

export interface IInterviewDocument
    extends
        Omit<IInterview, '_id' | 'organizationId' | 'jobId' | 'candidateId' | 'analysisId'>,
        Document {
    organizationId?: Types.ObjectId | null;
    jobId: Types.ObjectId;
    candidateId: Types.ObjectId;
    analysisId?: Types.ObjectId | null;
}

export interface ITranscriptSegmentDocument
    extends Omit<ITranscriptSegment, '_id' | 'interviewId'>, Document {
    interviewId: Types.ObjectId;
}

export interface IInterviewAnalysisDocument
    extends
        Omit<
            IInterviewAnalysis,
            '_id' | 'organizationId' | 'interviewId' | 'candidateId' | 'jobId'
        >,
        Document {
    organizationId: Types.ObjectId;
    interviewId: Types.ObjectId;
    candidateId: Types.ObjectId;
    jobId: Types.ObjectId;
}

export interface IJobScorecardDocument
    extends Omit<IJobScorecard, '_id' | 'organizationId' | 'jobId'>, Document {
    organizationId: Types.ObjectId;
    jobId: Types.ObjectId;
}

export interface IEvaluationDocument
    extends
        Omit<IEvaluation, '_id' | 'organizationId' | 'jobId' | 'candidateId' | 'scorecardId'>,
        Document {
    organizationId: Types.ObjectId;
    jobId: Types.ObjectId;
    candidateId: Types.ObjectId;
    scorecardId: Types.ObjectId;
}

export interface ICandidateReportDocument
    extends
        Omit<ICandidateReport, '_id' | 'organizationId' | 'jobId' | 'candidateId' | 'evaluationId'>,
        Document {
    organizationId: Types.ObjectId;
    jobId: Types.ObjectId;
    candidateId: Types.ObjectId;
    evaluationId?: Types.ObjectId | null;
}

export interface ICommentDocument
    extends Omit<IComment, '_id' | 'organizationId' | 'resourceId'>, Document {
    organizationId: Types.ObjectId;
    resourceId: Types.ObjectId;
}

export interface IReviewDocument
    extends Omit<IReview, '_id' | 'organizationId' | 'resourceId'>, Document {
    organizationId: Types.ObjectId;
    resourceId: Types.ObjectId;
}

export interface IAuditLogDocument extends Omit<IAuditLog, '_id' | 'organizationId'>, Document {
    organizationId: Types.ObjectId;
}

export interface IFileAssetDocument
    extends Omit<IFileAsset, '_id' | 'organizationId' | 'ownerId'>, Document {
    organizationId?: Types.ObjectId | null;
    ownerId?: Types.ObjectId | null;
}
