import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Download, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCandidates, getJobs, scoreCandidate, sendOutreach } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { SkeletonCandidateRow } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import CandidateHoverCard from '@/components/CandidateHoverCard';
import { timeAgo } from '@/utils/timeAgo';
import type { Candidate, CandidateStatus, Job } from '@/types';

const STATUSES: CandidateStatus[] = [
    'new',
    'scored',
    'contacted',
    'interested',
    'responded',
    'hired',
    'not_interested',
];
const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    scored: 'Scored',
    contacted: 'Contacted',
    interested: 'Interested',
    responded: 'Responded',
    hired: 'Hired',
    not_interested: 'Not Interested',
};
const STATUS_COLORS: Record<string, string> = {
    new: '#8b8ba7',
    scored: '#7C3AED',
    contacted: '#3b82f6',
    interested: '#10b981',
    responded: '#10b981',
    hired: '#10b981',
    not_interested: '#ef4444',
};
const AVATAR_COLORS = ['#7C3AED', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function avatarColor(name: string) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function normalizeStatus(status: string): CandidateStatus {
    if (status === 'sourced') return 'new';
    if (status === 'responded') return 'interested';
    if (status === 'scheduling') return 'hired';
    if (status === 'rejected') return 'not_interested';
    return status as CandidateStatus;
}

function exportCSV(candidates: Candidate[]) {
    const headers = ['Name', 'Headline', 'Status', 'Score', 'Source', 'Location'];
    const rows = candidates.map((c) => [
        c.name,
        c.headline,
        c.status,
        c.score?.value ?? '',
        c.source,
        c.location,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
        download: 'candidates.csv',
    });
    a.click();
}

export default function AllCandidatesPage() {
    const { showSuccess, showError } = useToast();
    const [search, setSearch] = useState('');
    const [minScore, setMinScore] = useState(0);
    const [maxScore, setMaxScore] = useState(100);
    const [selectedStatuses, setSelectedStatuses] = useState<CandidateStatus[]>([]);
    const [jobFilter, setJobFilter] = useState('');
    const [sortBy, setSortBy] = useState('-score');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const { data, isLoading, refetch } = useQuery({
        queryKey: [
            'all-candidates',
            search,
            minScore,
            maxScore,
            selectedStatuses.join(','),
            jobFilter,
            sortBy,
            page,
        ],
        queryFn: () =>
            getCandidates({
                search: search || undefined,
                minScore: minScore > 0 ? minScore : undefined,
                maxScore: maxScore < 100 ? maxScore : undefined,
                status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
                jobId: jobFilter || undefined,
                sort: sortBy,
                page,
                limit: 25,
            }),
        staleTime: 15_000,
    });

    const { data: jobs = [] } = useQuery<Job[]>({
        queryKey: ['jobs'],
        queryFn: () => getJobs(),
        staleTime: 30_000,
    });

    const candidates: Candidate[] = data?.data ?? [];
    const total = data?.pagination?.total ?? 0;
    const totalPages = data?.pagination?.totalPages ?? 1;

    const filteredCandidates =
        selectedStatuses.length > 1
            ? candidates.filter((c) =>
                  selectedStatuses.includes(normalizeStatus(c.status) as CandidateStatus),
              )
            : candidates;

    const toggleStatus = (s: CandidateStatus) => {
        setSelectedStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
        setPage(1);
    };
    const toggleSelect = (id: string) => {
        setSelected((p) => {
            const n = new Set(p);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };
    const selectAll = () =>
        setSelected(
            selected.size === filteredCandidates.length
                ? new Set()
                : new Set(filteredCandidates.map((c) => c._id)),
        );
    const selectedList = filteredCandidates.filter((c) => selected.has(c._id));
    const hasFilters = !!(
        search ||
        minScore > 0 ||
        maxScore < 100 ||
        selectedStatuses.length ||
        jobFilter
    );
    const resetFilters = () => {
        setSearch('');
        setMinScore(0);
        setMaxScore(100);
        setSelectedStatuses([]);
        setJobFilter('');
        setSortBy('-score');
        setPage(1);
    };

    const bulkScore = useMutation({
        mutationFn: async () => {
            for (const c of selectedList) {
                try {
                    await scoreCandidate(c._id);
                } catch {}
            }
        },
        onSuccess: () => {
            showSuccess(`bulk-score-${Date.now()}`, `Scoring ${selectedList.length} candidates...`);
            refetch();
        },
    });
    const bulkOutreach = useMutation({
        mutationFn: async () => {
            for (const c of selectedList) {
                try {
                    await sendOutreach(c._id, c.jobId);
                } catch {}
            }
        },
        onSuccess: () =>
            showSuccess(
                `bulk-outreach-${Date.now()}`,
                `Outreach queued for ${selectedList.length} candidates.`,
            ),
        onError: () => showError(`bulk-outreach-${Date.now()}`, 'Failed to queue outreach.'),
    });

    return (
        <div className="animate-fade-in pb-12">
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '2rem' }}>
                        All Candidates
                        <span
                            style={{
                                marginLeft: 12,
                                fontSize: 14,
                                fontWeight: 600,
                                background: 'rgba(124,58,237,0.15)',
                                color: '#a78bfa',
                                borderRadius: 999,
                                padding: '2px 12px',
                                verticalAlign: 'middle',
                            }}
                        >
                            {total}
                        </span>
                    </h1>
                    <p className="page-subtitle">Across all pipelines</p>
                </div>
                <button
                    className="btn btn--secondary"
                    onClick={() => exportCSV(candidates)}
                    aria-label="Export CSV"
                >
                    <Download size={16} /> Export CSV
                </button>
            </div>

            {/* Filter bar */}
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginBottom: 20,
                    padding: '14px 0',
                    borderBottom: '1px solid var(--color-border)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 3,
                    background: 'var(--bg-primary)',
                }}
            >
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search
                        size={14}
                        style={{
                            position: 'absolute',
                            left: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--color-text-muted)',
                        }}
                    />
                    <input
                        className="input"
                        style={{ paddingLeft: 34 }}
                        placeholder="Search by name or title..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        aria-label="Search candidates"
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Score:</span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={minScore}
                        onChange={(e) => {
                            setMinScore(+e.target.value);
                            setPage(1);
                        }}
                        style={{ width: 70 }}
                        aria-label="Min score"
                    />
                    <span style={{ color: '#a78bfa', fontWeight: 700, minWidth: 48 }}>
                        {minScore}–{maxScore}
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={maxScore}
                        onChange={(e) => {
                            setMaxScore(+e.target.value);
                            setPage(1);
                        }}
                        style={{ width: 70 }}
                        aria-label="Max score"
                    />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STATUSES.map((s) => {
                        const active = selectedStatuses.includes(s);
                        return (
                            <button
                                key={s}
                                onClick={() => toggleStatus(s)}
                                aria-pressed={active}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 24,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    border: `1px solid ${active ? STATUS_COLORS[s] : 'var(--color-border)'}`,
                                    background: active ? `${STATUS_COLORS[s]}20` : 'transparent',
                                    color: active ? STATUS_COLORS[s] : 'var(--color-text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {STATUS_LABELS[s]}
                            </button>
                        );
                    })}
                </div>
                <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={jobFilter}
                    onChange={(e) => {
                        setJobFilter(e.target.value);
                        setPage(1);
                    }}
                    aria-label="Filter by job"
                >
                    <option value="">All Roles</option>
                    {jobs.map((job) => (
                        <option key={job._id} value={job._id}>
                            {job.title}
                        </option>
                    ))}
                </select>
                <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={sortBy}
                    onChange={(e) => {
                        setSortBy(e.target.value);
                        setPage(1);
                    }}
                    aria-label="Sort by"
                >
                    <option value="-score">Score ↓</option>
                    <option value="score">Score ↑</option>
                    <option value="name">Name A–Z</option>
                    <option value="-updatedAt">Last Activity</option>
                </select>
                {hasFilters && (
                    <button
                        onClick={resetFilters}
                        className="btn btn--secondary btn--sm"
                        aria-label="Reset filters"
                    >
                        <X size={14} /> Reset
                    </button>
                )}
            </div>

            {/* Bulk bar */}
            {selected.size > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        marginBottom: 12,
                        background: 'rgba(124,58,237,0.10)',
                        border: '1px solid rgba(124,58,237,0.2)',
                        borderRadius: 12,
                    }}
                >
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#a78bfa' }}>
                        {selected.size} selected
                    </span>
                    <button
                        className="btn btn--primary btn--sm"
                        onClick={() => bulkScore.mutate()}
                        disabled={bulkScore.isPending}
                        aria-label="Score selected"
                    >
                        Score All
                    </button>
                    <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => bulkOutreach.mutate()}
                        disabled={bulkOutreach.isPending}
                        aria-label="Send outreach to selected"
                    >
                        Send Outreach
                    </button>
                    <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => exportCSV(selectedList)}
                        aria-label="Export selected"
                    >
                        <Download size={13} /> Export
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: 'var(--color-text-muted)',
                            marginLeft: 'auto',
                        }}
                        aria-label="Clear selection"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <SkeletonCandidateRow key={i} />
                        ))}
                    </div>
                ) : filteredCandidates.length === 0 ? (
                    <EmptyState
                        icon={<Users size={28} />}
                        title="No candidates match your filters"
                        description="Try adjusting your search or filters."
                        action={{ label: 'Reset Filters', onClick: resetFilters }}
                    />
                ) : (
                    <div className="table-wrapper m-0 border-0 desktop-only">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                selected.size === filteredCandidates.length &&
                                                filteredCandidates.length > 0
                                            }
                                            onChange={selectAll}
                                            aria-label="Select all"
                                        />
                                    </th>
                                    <th>Candidate</th>
                                    <th>Job Role</th>
                                    <th>Match Score</th>
                                    <th>Status</th>
                                    <th>Source</th>
                                    <th>Last Activity</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCandidates.map((c) => {
                                    const initials = c.name
                                        .split(' ')
                                        .map((p) => p[0])
                                        .join('')
                                        .toUpperCase()
                                        .slice(0, 2);
                                    const bg = avatarColor(c.name);
                                    const sc = c.score?.value;
                                    const normalized = normalizeStatus(c.status) as CandidateStatus;
                                    const scoreColor =
                                        sc != null && sc > 0
                                            ? sc >= 70
                                                ? '#10b981'
                                                : sc >= 50
                                                  ? '#f59e0b'
                                                  : '#ef4444'
                                            : 'var(--color-text-muted)';
                                    const jobTitle =
                                        jobs.find((j: any) => j._id === c.jobId)?.title ||
                                        'Unknown';
                                    return (
                                        <tr key={c._id} className="candidate-row">
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(c._id)}
                                                    onChange={() => toggleSelect(c._id)}
                                                    aria-label={`Select ${c.name}`}
                                                />
                                            </td>
                                            <td>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: '50%',
                                                            background: bg,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: '#fff',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {initials}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <CandidateHoverCard candidate={c}>
                                                            <div
                                                                className="candidate-card__name truncate"
                                                                style={{ display: 'inline-block' }}
                                                            >
                                                                {c.name}
                                                            </div>
                                                        </CandidateHoverCard>
                                                        <div className="candidate-card__headline truncate">
                                                            {c.headline}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/jobs/${c.jobId}`}
                                                    style={{ color: 'var(--color-text)' }}
                                                    aria-label={`Open job ${jobTitle}`}
                                                >
                                                    {jobTitle}
                                                </Link>
                                            </td>
                                            <td>
                                                {sc != null && sc > 0 ? (
                                                    <div
                                                        className="score-cell"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <span
                                                            className="score-number"
                                                            style={{
                                                                fontWeight: 700,
                                                                fontSize: 15,
                                                                color: scoreColor,
                                                            }}
                                                        >
                                                            {sc}
                                                        </span>
                                                        <div
                                                            className="score-bar-track"
                                                            style={{
                                                                width: 48,
                                                                height: 4,
                                                                borderRadius: 2,
                                                                background:
                                                                    'rgba(255,255,255,0.08)',
                                                                overflow: 'hidden',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <div
                                                                className="score-bar-fill"
                                                                style={{
                                                                    height: '100%',
                                                                    width: `${sc}%`,
                                                                    background: scoreColor,
                                                                    borderRadius: 2,
                                                                    transition: 'width 0.3s ease',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span
                                                        style={{
                                                            fontSize: '15px',
                                                            color: 'var(--color-text-muted)',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    style={{
                                                        padding: '3px 10px',
                                                        borderRadius: 24,
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        background: `${STATUS_COLORS[normalized] || '#8b8ba7'}20`,
                                                        color:
                                                            STATUS_COLORS[normalized] ||
                                                            'var(--color-text-muted)',
                                                    }}
                                                >
                                                    {STATUS_LABELS[normalized] || normalized}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="chip-pill">{c.source}</span>
                                            </td>
                                            <td
                                                style={{
                                                    color: 'var(--color-text-muted)',
                                                    fontSize: 12,
                                                }}
                                            >
                                                {timeAgo(c.updatedAt || c.createdAt)}
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/candidates/${c._id}`}
                                                    className="btn btn--secondary btn--sm"
                                                    aria-label={`View ${c.name}`}
                                                >
                                                    Details
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {!isLoading && filteredCandidates.length > 0 && (
                <div
                    className="mobile-only"
                    style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}
                >
                    {filteredCandidates.map((c) => {
                        const initials = c.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2);
                        const bg = avatarColor(c.name);
                        const sc = c.score?.value;
                        const normalized = normalizeStatus(c.status) as CandidateStatus;
                        const scoreColor =
                            sc != null
                                ? sc >= 71
                                    ? '#10b981'
                                    : sc >= 41
                                      ? '#f59e0b'
                                      : '#ef4444'
                                : 'var(--color-text-muted)';
                        const jobTitle = jobs.find((j) => j._id === c.jobId)?.title || 'Unknown';
                        return (
                            <div key={c._id} className="card" style={{ padding: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '50%',
                                            background: bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: '#fff',
                                        }}
                                    >
                                        {initials}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            {c.headline}
                                        </div>
                                        <Link
                                            to={`/jobs/${c.jobId}`}
                                            style={{
                                                fontSize: 12,
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            {jobTitle}
                                        </Link>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(c._id)}
                                        onChange={() => toggleSelect(c._id)}
                                        aria-label={`Select ${c.name}`}
                                    />
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        marginTop: 10,
                                    }}
                                >
                                    <span style={{ fontWeight: 700, color: scoreColor }}>
                                        {sc ?? '—'}
                                    </span>
                                    <span
                                        style={{
                                            padding: '3px 10px',
                                            borderRadius: 24,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            background: `${STATUS_COLORS[normalized] || '#8b8ba7'}20`,
                                            color:
                                                STATUS_COLORS[normalized] ||
                                                'var(--color-text-muted)',
                                        }}
                                    >
                                        {STATUS_LABELS[normalized] || normalized}
                                    </span>
                                    <span className="chip-pill">{c.source}</span>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginTop: 10,
                                    }}
                                >
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                        {timeAgo(c.updatedAt || c.createdAt)}
                                    </div>
                                    <Link
                                        to={`/candidates/${c._id}`}
                                        className="btn btn--secondary btn--sm"
                                    >
                                        Details
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 24,
                    }}
                >
                    <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={15} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                border: `1px solid ${page === p ? '#7C3AED' : 'var(--color-border)'}`,
                                background: page === p ? 'rgba(124,58,237,0.15)' : 'transparent',
                                color: page === p ? '#a78bfa' : 'var(--color-text-muted)',
                                cursor: 'pointer',
                            }}
                            aria-label={`Page ${p}`}
                            aria-current={page === p ? 'page' : undefined}
                        >
                            {p}
                        </button>
                    ))}
                    <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        aria-label="Next page"
                    >
                        <ChevronRight size={15} />
                    </button>
                </div>
            )}
        </div>
    );
}
