import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Briefcase,
    Plus,
    Users,
    MoreHorizontal,
    PauseCircle,
    Copy,
    Archive,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { duplicateJob, getCandidates, getJobs, updateJob, getGlobalStats } from '@/services/api';
import JobSlideOver from '@/components/JobSlideOver';
import { useToast } from '@/contexts/ToastContext';
import type { Candidate, Job } from '@/types';
import { timeAgo } from '@/utils/timeAgo';

function metricTone(value: number) {
    if (value >= 70) return '#10b981';
    if (value >= 50) return '#f59e0b';
    return '#ef4444';
}

function metricArrow(value: number) {
    return value >= 50 ? '↑' : '↓';
}

function getAvatarStyle(text: string) {
    const palettes = [
        { bg: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }, // purple
        { bg: 'rgba(13,148,136,0.25)', color: '#5eead4' }, // teal
        { bg: 'rgba(59,130,246,0.25)', color: '#93c5fd' }, // blue
        { bg: 'rgba(245,158,11,0.25)', color: '#fcd34d' }, // amber
        { bg: 'rgba(239,68,68,0.25)', color: '#fca5a5' }, // red
        { bg: 'rgba(34,197,94,0.25)', color: '#86efac' }, // green
    ];
    const idx = text.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palettes.length;
    return palettes[idx];
}

function normalizeStatus(status: string) {
    if (status === 'sourced') return 'new';
    if (status === 'responded') return 'interested';
    if (status === 'scheduling') return 'hired';
    if (status === 'rejected') return 'not_interested';
    return status;
}

export default function JobsListPage() {
    const [panelOpen, setPanelOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [editJob, setEditJob] = useState<Job | null>(null);
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    useEffect(() => {
        const handler = () => setPanelOpen(true);
        window.addEventListener('recruitai:open-job-panel', handler);
        return () => window.removeEventListener('recruitai:open-job-panel', handler);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-role-menu]')) return;
            setMenuOpen(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const { data, isLoading } = useQuery<Job[]>({
        queryKey: ['jobs'],
        queryFn: () => getJobs(),
    });

    const jobs = data ?? [];

    const { data: globalStatsResponse, refetch: refetchGlobalStats } = useQuery({
        queryKey: ['global-stats'],
        queryFn: () => getGlobalStats(),
        refetchInterval: 30_000,
    });

    useEffect(() => {
        const handler = () => refetchGlobalStats();
        window.addEventListener('recruit:stats-changed', handler);
        return () => window.removeEventListener('recruit:stats-changed', handler);
    }, [refetchGlobalStats]);

    const globalStats = globalStatsResponse || {
        activeJobs: 0,
        totalCandidates: 0,
        contacted: 0,
        responded: 0,
        interested: 0,
        notInterested: 0,
        hired: 0,
        avgScore: null,
        responseRate: null,
    };

    const duplicateMutation = useMutation({
        mutationFn: (id: string) => duplicateJob(id),
        onSuccess: (job) => {
            queryClient.setQueryData<Job[]>(['jobs'], (current = []) => [
                job,
                ...current.filter((item) => item._id !== job._id),
            ]);
            showSuccess(`duplicate-${job._id}`, `Duplicated role: ${job.title}`);
        },
        onError: (error: Error) => showError('duplicate-job-failed', error.message),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: Job['status'] }) =>
            updateJob(id, { status }),
        onSuccess: (job) => {
            queryClient.setQueryData<Job[]>(['jobs'], (current = []) => {
                if (job.status === 'closed') {
                    return current.filter((item) => item._id !== job._id);
                }
                return current.map((item) => (item._id === job._id ? job : item));
            });
            if (job.status === 'closed') {
                showSuccess(`archive-${job._id}`, `Archived role: ${job.title}`);
            } else {
                showSuccess(`status-${job._id}`, `Updated role status to ${job.status}`);
            }
        },
        onError: (error: Error) => showError('job-status-failed', error.message),
    });

    const { data: recentCandidatesData } = useQuery({
        queryKey: ['candidates-recent'],
        queryFn: () => getCandidates({ sort: 'recent', limit: 10 }),
        staleTime: 15_000,
        refetchInterval: 30_000,
    });

    const recentCandidates: Candidate[] = recentCandidatesData?.data ?? [];

    const activityEvents = useMemo(() => {
        const jobMap = new Map(jobs.map((j) => [j._id, j.title]));
        return recentCandidates.slice(0, 8).map((candidate) => {
            const jobTitle = jobMap.get(candidate.jobId) || 'Unknown role';
            const normalized = normalizeStatus(candidate.status);
            const score = candidate.score?.value;
            const tone = score == null ? 'var(--color-text-muted)' : metricTone(score);
            const dotColor =
                normalized === 'scored'
                    ? '#7C3AED'
                    : normalized === 'sourced'
                      ? '#0d9488'
                      : normalized === 'contacted'
                        ? '#3b82f6'
                        : '#10b981';

            return {
                id: candidate._id,
                name: candidate.name,
                jobTitle,
                kind: normalized,
                score,
                tone,
                dotColor,
                time: timeAgo(candidate.updatedAt || candidate.createdAt),
            };
        });
    }, [recentCandidates, jobs]);

    return (
        <div className="animate-fade-in pb-12 jobs-page">
            <div className="hero-panel">
                <div style={{ minWidth: 0 }}>
                    <div className="hero-panel__eyebrow">Role operations</div>
                    <h1 className="hero-panel__title page-title">Jobs</h1>
                    <p className="hero-panel__desc page-subtitle">
                        Manage active roles, keep sourcing live, and review hiring funnel health
                        from one polished dashboard.
                    </p>
                </div>
                <div className="hero-panel__actions">
                    <div className="metric-pill">
                        <span>Live roles</span> <strong>{jobs.length}</strong>
                    </div>
                    <button
                        className="btn btn--primary btn--lg"
                        onClick={() => {
                            setEditJob(null);
                            setPanelOpen(true);
                        }}
                        aria-label="Create new role"
                    >
                        <Plus size={18} />
                        Create New Role
                    </button>
                </div>
            </div>

            <div className="grid-cards jobs-stats-grid mb-8">
                <StatCard
                    label="Active Openings"
                    value={globalStats.activeJobs ?? 0}
                    icon={<Briefcase size={20} />}
                    accent="#6366f1"
                    note={`${jobs.length} total roles`}
                />
                <StatCard
                    label="Total Candidates"
                    value={globalStats.totalCandidates ?? 0}
                    icon={<Users size={20} />}
                    accent="#0d9488"
                    note="across all pipelines"
                />
                <StatCard
                    label="Avg Match Score"
                    value={globalStats.avgScore !== null ? `${globalStats.avgScore}%` : '—'}
                    icon={
                        globalStats.avgScore !== null ? (
                            globalStats.avgScore >= 70 ? (
                                <ArrowUpRight size={20} />
                            ) : (
                                <ArrowDownRight size={20} />
                            )
                        ) : (
                            <ArrowUpRight size={20} />
                        )
                    }
                    accent={
                        globalStats.avgScore !== null
                            ? metricTone(globalStats.avgScore)
                            : 'var(--color-text-muted)'
                    }
                    note={
                        globalStats.avgScore !== null
                            ? `vs last week ${metricArrow(globalStats.avgScore)}`
                            : 'No scores yet'
                    }
                />
                <StatCard
                    label="Response Rate"
                    value={globalStats.responseRate !== null ? `${globalStats.responseRate}%` : '—'}
                    icon={
                        globalStats.responseRate !== null ? (
                            globalStats.responseRate >= 40 ? (
                                <ArrowUpRight size={20} />
                            ) : (
                                <ArrowDownRight size={20} />
                            )
                        ) : (
                            <ArrowUpRight size={20} />
                        )
                    }
                    accent={
                        globalStats.responseRate !== null
                            ? metricTone(globalStats.responseRate)
                            : 'var(--color-text-muted)'
                    }
                    note={
                        globalStats.contacted === 0
                            ? 'No outreach sent'
                            : globalStats.responded === 0
                              ? `${globalStats.contacted} contacted, 0 replied`
                              : `${globalStats.contacted} contacted · ${globalStats.responded} replied`
                    }
                />
            </div>

            <div
                className="jobs-funnel-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 0.95fr)',
                    gap: 20,
                    marginBottom: 28,
                    alignItems: 'start',
                }}
            >
                <div
                    className="card section-panel"
                    style={{ height: 'min-content', alignSelf: 'start' }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 14,
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>Pipeline Funnel</div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-muted)',
                                    marginTop: 4,
                                }}
                            >
                                Live conversion tracking across all roles
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                        {[
                            { color: '#4a4a6a', label: 'Sourced' },
                            { color: '#6366f1', label: 'Scored' },
                            { color: '#7C3AED', label: 'Contacted' },
                            { color: '#10b981', label: 'Interested' },
                            { color: '#0d9488', label: 'Hired' },
                        ].map((item) => (
                            <div
                                key={item.label}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 11,
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                <div
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: item.color,
                                    }}
                                />
                                {item.label}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {jobs.map((job) => {
                            const stats = job.stats || {};
                            const total = job.candidateCount || 1;

                            const segments = [
                                {
                                    label: 'Sourced',
                                    count: job.candidateCount || 0,
                                    color: '#4a4a6a',
                                },
                                { label: 'Scored', count: stats.scored || 0, color: '#6366f1' },
                                {
                                    label: 'Contacted',
                                    count: stats.contacted || 0,
                                    color: '#7C3AED',
                                },
                                {
                                    label: 'Interested',
                                    count: stats.interested || 0,
                                    color: '#10b981',
                                },
                                { label: 'Hired', count: stats.hired || 0, color: '#0d9488' },
                            ];

                            return (
                                <div
                                    key={job._id}
                                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                                >
                                    <div
                                        style={{ minWidth: 180, fontSize: 12, color: '#8b8ba7' }}
                                        className="truncate"
                                    >
                                        {job.title}
                                    </div>
                                    <div
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            gap: 1,
                                            height: 8,
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            background: '#1a1a2e',
                                        }}
                                    >
                                        {segments.map((seg) => {
                                            const pct = Math.max(
                                                0,
                                                Math.round((seg.count / total) * 100),
                                            );
                                            if (pct === 0) return null;
                                            return (
                                                <div
                                                    key={seg.label}
                                                    style={{
                                                        width: `${pct}%`,
                                                        background: seg.color,
                                                        height: '100%',
                                                        minWidth: 3,
                                                        transition: 'width 0.3s ease',
                                                    }}
                                                    title={`${seg.label}: ${seg.count}`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div
                                        style={{
                                            minWidth: 24,
                                            textAlign: 'right',
                                            fontSize: 12,
                                            color: '#8b8ba7',
                                        }}
                                    >
                                        {job.candidateCount}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div
                    className="card section-panel"
                    style={{ height: 'min-content', alignSelf: 'start' }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Recent Activity</div>
                        <Link
                            to="/candidates"
                            className="text-sm text-muted hover:text-white transition-colors"
                        >
                            View all
                        </Link>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            maxHeight: 8 * 42,
                            overflowY: 'auto',
                        }}
                    >
                        {activityEvents.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                No recent activity yet.
                            </div>
                        ) : (
                            activityEvents.map((evt) => {
                                const actionLabel =
                                    evt.kind === 'scored'
                                        ? 'Scored'
                                        : evt.kind === 'sourced'
                                          ? 'Sourced'
                                          : evt.kind === 'contacted'
                                            ? 'Contacted'
                                            : 'Responded';

                                return (
                                    <div
                                        key={evt.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            minHeight: 34,
                                        }}
                                    >
                                        <span
                                            title={actionLabel}
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: evt.dotColor,
                                                boxShadow:
                                                    evt.kind === 'scored'
                                                        ? `0 0 0 4px ${evt.dotColor}22`
                                                        : 'none',
                                                flexShrink: 0,
                                            }}
                                        />
                                        <div
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                color: 'var(--color-text)',
                                            }}
                                            className="truncate"
                                        >
                                            <span>{evt.name}</span>{' '}
                                            <span style={{ color: 'var(--color-text-muted)' }}>
                                                {actionLabel}
                                            </span>{' '}
                                            {evt.score != null && (
                                                <>
                                                    <span
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                    >
                                                        with score
                                                    </span>{' '}
                                                    <strong
                                                        style={{ color: evt.tone, fontWeight: 700 }}
                                                    >
                                                        {evt.score}
                                                    </strong>{' '}
                                                </>
                                            )}
                                            <span style={{ color: 'var(--color-text-muted)' }}>
                                                for {evt.jobTitle}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--color-text-muted)',
                                                whiteSpace: 'nowrap',
                                                textAlign: 'right',
                                            }}
                                        >
                                            {evt.time}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="grid-cards animate-slide-up">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="card section-panel">
                            <div className="flex items-start justify-between gap-4 mb-5">
                                <div className="flex items-center gap-3 flex-1">
                                    <div
                                        className="skeleton-block skeleton-circle animated-float"
                                        style={{ width: 52, height: 52 }}
                                    />
                                    <div className="flex-1">
                                        <div
                                            className="skeleton-block skeleton-line mb-3"
                                            style={{ width: '72%', height: 18 }}
                                        />
                                        <div
                                            className="skeleton-block skeleton-line"
                                            style={{ width: '56%', height: 10 }}
                                        />
                                    </div>
                                </div>
                                <div
                                    className="skeleton-block skeleton-line"
                                    style={{ width: 72, height: 28, borderRadius: 999 }}
                                />
                            </div>
                            <div
                                className="skeleton-block skeleton-line mb-3"
                                style={{ width: '100%', height: 12 }}
                            />
                            <div
                                className="skeleton-block skeleton-line mb-3"
                                style={{ width: '86%', height: 12 }}
                            />
                            <div
                                className="skeleton-block skeleton-line"
                                style={{ width: '68%', height: 12 }}
                            />
                            <div
                                className="flex items-center justify-between mt-6 pt-4"
                                style={{ borderTop: '1px solid var(--color-border)' }}
                            >
                                <div
                                    className="skeleton-block skeleton-line"
                                    style={{ width: 110, height: 16 }}
                                />
                                <div
                                    className="skeleton-block skeleton-line"
                                    style={{ width: 94, height: 34, borderRadius: 999 }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : jobs.length === 0 ? (
                <div className="empty-state">
                    <Briefcase size={56} opacity={0.5} className="mb-4" />
                    <p className="text-2xl font-display font-bold">No roles configured</p>
                    <p className="text-muted mt-2 max-w-md mx-auto">
                        You haven't added any job openings yet. Create your first role to allow
                        RecruitAI to begin sourcing candidates automatically.
                    </p>
                </div>
            ) : (
                <div className="grid-cards jobs-card-grid animate-slide-up">
                    {jobs.map((job, index) => {
                        const avatarStyle = getAvatarStyle(job.title);
                        const total = job.candidateCount || 0;
                        const topScore = job.stats?.topScore;
                        const stageTooltip = `New: ${job.stats?.new || 0} | Scored: ${job.stats?.scored || 0} | Contacted: ${job.stats?.contacted || 0} | Interested: ${job.stats?.interested || 0} | Hired: ${job.stats?.hired || 0}`;
                        const displayedStatus = job.status === 'closed' ? 'archived' : job.status;

                        return (
                            <div
                                key={job._id}
                                className="card card--clickable group section-panel job-motion-card animate-pop"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-4)',
                                    animationDelay: `${180 + index * 70}ms`,
                                    height: 'min-content',
                                    alignSelf: 'start',
                                }}
                            >
                                <div className="job-card-top" style={{ alignItems: 'center' }}>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                                            style={{
                                                background: avatarStyle.bg,
                                                color: avatarStyle.color,
                                            }}
                                        >
                                            {job.title.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <h3
                                                className="font-bold text-xl group-hover:text-primary transition-colors truncate"
                                                style={{ marginBottom: 4 }}
                                            >
                                                {job.title}
                                            </h3>
                                            <div className="job-card-meta text-muted text-xs font-medium uppercase tracking-wider mt-1 flex items-center gap-2">
                                                <span>{job.location}</span>
                                                <span
                                                    style={{
                                                        width: 4,
                                                        height: 4,
                                                        borderRadius: '50%',
                                                        background: 'currentColor',
                                                        opacity: 0.5,
                                                    }}
                                                ></span>
                                                <span className="text-primary">{job.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div data-role-menu style={{ position: 'relative' }}>
                                        <button
                                            className="btn btn--secondary btn--sm job-menu-button"
                                            aria-label="Open role menu"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                setMenuOpen(menuOpen === job._id ? null : job._id);
                                            }}
                                        >
                                            <MoreHorizontal size={16} />
                                        </button>
                                        {menuOpen === job._id && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    top: 38,
                                                    background: 'var(--color-surface-2)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 12,
                                                    padding: 8,
                                                    zIndex: 5,
                                                    minWidth: 160,
                                                }}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setEditJob(job);
                                                        setPanelOpen(true);
                                                        setMenuOpen(null);
                                                    }}
                                                    style={menuButtonStyle}
                                                    aria-label="Edit role"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        duplicateMutation.mutate(job._id);
                                                        setMenuOpen(null);
                                                    }}
                                                    style={menuButtonStyle}
                                                    aria-label="Duplicate role"
                                                >
                                                    <Copy size={14} /> Duplicate
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        statusMutation.mutate({
                                                            id: job._id,
                                                            status:
                                                                job.status === 'active'
                                                                    ? 'paused'
                                                                    : 'active',
                                                        });
                                                        setMenuOpen(null);
                                                    }}
                                                    style={menuButtonStyle}
                                                    aria-label={
                                                        job.status === 'active'
                                                            ? 'Pause role'
                                                            : 'Resume role'
                                                    }
                                                >
                                                    <PauseCircle size={14} />{' '}
                                                    {job.status === 'active' ? 'Pause' : 'Resume'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        statusMutation.mutate({
                                                            id: job._id,
                                                            status: 'closed',
                                                        });
                                                        setMenuOpen(null);
                                                    }}
                                                    style={menuButtonStyle}
                                                    aria-label="Archive role"
                                                >
                                                    <Archive size={14} /> Archive
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        fontSize: 12,
                                        color: 'var(--color-text-muted)',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <span
                                        style={{
                                            padding: '3px 10px',
                                            borderRadius: 999,
                                            background: `${avatarStyle.color}12`,
                                            color: avatarStyle.color,
                                        }}
                                    >
                                        {total} candidates
                                    </span>
                                    <span>
                                        Top:{' '}
                                        {topScore == null ? (
                                            <span style={{ color: 'var(--color-text-muted)' }}>
                                                No scores yet
                                            </span>
                                        ) : (
                                            <strong style={{ color: metricTone(topScore) }}>
                                                {topScore}
                                            </strong>
                                        )}
                                    </span>
                                    {job.status !== 'active' && (
                                        <span className={`badge badge--${job.status}`}>
                                            {displayedStatus}
                                        </span>
                                    )}
                                </div>

                                <div
                                    title={stageTooltip}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                                        gap: 8,
                                    }}
                                >
                                    {[
                                        {
                                            key: 'new',
                                            label: 'N',
                                            count: job.stats?.new ?? 0,
                                            color: '#8b8ba7',
                                        },
                                        {
                                            key: 'scored',
                                            label: 'S',
                                            count: job.stats?.scored ?? 0,
                                            color: '#6366f1',
                                        },
                                        {
                                            key: 'contacted',
                                            label: 'C',
                                            count: job.stats?.contacted ?? 0,
                                            color: '#7C3AED',
                                        },
                                        {
                                            key: 'interested',
                                            label: 'I',
                                            count: job.stats?.interested ?? 0,
                                            color: '#10b981',
                                        },
                                        {
                                            key: 'hired',
                                            label: 'H',
                                            count: job.stats?.hired ?? 0,
                                            color: '#0d9488',
                                        },
                                    ].map((stage) => {
                                        const active = stage.count > 0;
                                        return (
                                            <div
                                                key={`${job._id}-stage-${stage.label}`}
                                                title={`${stage.label}: ${stage.count}`}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        color: 'var(--color-text-muted)',
                                                        letterSpacing: '0.08em',
                                                    }}
                                                >
                                                    {stage.label}
                                                </span>
                                                <span
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: active
                                                            ? stage.color
                                                            : 'transparent',
                                                        border: active
                                                            ? `1px solid ${stage.color}`
                                                            : '1.5px solid rgba(255,255,255,0.2)',
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div
                                    className="flex justify-between items-center pt-4 mt-auto"
                                    style={{ borderTop: '1px solid var(--color-border)' }}
                                >
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                        Pipeline progress
                                    </div>
                                    <Link
                                        to={`/jobs/${job._id}`}
                                        className="btn btn--secondary btn--sm"
                                        aria-label="Manage role"
                                    >
                                        Manage Role
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <JobSlideOver
                isOpen={panelOpen}
                onClose={() => setPanelOpen(false)}
                editJob={editJob}
            />
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    note,
    accent,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    note: string;
    accent: string;
}) {
    return (
        <div
            className="card stat-shell flex flex-col justify-between"
            style={{ '--stat-accent': accent } as React.CSSProperties}
        >
            <div className="flex items-start justify-between mb-4">
                <span
                    className="text-muted text-sm font-bold tracking-wider uppercase"
                    style={{ maxWidth: '70%' }}
                >
                    {label}
                </span>
                <div
                    className="p-2 rounded-md"
                    style={{
                        background: `${accent}18`,
                        color: accent,
                        width: 36,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {icon}
                </div>
            </div>
            <div className="score-value" style={{ fontSize: '1.9rem', color: accent }}>
                {value}
            </div>
            <div className="text-xs text-muted mt-2 font-medium">{note}</div>
        </div>
    );
}

const menuButtonStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text)',
    fontSize: 12,
    cursor: 'pointer',
    borderRadius: 8,
};
