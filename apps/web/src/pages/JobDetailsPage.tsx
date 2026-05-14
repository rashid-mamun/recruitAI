import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
    Briefcase,
    MapPin,
    Users,
    Search,
    Play,
    ArrowLeft,
    Check,
    X,
    Pencil,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { api, getJob, getJobCandidates, getJobStats, updateJob } from '@/services/api';
import KanbanBoard from '@/components/KanbanBoard';
import PipelineStats from '@/components/PipelineStats';
import CandidateHoverCard from '@/components/CandidateHoverCard';
import { useTaskStream } from '@/hooks/useTaskStream';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import type { Candidate, Job } from '@/types';

type TabKey = 'overview' | 'candidates';

export default function JobDetailsPage() {
    const { jobId } = useParams();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<TabKey>('overview');
    const [sourcingQuery, setSourcingQuery] = useState('');
    const [sourcingLimit, setSourcingLimit] = useState(10);
    const [sourcingError, setSourcingError] = useState('');
    const [sourceTaskId, setSourceTaskId] = useState<string | null>(null);
    const [sourceProgress, setSourceProgress] = useState(0);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [titleError, setTitleError] = useState('');
    const [editingDetails, setEditingDetails] = useState(false);
    const [descriptionInput, setDescriptionInput] = useState('');
    const [requirementsInput, setRequirementsInput] = useState<string[]>([]);
    const [newRequirement, setNewRequirement] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
        const key = `view-pref-${jobId}`;
        const saved = localStorage.getItem(key);
        return saved === 'kanban' ? 'kanban' : 'list';
    });
    const [statusFilter, setStatusFilter] = useState('');
    const [sortBy, setSortBy] = useState('-updatedAt');
    const [page, setPage] = useState(1);

    const { showLoading, updateProgress, showSuccess, showError } = useToast();
    const { addNotification } = useNotifications();
    const sourceStream = useTaskStream(sourceTaskId);

    const { data: job, isLoading } = useQuery({
        queryKey: ['job', jobId],
        queryFn: async () => {
            if (!jobId) throw new Error('Job ID is required');
            return await getJob(jobId);
        },
        enabled: !!jobId,
    });

    const { data: stats, refetch: refetchStats } = useQuery({
        queryKey: ['job-stats', jobId],
        queryFn: () => {
            if (!jobId) throw new Error('Job ID is required');
            return getJobStats(jobId);
        },
        enabled: !!jobId,
        staleTime: 30_000,
    });

    useEffect(() => {
        const handler = () => refetchStats();
        window.addEventListener('recruit:stats-changed', handler);
        return () => window.removeEventListener('recruit:stats-changed', handler);
    }, [refetchStats]);

    const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
        queryKey: ['job-candidates', jobId, statusFilter, sortBy, page],
        queryFn: () => {
            if (!jobId) return { data: [], pagination: { total: 0, page: 1, totalPages: 1 } };
            return getJobCandidates(jobId, {
                limit: 25,
                sort: sortBy,
                status: statusFilter || undefined,
                page,
            });
        },
        enabled: !!jobId && tab === 'candidates',
    });

    const candidates: Candidate[] = candidatesData?.data ?? [];

    useEffect(() => {
        if (!job) return;
        setTitleInput(job.title);
        setDescriptionInput(job.description);
        setRequirementsInput(job.requirements ?? []);
    }, [job]);

    useEffect(() => {
        if (!jobId) return;
        localStorage.setItem(`view-pref-${jobId}`, viewMode);
    }, [viewMode, jobId]);

    const updateMutation = useMutation({
        mutationFn: (dto: Partial<Job>) => updateJob(jobId as string, dto),
        onSuccess: () => {
            setEditingTitle(false);
            setEditingDetails(false);
        },
    });

    const startSourcing = useMutation({
        mutationFn: async () => {
            if (sourcingLimit < 1 || sourcingLimit > 50) {
                setSourcingError('Limit must be between 1 and 50');
                throw new Error('Invalid limit');
            }
            setSourcingError('');
            const res = await api.post(`/api/jobs/${jobId}/sourcing-tasks`, {
                query: sourcingQuery.trim() || job?.title,
                limit: sourcingLimit,
            });
            return res.data.data as { taskId: string; status: string };
        },
        onSuccess: (data) => {
            if (data?.taskId && job) {
                const id = `source-${jobId}`;
                showLoading(id, `Finding candidates for ${job.title}...`);
                setSourceTaskId(String(data.taskId));
            }
            setSourcingQuery('');
        },
    });

    useEffect(() => {
        if (!sourceTaskId || !sourceStream.status || !job) return;
        const id = `source-${jobId}`;
        setSourceProgress(sourceStream.progress);
        if (sourceStream.status === 'processing' || sourceStream.status === 'queued') {
            updateProgress(id, sourceStream.progress);
        }
        if (sourceStream.status === 'completed') {
            showSuccess(id, 'Sourcing complete. New candidates added.');
            addNotification('sourced', `Sourcing complete for ${job.title}`, `/jobs/${jobId}`);
            queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] });
            setSourceTaskId(null);
            setSourceProgress(0);
        }
        if (sourceStream.status === 'failed') {
            showError(id, sourceStream.error ?? 'Sourcing failed.');
            setSourceTaskId(null);
            setSourceProgress(0);
        }
    }, [sourceStream.status, sourceStream.progress]);

    if (isLoading)
        return (
            <div className="animate-fade-in pb-12">
                <div
                    className="mb-6 skeleton-block skeleton-line"
                    style={{ width: 160, height: 16 }}
                />
                <div className="page-header items-start">
                    <div className="flex-1">
                        <div
                            className="skeleton-block skeleton-line mb-4"
                            style={{ width: '55%', height: 42 }}
                        />
                        <div className="flex items-center gap-3">
                            <div
                                className="skeleton-block skeleton-line"
                                style={{ width: 110, height: 24, borderRadius: 999 }}
                            />
                            <div
                                className="skeleton-block skeleton-line"
                                style={{ width: 86, height: 24, borderRadius: 999 }}
                            />
                        </div>
                    </div>
                    <div
                        className="skeleton-block skeleton-line"
                        style={{ width: 180, height: 44, borderRadius: 999 }}
                    />
                </div>
            </div>
        );

    if (!job) return <div className="p-12 text-center text-muted">Job not found</div>;

    const handleSaveTitle = () => {
        if (!titleInput.trim() || titleInput.trim().length < 3) {
            setTitleError('Title must be at least 3 characters');
            return;
        }
        setTitleError('');
        updateMutation.mutate({ title: titleInput.trim() });
    };

    const handleSaveDetails = () => {
        updateMutation.mutate({ description: descriptionInput, requirements: requirementsInput });
    };

    return (
        <div className="animate-fade-in pb-12">
            <div className="mb-6">
                <Link
                    to="/jobs"
                    className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-sm font-medium"
                >
                    <ArrowLeft size={16} /> Back to jobs
                </Link>
            </div>

            <div className="page-header items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        {editingTitle ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <input
                                        className="input"
                                        value={titleInput}
                                        onChange={(e) => {
                                            setTitleInput(e.target.value);
                                            if (titleError) setTitleError('');
                                        }}
                                        aria-label="Edit job title"
                                    />
                                    {titleError && (
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                color: '#ef4444',
                                                marginTop: 4,
                                            }}
                                        >
                                            {titleError}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={handleSaveTitle}
                                    aria-label="Save title"
                                >
                                    <Check size={14} />
                                </button>
                                <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => {
                                        setEditingTitle(false);
                                        setTitleInput(job.title);
                                        setTitleError('');
                                    }}
                                    aria-label="Cancel title edit"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <h1 className="page-title m-0">{job.title}</h1>
                                <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => setEditingTitle(true)}
                                    aria-label="Edit title"
                                >
                                    <Pencil size={14} />
                                </button>
                            </div>
                        )}
                        <div className={`badge badge--${job.status}`}>{job.status}</div>
                    </div>
                    <div className="flex items-center gap-4 text-muted text-sm mt-2">
                        <span className="flex items-center gap-1">
                            <MapPin size={14} /> {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                            <Briefcase size={14} /> {job.type}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className={`btn ${tab === 'overview' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                        onClick={() => setTab('overview')}
                        aria-label="Overview tab"
                    >
                        Overview
                    </button>
                    <button
                        className={`btn ${tab === 'candidates' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                        onClick={() => setTab('candidates')}
                        aria-label="Candidates tab"
                    >
                        Candidates
                    </button>
                </div>
            </div>

            {tab === 'overview' && (
                <div className="flex flex-col-mobile gap-6 mt-4">
                    <div className="flex-1 flex flex-col gap-6">
                        {stats && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '8px 12px',
                                    background: 'var(--color-surface-2)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <button
                                    className={`pipeline-stat-item ${statusFilter === '' ? 'active-filter' : ''}`}
                                    onClick={() => {
                                        setTab('candidates');
                                        setStatusFilter('');
                                    }}
                                >
                                    <strong>{stats.sourced}</strong>{' '}
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        sourced
                                    </span>
                                </button>
                                <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>
                                    ·
                                </span>
                                <button
                                    className={`pipeline-stat-item ${statusFilter === 'scored' ? 'active-filter' : ''}`}
                                    onClick={() => {
                                        setTab('candidates');
                                        setStatusFilter('scored');
                                    }}
                                >
                                    <strong>{stats.scored}</strong>{' '}
                                    <span style={{ color: 'var(--color-text-muted)' }}>scored</span>
                                    <span
                                        style={{
                                            marginLeft: '4px',
                                            fontSize: '11px',
                                            color: 'var(--color-success)',
                                        }}
                                    >
                                        (
                                        {stats.sourced > 0
                                            ? Math.round((stats.scored / stats.sourced) * 100)
                                            : 0}
                                        %)
                                    </span>
                                </button>
                                <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>
                                    ·
                                </span>
                                <button
                                    className={`pipeline-stat-item ${statusFilter === 'contacted' ? 'active-filter' : ''}`}
                                    onClick={() => {
                                        setTab('candidates');
                                        setStatusFilter('contacted');
                                    }}
                                >
                                    <strong>{stats.contacted}</strong>{' '}
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        contacted
                                    </span>
                                </button>
                                <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>
                                    ·
                                </span>
                                <button
                                    className={`pipeline-stat-item ${statusFilter === 'interested' ? 'active-filter' : ''}`}
                                    onClick={() => {
                                        setTab('candidates');
                                        setStatusFilter('interested');
                                    }}
                                >
                                    <strong>{stats.interested}</strong>{' '}
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        interested
                                    </span>
                                </button>
                                <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>
                                    ·
                                </span>
                                <button
                                    className={`pipeline-stat-item ${statusFilter === 'hired' ? 'active-filter' : ''}`}
                                    onClick={() => {
                                        setTab('candidates');
                                        setStatusFilter('hired');
                                    }}
                                >
                                    <strong>{stats.hired}</strong>{' '}
                                    <span style={{ color: 'var(--color-text-muted)' }}>hired</span>
                                </button>
                            </div>
                        )}
                        <div className="card section-panel">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 12,
                                }}
                            >
                                <h3 className="font-bold text-lg">Description</h3>
                                {!editingDetails && (
                                    <button
                                        className="btn btn--secondary btn--sm"
                                        onClick={() => setEditingDetails(true)}
                                        aria-label="Edit job details"
                                    >
                                        <Pencil size={14} /> Edit
                                    </button>
                                )}
                            </div>
                            {editingDetails ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <textarea
                                        className="input"
                                        value={descriptionInput}
                                        onChange={(e) => setDescriptionInput(e.target.value)}
                                        rows={5}
                                        aria-label="Job description"
                                    />
                                    <div>
                                        <h3 className="font-bold text-lg mb-2">Requirements</h3>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 8,
                                                marginBottom: 10,
                                            }}
                                        >
                                            {requirementsInput.map((req) => (
                                                <span
                                                    key={req}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: 999,
                                                        background: 'rgba(124,58,237,0.15)',
                                                        color: '#a78bfa',
                                                        fontSize: 12,
                                                        border: '1px solid rgba(124,58,237,0.25)',
                                                    }}
                                                >
                                                    {req}
                                                    <button
                                                        onClick={() =>
                                                            setRequirementsInput((prev) =>
                                                                prev.filter((r) => r !== req),
                                                            )
                                                        }
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'inherit',
                                                            marginLeft: 6,
                                                            cursor: 'pointer',
                                                        }}
                                                        aria-label={`Remove ${req}`}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                className="input"
                                                value={newRequirement}
                                                onChange={(e) => setNewRequirement(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const trimmed = newRequirement.trim();
                                                        if (
                                                            trimmed &&
                                                            !requirementsInput.includes(trimmed)
                                                        ) {
                                                            setRequirementsInput((prev) => [
                                                                ...prev,
                                                                trimmed,
                                                            ]);
                                                        }
                                                        setNewRequirement('');
                                                    }
                                                }}
                                                placeholder="Add requirement"
                                                aria-label="Add requirement"
                                            />
                                            <button
                                                className="btn btn--secondary"
                                                onClick={() => {
                                                    const trimmed = newRequirement.trim();
                                                    if (
                                                        trimmed &&
                                                        !requirementsInput.includes(trimmed)
                                                    ) {
                                                        setRequirementsInput((prev) => [
                                                            ...prev,
                                                            trimmed,
                                                        ]);
                                                    }
                                                    setNewRequirement('');
                                                }}
                                                aria-label="Add requirement"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className="btn btn--primary"
                                            onClick={handleSaveDetails}
                                            aria-label="Save details"
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            className="btn btn--secondary"
                                            onClick={() => {
                                                setEditingDetails(false);
                                                setDescriptionInput(job.description);
                                                setRequirementsInput(job.requirements ?? []);
                                            }}
                                            aria-label="Cancel edit"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-muted whitespace-pre-wrap">
                                        {job.description}
                                    </div>
                                    <h3 className="font-bold text-lg mt-8 mb-4">Requirements</h3>
                                    <ul
                                        className="flex flex-col gap-2 pl-4 text-muted"
                                        style={{ listStyle: 'disc' }}
                                    >
                                        {job.requirements.map((req: string, i: number) => (
                                            <li key={i}>{req}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>

                        <div className="card section-panel">
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
                                Pipeline Conversion Grid
                            </div>
                            <PipelineStats stats={stats} />
                        </div>
                    </div>

                    <aside
                        className="w-full flex flex-col gap-6 flex-shrink-0 animate-slide-up"
                        style={{ minWidth: 320, maxWidth: 400 }}
                    >
                        <div className="card section-panel">
                            <div className="flex items-center gap-3 mb-4 text-primary">
                                <Search size={20} />
                                <h3 className="font-bold text-lg m-0">Auto-Sourcing</h3>
                            </div>
                            <p className="text-sm text-muted mb-6">
                                Launch a background worker to scrub LinkedIn via Google Serper,
                                deduplicate, and auto-score candidates against this job description.
                            </p>

                            <div className="form-group mb-4">
                                <label className="label">Search Query (Optional)</label>
                                <input
                                    className="input"
                                    placeholder={`e.g. ${job.title} remote`}
                                    value={sourcingQuery}
                                    onChange={(e) => setSourcingQuery(e.target.value)}
                                />
                                <div className="text-faint" style={{ fontSize: '0.7rem' }}>
                                    Defaults to job title if empty
                                </div>
                            </div>

                            <div className="form-group mb-6">
                                <label className="label">Limit Candidates (max 50)</label>
                                <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={sourcingLimit}
                                    onChange={(e) => {
                                        setSourcingLimit(parseInt(e.target.value) || 10);
                                        if (sourcingError) setSourcingError('');
                                    }}
                                />
                                {sourcingError && (
                                    <div
                                        style={{
                                            fontSize: '0.75rem',
                                            color: '#ef4444',
                                            marginTop: 4,
                                        }}
                                    >
                                        {sourcingError}
                                    </div>
                                )}
                            </div>

                            <button
                                className="btn btn--primary w-full justify-center"
                                onClick={() => startSourcing.mutate()}
                                disabled={startSourcing.isPending}
                            >
                                {startSourcing.isPending ? (
                                    <div className="spinner" />
                                ) : (
                                    <Play size={16} />
                                )}
                                {startSourcing.isPending
                                    ? 'Queuing job...'
                                    : 'Start Background Sourcing'}
                            </button>
                            {sourceTaskId && (
                                <div style={{ marginTop: 10 }}>
                                    <div
                                        style={{
                                            height: 4,
                                            background: 'rgba(255,255,255,0.08)',
                                            borderRadius: 999,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${sourceProgress}%`,
                                                background: '#7C3AED',
                                                transition: 'width 0.25s',
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: 'var(--color-text-muted)',
                                            marginTop: 6,
                                        }}
                                    >
                                        Sourcing... {sourceProgress}%
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            {tab === 'candidates' && (
                <div className="card" style={{ padding: 20 }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Users size={18} />
                            <span style={{ fontWeight: 700 }}>Candidates</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className={`btn ${viewMode === 'list' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                                onClick={() => setViewMode('list')}
                                aria-label="List view"
                            >
                                List
                            </button>
                            <button
                                className={`btn ${viewMode === 'kanban' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                                onClick={() => setViewMode('kanban')}
                                aria-label="Kanban view"
                            >
                                Kanban
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        {viewMode === 'list' && (
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setPage(1);
                                }}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--bg-input)',
                                    color: 'var(--color-text)',
                                    fontSize: 14,
                                }}
                                aria-label="Filter by status"
                            >
                                <option value="">All Statuses</option>
                                <option value="new">New</option>
                                <option value="interested">Interested</option>
                                <option value="hired">Hired</option>
                                <option value="not_interested">Not Interested</option>
                            </select>
                        )}

                        <select
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value);
                                setPage(1);
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--bg-input)',
                                color: 'var(--color-text)',
                                fontSize: 14,
                            }}
                            aria-label="Sort candidates"
                        >
                            <option value="-updatedAt">Recently Updated</option>
                            <option value="name">Name (A-Z)</option>
                            <option value="-score">Score (High to Low)</option>
                            <option value="score">Score (Low to High)</option>
                        </select>
                    </div>

                    {candidatesLoading ? (
                        <div className="list-stack">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="skeleton-block skeleton-line"
                                    style={{ width: '100%', height: 40 }}
                                />
                            ))}
                        </div>
                    ) : viewMode === 'kanban' ? (
                        <KanbanBoard candidates={candidates} />
                    ) : (
                        <div className="table-wrapper m-0 border-0 desktop-only">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th>Candidate</th>
                                        <th>Status</th>
                                        <th>Score</th>
                                        <th>Source</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map((candidate) => (
                                        <tr key={candidate._id} className="candidate-row">
                                            <td>
                                                <div className="flex flex-col min-w-0">
                                                    <CandidateHoverCard candidate={candidate}>
                                                        <span
                                                            className="candidate-card__name truncate"
                                                            style={{ display: 'inline-block' }}
                                                        >
                                                            {candidate.name}
                                                        </span>
                                                    </CandidateHoverCard>
                                                    <span
                                                        className="candidate-card__headline truncate"
                                                        style={{ maxWidth: 420 }}
                                                    >
                                                        {candidate.headline}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={`badge badge--${candidate.status}`}>
                                                    {candidate.status}
                                                </div>
                                            </td>
                                            <td>
                                                {candidate.score !== null &&
                                                candidate.score !== undefined ? (
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`score-value text-xl`}
                                                            style={{
                                                                color:
                                                                    candidate.score.value >= 70
                                                                        ? 'var(--color-success)'
                                                                        : candidate.score.value >=
                                                                            50
                                                                          ? 'var(--color-warning)'
                                                                          : 'var(--color-danger)',
                                                            }}
                                                        >
                                                            {candidate.score.value}
                                                        </div>
                                                        <div
                                                            className="progress-bar opacity-80"
                                                            style={{ width: 60 }}
                                                        >
                                                            <div
                                                                className="progress-bar__fill"
                                                                style={{
                                                                    width: `${candidate.score.value}%`,
                                                                    background:
                                                                        candidate.score.value >= 70
                                                                            ? 'var(--color-success)'
                                                                            : candidate.score
                                                                                    .value >= 50
                                                                              ? 'var(--color-warning)'
                                                                              : 'var(--color-danger)',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted italic">
                                                        Pending...
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="chip-pill">
                                                    {candidate.source}
                                                </span>
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/candidates/${candidate._id}`}
                                                    className="btn btn--secondary btn--sm"
                                                >
                                                    Details
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {viewMode === 'list' && !candidatesLoading && candidates.length > 0 && (
                        <div
                            className="mobile-only"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                                marginTop: 12,
                            }}
                        >
                            {candidates.map((candidate) => (
                                <div key={candidate._id} className="card" style={{ padding: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                background: 'var(--color-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: '#fff',
                                            }}
                                        >
                                            {candidate.name
                                                .split(' ')
                                                .map((p) => p[0])
                                                .join('')
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <CandidateHoverCard candidate={candidate}>
                                                <div
                                                    className="candidate-card__name truncate"
                                                    style={{ display: 'inline-block' }}
                                                >
                                                    {candidate.name}
                                                </div>
                                            </CandidateHoverCard>
                                            <div className="candidate-card__headline truncate">
                                                {candidate.headline}
                                            </div>
                                        </div>
                                        <Link
                                            to={`/candidates/${candidate._id}`}
                                            className="btn btn--secondary btn--sm"
                                        >
                                            Details
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!candidatesLoading && candidates.length === 0 && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '32px 20px',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            <p>No candidates found matching the selected filters.</p>
                        </div>
                    )}

                    {candidatesData?.pagination && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: 16,
                                paddingTop: 16,
                                borderTop: '1px solid var(--color-border)',
                            }}
                        >
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                Page {page} of {candidatesData.pagination.totalPages}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(candidatesData.pagination.totalPages, p + 1),
                                        )
                                    }
                                    disabled={page === candidatesData.pagination.totalPages}
                                    aria-label="Next page"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
