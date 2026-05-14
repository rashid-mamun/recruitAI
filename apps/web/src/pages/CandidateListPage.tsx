import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Users, Filter, ArrowLeft } from 'lucide-react';
import { api } from '@/services/api';
import CandidateHoverCard from '@/components/CandidateHoverCard';
import type { Candidate, PaginatedResponse } from '@/types';

export default function CandidateListPage() {
    const { jobId } = useParams();

    const { data, isLoading } = useQuery<PaginatedResponse<Candidate>>({
        queryKey: ['candidates', jobId],
        queryFn: async () => {
            const res = await api.get<any>(
                jobId
                    ? `/api/jobs/${jobId}/candidates?sort=-score&limit=50`
                    : `/api/jobs/1/candidates`,
            );
            return {
                data: res.data.data || [],
                pagination: {
                    page: res.data.page || 1,
                    limit: res.data.limit || 50,
                    total: res.data.total || 0,
                    totalPages: res.data.totalPages || 1,
                },
            } as PaginatedResponse<Candidate>;
        },
        enabled: !!jobId,
    });

    return (
        <div>
            <div className="mb-6">
                <Link
                    to={`/jobs/${jobId}`}
                    className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-sm font-medium"
                >
                    <ArrowLeft size={16} /> Back to Job
                </Link>
            </div>

            <div className="hero-panel mb-6">
                <div>
                    <div className="hero-panel__eyebrow">Talent pipeline</div>
                    <h1 className="hero-panel__title page-title">Candidates</h1>
                    <p className="hero-panel__desc page-subtitle">
                        Sourced and scored prospects for this role, organized for quick review and
                        next-step decisions.
                    </p>
                </div>
                <div className="hero-panel__actions">
                    <div className="metric-pill">
                        <span>Visible</span> <strong>{data?.data.length || 0}</strong>
                    </div>
                    <button className="btn btn--secondary">
                        <Filter size={16} /> Filter
                    </button>
                </div>
            </div>

            <div className="card p-0 overflow-hidden animate-slide-up">
                {isLoading ? (
                    <div className="table-wrapper m-0 border-0 p-6">
                        <div className="list-stack">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-4 p-4 section-panel"
                                >
                                    <div
                                        className="skeleton-block skeleton-circle"
                                        style={{ width: 44, height: 44 }}
                                    />
                                    <div className="flex-1">
                                        <div
                                            className="skeleton-block skeleton-line mb-3"
                                            style={{ width: '36%', height: 14 }}
                                        />
                                        <div
                                            className="skeleton-block skeleton-line"
                                            style={{ width: '64%', height: 10 }}
                                        />
                                    </div>
                                    <div
                                        className="skeleton-block skeleton-line"
                                        style={{ width: 90, height: 28, borderRadius: 999 }}
                                    />
                                    <div
                                        className="skeleton-block skeleton-line"
                                        style={{ width: 96, height: 28, borderRadius: 999 }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : data?.data.length === 0 ? (
                    <div className="empty-state">
                        <Users size={48} />
                        <p className="text-lg font-semibold mt-4">No candidates yet</p>
                        <p className="text-muted mt-2">
                            Trigger sourcing from the job details page to find matches.
                        </p>
                    </div>
                ) : (
                    <div className="table-wrapper m-0 border-0 desktop-only">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th>Candidate Profile</th>
                                    <th>Status</th>
                                    <th>Match Score</th>
                                    <th>Source</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.data.map((can) => (
                                    <tr key={can._id} className="candidate-row">
                                        <td>
                                            <div className="flex flex-col min-w-0">
                                                <CandidateHoverCard candidate={can}>
                                                    <span
                                                        className="candidate-card__name truncate"
                                                        style={{ display: 'inline-block' }}
                                                    >
                                                        {can.name}
                                                    </span>
                                                </CandidateHoverCard>
                                                <span
                                                    className="candidate-card__headline truncate"
                                                    style={{ maxWidth: 420 }}
                                                >
                                                    {can.headline}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`badge badge--${can.status}`}>
                                                {can.status}
                                            </div>
                                        </td>
                                        <td>
                                            {can.score ? (
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`score-value text-xl score-value--${can.score.value >= 80 ? 'high' : can.score.value >= 50 ? 'medium' : 'low'}`}
                                                    >
                                                        {can.score.value}
                                                    </div>
                                                    <div
                                                        className="progress-bar opacity-80"
                                                        style={{ width: 60 }}
                                                    >
                                                        <div
                                                            className="progress-bar__fill"
                                                            style={{
                                                                width: `${can.score.value}%`,
                                                                background:
                                                                    can.score.value >= 80
                                                                        ? 'var(--color-success)'
                                                                        : can.score.value >= 50
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
                                            <span className="chip-pill">{can.source}</span>
                                        </td>
                                        <td>
                                            <Link
                                                to={`/candidates/${can._id}`}
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
            </div>

            {!isLoading && data?.data.length ? (
                <div
                    className="mobile-only"
                    style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}
                >
                    {data.data.map((can) => {
                        const initials = can.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2);
                        return (
                            <div key={can._id} className="card" style={{ padding: 14 }}>
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
                                        {initials}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <CandidateHoverCard candidate={can}>
                                            <div
                                                className="candidate-card__name truncate"
                                                style={{ display: 'inline-block' }}
                                            >
                                                {can.name}
                                            </div>
                                        </CandidateHoverCard>
                                        <div className="candidate-card__headline truncate">
                                            {can.headline}
                                        </div>
                                    </div>
                                    <Link
                                        to={`/candidates/${can._id}`}
                                        className="btn btn--secondary btn--sm"
                                    >
                                        Details
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
