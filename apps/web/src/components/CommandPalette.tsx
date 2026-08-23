import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Briefcase,
    Users,
    Zap,
    Clock,
    X,
    ArrowRight,
    FileText,
    MessagesSquare,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getJobs, globalSearch } from '@/services/api';
import type { Job } from '@/types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const QUICK_ACTIONS = [
    {
        id: 'new-role',
        label: 'Create New Role',
        icon: Briefcase,
        path: null,
        action: 'create-role',
    },
    {
        id: 'candidates',
        label: 'View All Candidates',
        icon: Users,
        path: '/candidates',
        action: null,
    },
    { id: 'queue', label: 'Open Queue Monitor', icon: Zap, path: null, action: 'queue' },
];

const RECENT_KEY = 'recruit-ai-recent-pages';

function getRecent(): Array<{ label: string; path: string }> {
    try {
        return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]');
    } catch {
        return [];
    }
}

export function pushRecentPage(label: string, path: string) {
    try {
        const existing = getRecent().filter((r) => r.path !== path);
        const updated = [{ label, path }, ...existing].slice(0, 5);
        sessionStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {}
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [activeIdx, setActiveIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const { data: jobs = [] } = useQuery<Job[]>({
        queryKey: ['jobs'],
        queryFn: () => getJobs(),
        enabled: isOpen,
        staleTime: 30_000,
    });

    const { data: searchResults } = useQuery({
        queryKey: ['global-search', query],
        queryFn: () => globalSearch(query),
        enabled: isOpen && query.trim().length >= 2,
        staleTime: 10_000,
    });

    const candidates = searchResults?.candidates ?? [];
    const searchedJobs = searchResults?.jobs ?? [];
    const interviews = searchResults?.interviews ?? [];
    const reports = searchResults?.reports ?? [];

    const q = query.toLowerCase();

    const filteredJobs = q
        ? searchedJobs
        : jobs.filter((j) => j.title.toLowerCase().includes(q)).slice(0, 5);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setActiveIdx(0);
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const hasJobs = filteredJobs.length > 0;
        const hasCandidates = candidates.length > 0;
        if (query.trim()) {
            if (hasJobs) {
                setActiveIdx(QUICK_ACTIONS.length);
            } else if (hasCandidates) {
                setActiveIdx(QUICK_ACTIONS.length + filteredJobs.length);
            } else {
                setActiveIdx(0);
            }
            return;
        }
        setActiveIdx(0);
    }, [query, isOpen, filteredJobs.length, candidates.length]);

    const recent = getRecent();

    // Build flat result list for keyboard nav
    const allResults: Array<{ label: string; sub?: string; go: () => void }> = [
        ...QUICK_ACTIONS.map((a) => ({
            label: a.label,
            go: () => {
                if (a.action === 'queue') {
                    window.open('/admin/queues', '_blank');
                    onClose();
                } else if (a.action === 'create-role') {
                    window.dispatchEvent(new CustomEvent('recruitai:open-job-panel'));
                    onClose();
                } else if (a.path) {
                    navigate(a.path);
                    onClose();
                }
            },
        })),
        ...filteredJobs.map((j) => ({
            label: j.title,
            sub: j.status,
            go: () => {
                navigate(`/jobs/${j._id}`);
                onClose();
            },
        })),
        ...candidates.map((c) => ({
            label: c.name,
            sub: c.headline,
            go: () => {
                navigate(`/candidates/${c._id}`);
                onClose();
            },
        })),
        ...interviews.map((interview) => ({
            label: interview.title,
            sub: 'Interview',
            go: () => {
                navigate(`/interviews/${interview._id}`);
                onClose();
            },
        })),
        ...reports.map((report) => ({
            label: report.title,
            sub: 'Candidate report',
            go: () => {
                navigate(`/candidates/${report.candidateId}`);
                onClose();
            },
        })),
        ...(!q
            ? recent.map((r) => ({
                  label: r.label,
                  go: () => {
                      navigate(r.path);
                      onClose();
                  },
              }))
            : []),
    ];

    const handleKey = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, allResults.length - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter' && allResults[activeIdx]) {
                allResults[activeIdx].go();
            }
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [allResults, activeIdx, onClose],
    );

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9000,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '15vh',
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 600,
                    background: 'var(--color-surface-2, #111115)',
                    border: '1px solid rgba(124,58,237,0.25)',
                    borderRadius: 16,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)',
                    overflow: 'hidden',
                    animation: 'cmd-in 0.18s ease',
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKey}
            >
                {/* Search input */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                >
                    <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIdx(0);
                        }}
                        placeholder="Search jobs, candidates, actions..."
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            fontSize: 15,
                            color: 'var(--color-text)',
                            fontFamily: 'inherit',
                        }}
                        aria-label="Command palette search"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-text-muted)',
                                display: 'flex',
                            }}
                            aria-label="Clear search"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <kbd
                        style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--color-border)',
                            fontSize: 11,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        Esc
                    </kbd>
                </div>

                {/* Results */}
                <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
                    {/* Quick Actions */}
                    <Section label="Quick Actions">
                        {QUICK_ACTIONS.map((a, i) => {
                            const Icon = a.icon;
                            const idx = i;
                            return (
                                <ResultRow
                                    key={a.id}
                                    icon={<Icon size={15} />}
                                    label={a.label}
                                    active={activeIdx === idx}
                                    onHover={() => setActiveIdx(idx)}
                                    onClick={() => {
                                        if (a.action === 'queue')
                                            window.open('/admin/queues', '_blank');
                                        else if (a.action === 'create-role')
                                            window.dispatchEvent(
                                                new CustomEvent('recruitai:open-job-panel'),
                                            );
                                        else if (a.path) navigate(a.path);
                                        onClose();
                                    }}
                                />
                            );
                        })}
                    </Section>

                    {filteredJobs.length > 0 && (
                        <Section label="Jobs">
                            {filteredJobs.map((j, i) => {
                                const idx = QUICK_ACTIONS.length + i;
                                return (
                                    <ResultRow
                                        key={j._id}
                                        icon={<Briefcase size={15} />}
                                        label={j.title}
                                        sub={j.status}
                                        active={activeIdx === idx}
                                        onHover={() => setActiveIdx(idx)}
                                        onClick={() => {
                                            navigate(`/jobs/${j._id}`);
                                            onClose();
                                        }}
                                    />
                                );
                            })}
                        </Section>
                    )}

                    {candidates.length > 0 && (
                        <Section label="Candidates">
                            {candidates.map((c, i) => {
                                const idx = QUICK_ACTIONS.length + filteredJobs.length + i;
                                return (
                                    <ResultRow
                                        key={c._id}
                                        icon={<Users size={15} />}
                                        label={c.name}
                                        sub={c.headline}
                                        active={activeIdx === idx}
                                        onHover={() => setActiveIdx(idx)}
                                        onClick={() => {
                                            navigate(`/candidates/${c._id}`);
                                            onClose();
                                        }}
                                    />
                                );
                            })}
                        </Section>
                    )}

                    {interviews.length > 0 && (
                        <Section label="Interviews">
                            {interviews.map((interview, i) => {
                                const idx =
                                    QUICK_ACTIONS.length +
                                    filteredJobs.length +
                                    candidates.length +
                                    i;
                                return (
                                    <ResultRow
                                        key={interview._id}
                                        icon={<MessagesSquare size={15} />}
                                        label={interview.title}
                                        sub={interview.status}
                                        active={activeIdx === idx}
                                        onHover={() => setActiveIdx(idx)}
                                        onClick={() => {
                                            navigate(`/interviews/${interview._id}`);
                                            onClose();
                                        }}
                                    />
                                );
                            })}
                        </Section>
                    )}

                    {reports.length > 0 && (
                        <Section label="Reports">
                            {reports.map((report, i) => {
                                const idx =
                                    QUICK_ACTIONS.length +
                                    filteredJobs.length +
                                    candidates.length +
                                    interviews.length +
                                    i;
                                return (
                                    <ResultRow
                                        key={report._id}
                                        icon={<FileText size={15} />}
                                        label={report.title}
                                        sub="Candidate report"
                                        active={activeIdx === idx}
                                        onHover={() => setActiveIdx(idx)}
                                        onClick={() => {
                                            navigate(`/candidates/${report.candidateId}`);
                                            onClose();
                                        }}
                                    />
                                );
                            })}
                        </Section>
                    )}

                    {!q && recent.length > 0 && (
                        <Section label="Recent">
                            {recent.map((r, i) => {
                                const idx =
                                    QUICK_ACTIONS.length +
                                    filteredJobs.length +
                                    candidates.length +
                                    interviews.length +
                                    reports.length +
                                    i;
                                return (
                                    <ResultRow
                                        key={r.path}
                                        icon={<Clock size={15} />}
                                        label={r.label}
                                        active={activeIdx === idx}
                                        onHover={() => setActiveIdx(idx)}
                                        onClick={() => {
                                            navigate(r.path);
                                            onClose();
                                        }}
                                    />
                                );
                            })}
                        </Section>
                    )}
                </div>

                <div
                    style={{
                        padding: '8px 16px',
                        borderTop: '1px solid var(--color-border)',
                        display: 'flex',
                        gap: 12,
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    <span>↑↓ navigate</span>
                    <span>↵ select</span>
                    <span>Esc close</span>
                </div>
            </div>
        </div>
    );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 4 }}>
            <div
                style={{
                    padding: '6px 18px 4px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                }}
            >
                {label}
            </div>
            {children}
        </div>
    );
}

function ResultRow({
    icon,
    label,
    sub,
    active,
    onHover,
    onClick,
    hint = 'Enter',
}: {
    icon: React.ReactNode;
    label: string;
    sub?: string;
    active: boolean;
    onHover: () => void;
    onClick: () => void;
    hint?: string;
}) {
    return (
        <button
            onMouseEnter={onHover}
            onClick={onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 18px',
                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                transition: 'background 0.12s',
            }}
            aria-label={label}
        >
            <span style={{ color: active ? 'var(--color-primary)' : undefined, flexShrink: 0 }}>
                {icon}
            </span>
            <span
                style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
            >
                {label}
            </span>
            {sub && <span style={{ fontSize: 11 }}>{sub}</span>}
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{hint}</span>
            {active && <ArrowRight size={13} style={{ flexShrink: 0 }} />}
        </button>
    );
}
