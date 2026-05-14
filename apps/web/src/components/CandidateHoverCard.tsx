import { useEffect, useRef, useState } from 'react';
import ScoreRing from '@/components/ScoreRing';
import type { Candidate } from '@/types';

interface CandidateHoverCardProps {
    candidate: Candidate;
    children: React.ReactNode;
}

const AVATAR_COLORS = ['#7C3AED', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function avatarColor(name: string) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatStatus(status: string) {
    const map: Record<string, string> = {
        sourced: 'new',
        new: 'new',
        scored: 'scored',
        contacted: 'contacted',
        responded: 'interested',
        interested: 'interested',
        scheduling: 'hired',
        hired: 'hired',
        rejected: 'not interested',
        not_interested: 'not interested',
    };
    return map[status] || status;
}

export default function CandidateHoverCard({ candidate, children }: CandidateHoverCardProps) {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleEnter = (event: React.MouseEvent) => {
        const { clientX, clientY } = event;
        setPos({ x: clientX + 16, y: clientY + 8 });
        timeoutRef.current = setTimeout(() => setVisible(true), 400);
    };

    const handleMove = (event: React.MouseEvent) => {
        if (!visible) return;
        setPos({ x: event.clientX + 16, y: event.clientY + 8 });
    };

    const handleLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setVisible(false);
    };

    const initials = candidate.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const bg = avatarColor(candidate.name);
    const skills = candidate.skills?.slice(0, 3) ?? [];

    return (
        <span
            onMouseEnter={handleEnter}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
            {children}
            {visible && (
                <div
                    style={{
                        position: 'fixed',
                        left: pos.x,
                        top: pos.y,
                        width: 220,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 12,
                        zIndex: 9999,
                        boxShadow: '0 0 0 1px var(--border)',
                    }}
                >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: bg,
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            {initials}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                }}
                            >
                                {candidate.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {candidate.headline || candidate.location}
                            </div>
                        </div>
                        {candidate.score?.value != null && (
                            <ScoreRing score={candidate.score.value} size={42} strokeWidth={5} />
                        )}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {skills.length ? (
                            skills.map((skill) => (
                                <span
                                    key={skill}
                                    style={{
                                        padding: '2px 8px',
                                        borderRadius: 24,
                                        fontSize: 10,
                                        background: 'rgba(124,58,237,0.12)',
                                        color: '#a78bfa',
                                        border: '1px solid rgba(124,58,237,0.24)',
                                    }}
                                >
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                No skills listed
                            </span>
                        )}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                        Status:{' '}
                        <span style={{ color: 'var(--color-text)' }}>
                            {formatStatus(candidate.status)}
                        </span>
                    </div>
                </div>
            )}
        </span>
    );
}
