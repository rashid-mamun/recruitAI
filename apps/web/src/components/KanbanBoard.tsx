import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCandidate } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { Candidate, CandidateStatus } from '@/types';

const COLUMNS: { key: CandidateStatus; label: string; color: string }[] = [
    { key: 'new', label: 'New', color: '#8b8ba7' },
    { key: 'scored', label: 'Scored', color: '#7C3AED' },
    { key: 'contacted', label: 'Contacted', color: '#3b82f6' },
    { key: 'interested', label: 'Interested', color: '#10b981' },
    { key: 'hired', label: 'Hired', color: '#f59e0b' },
];

function normalizeStatus(status: CandidateStatus): CandidateStatus {
    if (status === 'sourced') return 'new';
    if (status === 'responded') return 'interested';
    if (status === 'scheduling') return 'hired';
    return status;
}

function scoreColor(score: number) {
    if (score >= 70) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
}

function avatarColor(text: string) {
    const colors = ['#7C3AED', '#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#10b981'];
    const idx = text.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colors.length;
    return colors[idx];
}

interface KanbanBoardProps {
    candidates: Candidate[];
    onStatusChange?: (id: string, status: CandidateStatus) => void;
}

export default function KanbanBoard({ candidates, onStatusChange }: KanbanBoardProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    // Optimistic local state
    const [localCandidates, setLocalCandidates] = useState<Candidate[]>(candidates);

    // Sync when prop changes
    if (candidates !== localCandidates && candidates.length !== localCandidates.length) {
        setLocalCandidates(candidates);
    }

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overColumn, setOverColumn] = useState<CandidateStatus | null>(null);

    const patchMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
            updateCandidate(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
        },
        onError: (err: Error, vars) => {
            // Revert optimistic
            setLocalCandidates(candidates);
            showError(`kanban-${vars.id}`, `Move failed: ${err.message}`);
        },
    });

    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, col: CandidateStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverColumn(col);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent, col: CandidateStatus) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            const candidate = localCandidates.find((c) => c._id === id);
            if (!candidate || normalizeStatus(candidate.status) === col) {
                setDraggingId(null);
                setOverColumn(null);
                return;
            }

            // Optimistic update
            setLocalCandidates((prev) =>
                prev.map((c) => (c._id === id ? { ...c, status: col } : c)),
            );
            patchMutation.mutate({ id, status: col });
            onStatusChange?.(id, col);
            if (col === 'hired') {
                triggerConfetti();
            }
            setDraggingId(null);
            setOverColumn(null);
        },
        [localCandidates, patchMutation, onStatusChange],
    );

    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
        setOverColumn(null);
    }, []);

    return (
        <div
            style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                padding: '8px 0 16px',
                minHeight: 500,
            }}
        >
            {COLUMNS.map((col) => {
                const colCandidates = localCandidates.filter(
                    (c) => normalizeStatus(c.status) === col.key,
                );
                const isOver = overColumn === col.key;

                return (
                    <div
                        key={col.key}
                        onDragOver={(e) => handleDragOver(e, col.key)}
                        onDrop={(e) => handleDrop(e, col.key)}
                        onDragLeave={() => setOverColumn(null)}
                        style={{
                            minWidth: 220,
                            flex: '0 0 220px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            borderRadius: 14,
                            border: `2px solid ${isOver ? col.color : 'transparent'}`,
                            background: isOver ? `${col.color}08` : 'transparent',
                            padding: 8,
                            transition: 'border-color 0.15s, background 0.15s',
                        }}
                    >
                        {/* Column header */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '0 4px 4px',
                            }}
                        >
                            <span
                                style={{
                                    fontWeight: 700,
                                    fontSize: 13,
                                    color: 'var(--color-text)',
                                }}
                            >
                                {col.label}
                            </span>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--color-text-muted)',
                                    borderRadius: 6,
                                    padding: '2px 6px',
                                }}
                            >
                                {colCandidates.length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                            {colCandidates.map((c) => (
                                <KanbanCard
                                    key={c._id}
                                    candidate={c}
                                    isDragging={draggingId === c._id}
                                    accentColor={col.color}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => navigate(`/candidates/${c._id}`)}
                                />
                            ))}
                            {colCandidates.length === 0 && (
                                <div
                                    style={{
                                        border: '2px dashed rgba(255,255,255,0.08)',
                                        borderRadius: 10,
                                        padding: '24px 12px',
                                        textAlign: 'center',
                                        minHeight: 80,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s',
                                        background: isOver
                                            ? 'rgba(124,58,237,0.08)'
                                            : 'transparent',
                                        borderColor: isOver ? '#7C3AED' : 'rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <div style={{ fontSize: 12, color: '#4a4a6a' }}>Drop here</div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

let confettiPromise: Promise<void> | null = null;

function loadConfetti(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if ((window as any).confetti) return Promise.resolve();
    if (!confettiPromise) {
        confettiPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src =
                'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.body.appendChild(script);
        });
    }
    return confettiPromise;
}

function triggerConfetti() {
    loadConfetti()
        .then(() => {
            const confetti = (window as any).confetti;
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 140,
                    spread: 70,
                    origin: { y: 0.7 },
                    colors: ['#7C3AED', '#10b981', '#3b82f6', '#f59e0b'],
                });
            }
        })
        .catch(() => {});
}

function KanbanCard({
    candidate,
    isDragging,
    accentColor,
    onDragStart,
    onDragEnd,
    onClick,
}: {
    candidate: Candidate;
    isDragging: boolean;
    accentColor: string;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
    onClick: () => void;
}) {
    const initials = candidate.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    const bg = avatarColor(candidate.name);

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, candidate._id)}
            onDragEnd={onDragEnd}
            onClick={onClick}
            style={{
                background: 'var(--color-glass, rgba(255,255,255,0.02))',
                border: `1px solid ${isDragging ? accentColor : 'var(--color-border)'}`,
                borderRadius: 12,
                padding: '12px 12px',
                cursor: 'grab',
                opacity: isDragging ? 0.45 : 1,
                transition: 'border-color 0.15s, opacity 0.15s, transform 0.15s, box-shadow 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
            }}
            onMouseEnter={(e) => {
                if (!isDragging)
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
            aria-label={`${candidate.name} — drag to move`}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        flexShrink: 0,
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
                <div style={{ minWidth: 0 }}>
                    <p
                        style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: 'var(--color-text)',
                            lineHeight: 1.3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {candidate.name}
                    </p>
                    <p
                        style={{
                            fontSize: 11,
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {candidate.headline || candidate.location || '—'}
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {candidate.score && (
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: `${scoreColor(candidate.score.value)}15`,
                            color: scoreColor(candidate.score.value),
                        }}
                    >
                        {candidate.score.value}
                    </span>
                )}
                <span
                    style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    {candidate.source}
                </span>
            </div>
        </div>
    );
}
