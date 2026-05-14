import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Send,
    Linkedin,
    Star,
    Download,
    X,
    Plus,
    Bot,
    Zap,
    Calendar,
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { useTaskStream } from '@/hooks/useTaskStream';
import { useNotifications } from '@/contexts/NotificationContext';
import ScoreRing from '@/components/ScoreRing';
import { SkeletonCandidateSidebar } from '@/components/Skeleton';
import { NoMessages } from '@/components/EmptyState';
import type { Candidate, Message, ApiSuccess } from '@/types';

const AVATAR_COLORS = ['#7C3AED', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
function avatarColor(name: string) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const STATUS_COLORS: Record<string, string> = {
    new: '#8b8ba7',
    sourced: '#8b8ba7',
    scored: '#7C3AED',
    contacted: '#3b82f6',
    interested: '#10b981',
    responded: '#10b981',
    hired: '#10b981',
    scheduling: '#10b981',
    rejected: '#ef4444',
    not_interested: '#ef4444',
};
const SKILL_COLORS = ['#7C3AED', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
function skillColor(s: string) {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return SKILL_COLORS[Math.abs(h) % SKILL_COLORS.length];
}

const QUICK_REPLIES = [
    { label: 'Interested', text: "Yes, I'm interested! Let's schedule a call." },
    { label: 'Not Interested', text: "Thanks, but I'm not looking right now." },
    { label: 'Need More Info', text: 'Can you share more details about the role?' },
];

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
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

interface LocalResponse {
    id: string;
    content: string;
    createdAt: string;
    schedulingLink?: string | null;
}

export default function CandidateDetailsPage() {
    const { candidateId } = useParams();
    const queryClient = useQueryClient();
    const { showLoading, updateProgress, showSuccess, showError } = useToast();
    const { addNotification } = useNotifications();

    const [scoreTaskId, setScoreTaskId] = useState<string | null>(null);
    const [outreachTaskId, setOutreachTaskId] = useState<string | null>(null);
    const scoreToastId = useRef<string | null>(null);
    const outreachToastId = useRef<string | null>(null);

    const scoreStream = useTaskStream(scoreTaskId);
    const outreachStream = useTaskStream(outreachTaskId);

    const [starred, setStarred] = useState(false);
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [message, setMessage] = useState('');
    const [scoreProgress, setScoreProgress] = useState(0);
    const [outreachProgress, setOutreachProgress] = useState(0);
    const [localResponses, setLocalResponses] = useState<LocalResponse[]>([]);
    const [animateScore, setAnimateScore] = useState(true);

    const chatBottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { data, isLoading, refetch } = useQuery<{ candidate: Candidate; messages: Message[] }>({
        queryKey: ['candidate-details', candidateId],
        queryFn: async () => {
            const [candidateRes, messagesRes] = await Promise.all([
                api.get<ApiSuccess<Candidate>>(`/api/candidates/${candidateId}`),
                api.get<ApiSuccess<Message[]>>(`/api/candidates/${candidateId}/messages`),
            ]);
            return { candidate: candidateRes.data.data, messages: messagesRes.data.data };
        },
        enabled: !!candidateId,
    });

    useEffect(() => {
        const handler = () => refetch();
        window.addEventListener('recruit:stats-changed', handler);
        return () => window.removeEventListener('recruit:stats-changed', handler);
    }, [refetch]);

    const candidate = data?.candidate;
    const messages = data?.messages ?? [];

    const combinedMessages = useMemo(() => {
        return [...messages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
    }, [messages]);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [combinedMessages]);

    useEffect(() => {
        if (!inputRef.current) return;
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`;
    }, [message]);

    useEffect(() => {
        if (!candidateId) return;
        try {
            const stored = JSON.parse(localStorage.getItem('recruit-ai-starred') || '[]');
            setStarred(Array.isArray(stored) ? stored.includes(candidateId) : false);
        } catch {
            setStarred(false);
        }
        setNotes(localStorage.getItem(`recruit-ai-notes-${candidateId}`) || '');
        try {
            const storedTags = JSON.parse(
                localStorage.getItem(`recruit-ai-tags-${candidateId}`) || '[]',
            );
            setTags(Array.isArray(storedTags) ? storedTags : []);
        } catch {
            setTags([]);
        }
        try {
            const storedResponses = JSON.parse(
                localStorage.getItem(`recruit-ai-responses-${candidateId}`) || '[]',
            );
            setLocalResponses(Array.isArray(storedResponses) ? storedResponses : []);
        } catch {
            setLocalResponses([]);
        }
    }, [candidateId]);

    useEffect(() => {
        if (!candidate?.score || !candidateId) return;
        const key = `recruit-ai-score-${candidateId}`;
        const prev = localStorage.getItem(key);
        const scoreString = String(candidate.score.value ?? '');
        setAnimateScore(prev !== scoreString);
        localStorage.setItem(key, scoreString);
    }, [candidate?.score?.value, candidateId]);

    const refreshCandidate = async () => {
        if (!candidateId) return;
        const res = await api.get<ApiSuccess<Candidate>>(`/api/candidates/${candidateId}`);
        queryClient.setQueryData(['candidate-details', candidateId], (prev: any) =>
            prev
                ? { ...prev, candidate: res.data.data }
                : { candidate: res.data.data, messages: [] },
        );
    };

    const refreshMessages = async () => {
        if (!candidateId) return;
        const res = await api.get<ApiSuccess<Message[]>>(`/api/candidates/${candidateId}/messages`);
        queryClient.setQueryData(['candidate-details', candidateId], (prev: any) =>
            prev
                ? { ...prev, messages: res.data.data }
                : { candidate: null, messages: res.data.data },
        );
    };

    useEffect(() => {
        if (!scoreTaskId || !scoreStream.status) return;
        const id = scoreToastId.current;
        if (!id) return;
        setScoreProgress(scoreStream.progress);
        if (scoreStream.status === 'processing' || scoreStream.status === 'queued') {
            updateProgress(id, scoreStream.progress);
        }
        if (scoreStream.status === 'completed') {
            showSuccess(id, 'Scoring complete. AI match score ready.');
            refreshCandidate();
            addNotification(
                'scored',
                `${candidate?.name} was scored by AI`,
                `/candidates/${candidateId}`,
            );
            setScoreTaskId(null);
            setScoreProgress(0);
        }
        if (scoreStream.status === 'failed') {
            showError(id, scoreStream.error ?? 'Scoring failed. Try again.');
            setScoreTaskId(null);
            setScoreProgress(0);
        }
    }, [scoreStream.status, scoreStream.progress]);

    useEffect(() => {
        if (!outreachTaskId || !outreachStream.status) return;
        const id = outreachToastId.current;
        if (!id) return;
        setOutreachProgress(outreachStream.progress);
        if (outreachStream.status === 'processing' || outreachStream.status === 'queued') {
            updateProgress(id, outreachStream.progress);
        }
        if (outreachStream.status === 'completed') {
            showSuccess(id, 'Outreach message sent.');
            refreshCandidate();
            refreshMessages();
            addNotification(
                'outreach_sent',
                `Message sent to ${candidate?.name}`,
                `/candidates/${candidateId}`,
            );
            setOutreachTaskId(null);
            setOutreachProgress(0);
        }
        if (outreachStream.status === 'failed') {
            showError(id, outreachStream.error ?? 'Outreach failed. Try again.');
            setOutreachTaskId(null);
            setOutreachProgress(0);
        }
    }, [outreachStream.status, outreachStream.progress]);

    const scoreMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post<ApiSuccess<{ taskId: string }>>(
                `/api/candidates/${candidateId}/scores`,
            );
            return res.data.data;
        },
        onSuccess: (data) => {
            if (data?.taskId) {
                const id = `score-${candidateId}`;
                scoreToastId.current = id;
                showLoading(id, `Scoring ${candidate?.name ?? 'candidate'}...`);
                setScoreTaskId(data.taskId);
            }
        },
        onError: () => showError(`score-${candidateId}`, 'Failed to start scoring.'),
    });

    const outreachMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post<ApiSuccess<{ taskId: string }>>(
                `/api/candidates/${candidateId}/outreach`,
                { jobId: candidate?.jobId },
            );
            return res.data.data;
        },
        onSuccess: (data) => {
            if (data?.taskId) {
                const id = `outreach-${candidateId}`;
                outreachToastId.current = id;
                showLoading(id, `Writing outreach for ${candidate?.name ?? 'candidate'}...`);
                setOutreachTaskId(data.taskId);
            }
        },
        onError: () => showError(`outreach-${candidateId}`, 'Failed to start outreach.'),
    });

    const addLocalResponse = (msg: string) => {
        const entry: LocalResponse = {
            id: `local-${Date.now()}`,
            content: msg,
            createdAt: new Date().toISOString(),
        };
        setLocalResponses((prev) => {
            const updated = [...prev, entry];
            localStorage.setItem(`recruit-ai-responses-${candidateId}`, JSON.stringify(updated));
            return updated;
        });
    };

    const responseMutation = useMutation({
        mutationFn: async (msg: string) => {
            addLocalResponse(msg);
            const res = await api.post(`/api/candidates/${candidateId}/responses`, {
                message: msg,
            });
            return res.data.data;
        },
        onSuccess: (data) => {
            showSuccess(
                `intent-${candidateId}-${Date.now()}`,
                `Intent ${String(data.intent).replace('_', ' ').toUpperCase()} (${(data.confidence * 100).toFixed(1)}%)`,
            );
            setMessage('');
            if (data?.schedulingLink) {
                setLocalResponses((prev) => {
                    const updated = prev.map((item, idx) =>
                        idx === prev.length - 1
                            ? { ...item, schedulingLink: data.schedulingLink }
                            : item,
                    );
                    localStorage.setItem(
                        `recruit-ai-responses-${candidateId}`,
                        JSON.stringify(updated),
                    );
                    return updated;
                });
            }
            refreshCandidate();
            refreshMessages();
        },
        onError: () => showError(`intent-${candidateId}-${Date.now()}`, 'Classification failed.'),
    });

    const toggleStar = () => {
        const stored = (() => {
            try {
                return JSON.parse(localStorage.getItem('recruit-ai-starred') || '[]');
            } catch {
                return [];
            }
        })();
        const list = Array.isArray(stored) ? stored : [];
        const next = starred
            ? list.filter((id: string) => id !== candidateId)
            : [...list, candidateId];
        localStorage.setItem('recruit-ai-starred', JSON.stringify(next));
        setStarred(!starred);
    };

    const saveNotes = () => localStorage.setItem(`recruit-ai-notes-${candidateId}`, notes);

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !tags.includes(t)) {
            const updated = [...tags, t];
            setTags(updated);
            localStorage.setItem(`recruit-ai-tags-${candidateId}`, JSON.stringify(updated));
        }
        setTagInput('');
    };

    const removeTag = (t: string) => {
        const updated = tags.filter((x) => x !== t);
        setTags(updated);
        localStorage.setItem(`recruit-ai-tags-${candidateId}`, JSON.stringify(updated));
    };

    const exportChat = () => {
        if (!candidate) return;
        const text = combinedMessages
            .map(
                (m) =>
                    `[${formatTime(m.createdAt)}] ${m.direction === 'outbound' ? 'You (AI)' : candidate.name}: ${m.content}`,
            )
            .join('\n\n');
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
            download: `${candidate.name}-conversation.txt`,
        });
        a.click();
    };

    if (isLoading)
        return (
            <div style={{ display: 'flex', gap: 24, padding: '0 0 48px' }}>
                <div style={{ width: 320, flexShrink: 0 }}>
                    <SkeletonCandidateSidebar />
                </div>
                <div
                    style={{
                        flex: 1,
                        background: 'var(--color-glass)',
                        borderRadius: 16,
                        border: '1px solid var(--color-border)',
                        minHeight: 520,
                    }}
                />
            </div>
        );
    if (!candidate)
        return (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Candidate not found.
            </div>
        );

    const initials = candidate.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    const bg = avatarColor(candidate.name);
    const isScoring = !!scoreTaskId || scoreMutation.isPending;
    const isOutreaching = !!outreachTaskId || outreachMutation.isPending;
    const linkedInUrl = (candidate as any).linkedInUrl || candidate.linkedinUrl;

    return (
        <div className="animate-fade-in pb-12">
            <div style={{ marginBottom: 20 }}>
                <Link
                    to={`/jobs/${candidate.jobId}/candidates`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    <ArrowLeft size={15} /> Back to candidates
                </Link>
            </div>

            <div
                className="flex-col-mobile"
                style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
            >
                <aside
                    style={{
                        width: 320,
                        maxWidth: '100%',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                    }}
                >
                    <div
                        className="card"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '28px 24px',
                            gap: 12,
                            textAlign: 'center',
                        }}
                    >
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 28,
                                fontWeight: 800,
                                color: '#fff',
                                border: `3px solid ${bg}44`,
                            }}
                        >
                            {initials}
                        </div>

                        {candidate.score ? (
                            <ScoreRing
                                score={candidate.score.value}
                                size={120}
                                animate={animateScore}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: '50%',
                                    border: '2px dashed var(--color-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--color-text-muted)',
                                    fontSize: 12,
                                }}
                            >
                                Not scored yet
                            </div>
                        )}

                        <div>
                            <h1
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    margin: 0,
                                }}
                            >
                                {candidate.name}
                            </h1>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: 'var(--color-text-muted)',
                                    marginTop: 4,
                                }}
                            >
                                {candidate.headline}
                            </p>
                        </div>

                        {linkedInUrl && (
                            <a
                                href={linkedInUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 12,
                                    color: '#60a5fa',
                                    border: '1px solid rgba(96,165,250,0.25)',
                                    borderRadius: 24,
                                    padding: '4px 12px',
                                }}
                            >
                                <Linkedin size={13} /> LinkedIn Profile
                            </a>
                        )}

                        <span
                            style={{
                                padding: '4px 14px',
                                borderRadius: 24,
                                fontSize: 12,
                                fontWeight: 600,
                                background: `${STATUS_COLORS[candidate.status] ?? '#8b8ba7'}20`,
                                color: STATUS_COLORS[candidate.status] ?? '#8b8ba7',
                                textTransform: 'capitalize',
                            }}
                        >
                            {formatStatus(candidate.status)}
                        </span>

                        {candidate.skills.length > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                    justifyContent: 'center',
                                }}
                            >
                                {candidate.skills.slice(0, 8).map((s) => (
                                    <span
                                        key={s}
                                        style={{
                                            fontSize: 11,
                                            padding: '2px 9px',
                                            borderRadius: 24,
                                            background: `${skillColor(s)}18`,
                                            color: skillColor(s),
                                            border: `1px solid ${skillColor(s)}30`,
                                        }}
                                    >
                                        {s}
                                    </span>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={toggleStar}
                            aria-label={starred ? 'Unstar candidate' : 'Star candidate'}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: starred ? '#f59e0b' : 'var(--color-text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                            }}
                        >
                            <Star size={17} fill={starred ? '#f59e0b' : 'none'} />{' '}
                            {starred ? 'Starred' : 'Star candidate'}
                        </button>
                    </div>

                    <div
                        className="card"
                        style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}
                    >
                        {isScoring && scoreProgress > 0 && (
                            <div
                                style={{
                                    height: 3,
                                    borderRadius: 999,
                                    background: 'rgba(255,255,255,0.06)',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${scoreProgress}%`,
                                        background: '#7C3AED',
                                        borderRadius: 999,
                                        transition: 'width 0.35s',
                                    }}
                                />
                            </div>
                        )}
                        <button
                            className={`btn w-full justify-center ${candidate.score?.value ? 'btn--secondary' : 'btn--primary'}`}
                            onClick={() => scoreMutation.mutate()}
                            disabled={isScoring}
                            aria-label="Score this candidate with AI"
                        >
                            {isScoring ? (
                                <>
                                    <div className="spinner" /> Scoring...
                                </>
                            ) : candidate.score?.value ? (
                                <>
                                    <Zap size={15} /> Re-score
                                </>
                            ) : (
                                <>
                                    <Zap size={15} /> Score Candidate
                                </>
                            )}
                        </button>

                        {isOutreaching && outreachProgress > 0 && (
                            <div
                                style={{
                                    height: 3,
                                    borderRadius: 999,
                                    background: 'rgba(255,255,255,0.06)',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${outreachProgress}%`,
                                        background: '#7C3AED',
                                        borderRadius: 999,
                                        transition: 'width 0.35s',
                                    }}
                                />
                            </div>
                        )}
                        <button
                            className="btn btn--secondary w-full justify-center"
                            onClick={() => outreachMutation.mutate()}
                            disabled={isOutreaching}
                            aria-label="Send AI outreach to candidate"
                        >
                            {isOutreaching ? (
                                <>
                                    <div className="spinner" /> Sending...
                                </>
                            ) : (
                                <>
                                    <Bot size={15} /> Send Outreach
                                </>
                            )}
                        </button>
                    </div>

                    <div className="card" style={{ padding: 20 }}>
                        <label
                            className="label"
                            htmlFor="recruiter-notes"
                            style={{ marginBottom: 8, display: 'block' }}
                        >
                            Recruiter Notes
                        </label>
                        <textarea
                            id="recruiter-notes"
                            className="input"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={saveNotes}
                            placeholder="Add private notes about this candidate..."
                            rows={4}
                            style={{ resize: 'vertical', fontSize: 13 }}
                        />
                    </div>

                    <div className="card" style={{ padding: 20 }}>
                        <label className="label" style={{ marginBottom: 8, display: 'block' }}>
                            Custom Tags
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {tags.map((t) => (
                                <span
                                    key={t}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '3px 10px',
                                        borderRadius: 24,
                                        background: 'rgba(124,58,237,0.15)',
                                        border: '1px solid rgba(124,58,237,0.25)',
                                        fontSize: 12,
                                        color: '#a78bfa',
                                    }}
                                >
                                    {t}
                                    <button
                                        onClick={() => removeTag(t)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            display: 'flex',
                                            padding: 0,
                                        }}
                                        aria-label={`Remove tag ${t}`}
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input
                                className="input"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                                placeholder="Add tag, press Enter"
                                style={{ flex: 1, fontSize: 13 }}
                                aria-label="Tag input"
                            />
                            <button
                                onClick={addTag}
                                className="btn btn--secondary"
                                style={{ padding: '0 12px' }}
                                aria-label="Add tag"
                            >
                                <Plus size={15} />
                            </button>
                        </div>
                    </div>
                </aside>

                <div
                    className="card"
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 600,
                        padding: 0,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--color-border)',
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
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
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: 14,
                                    color: 'var(--color-text)',
                                }}
                            >
                                {candidate.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                Conversation
                            </div>
                        </div>

                        {/* SSE Reconnection UI */}
                        {(scoreTaskId || outreachTaskId) && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: '11px',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                <div
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background:
                                            scoreStream.connectionState === 'connected' ||
                                            outreachStream.connectionState === 'connected'
                                                ? '#10b981'
                                                : scoreStream.connectionState === 'reconnecting' ||
                                                    outreachStream.connectionState ===
                                                        'reconnecting'
                                                  ? '#f59e0b'
                                                  : '#ef4444',
                                        animation:
                                            scoreStream.connectionState === 'connected' ||
                                            outreachStream.connectionState === 'connected'
                                                ? 'pulse 2s infinite'
                                                : 'none',
                                    }}
                                />
                                {scoreStream.connectionState === 'reconnecting' ||
                                outreachStream.connectionState === 'reconnecting'
                                    ? 'Syncing...'
                                    : scoreStream.connectionState === 'connected' ||
                                        outreachStream.connectionState === 'connected'
                                      ? 'Live'
                                      : 'Offline'}
                            </div>
                        )}

                        <button
                            onClick={exportChat}
                            className="btn btn--secondary btn--sm"
                            aria-label="Export chat as text file"
                        >
                            <Download size={13} /> Export Chat
                        </button>
                    </div>

                    {(isScoring || isOutreaching) && (
                        <div style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${isScoring ? scoreProgress : outreachProgress}%`,
                                        background: '#7C3AED',
                                        transition: 'width 0.35s',
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    padding: '6px 20px',
                                    fontSize: 12,
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {isScoring ? 'Scoring candidate...' : 'Crafting message...'}
                            </div>
                        </div>
                    )}

                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                        }}
                    >
                        {combinedMessages.length === 0 ? (
                            <NoMessages />
                        ) : (
                            <>
                                {candidate.score && (
                                    <div
                                        style={{
                                            alignSelf: 'center',
                                            maxWidth: '80%',
                                            border: '1px solid rgba(124,58,237,0.4)',
                                            borderRadius: 16,
                                            padding: 12,
                                            background: 'rgba(124,58,237,0.08)',
                                            display: 'flex',
                                            gap: 12,
                                        }}
                                    >
                                        <ScoreRing
                                            score={candidate.score.value}
                                            size={48}
                                            strokeWidth={6}
                                            animate={animateScore}
                                        />
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 6,
                                                flex: 1,
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                                                AI Score Result
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: 'var(--color-text-muted)',
                                                    maxHeight: 80,
                                                    overflowY: 'auto',
                                                }}
                                            >
                                                {candidate.score.reasoning}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                Source: [
                                                {candidate.score.source === 'fallback'
                                                    ? 'Rule-based'
                                                    : 'AI'}
                                                ]
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {combinedMessages.map((msg) => (
                                    <div
                                        key={msg._id}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                                    >
                                        {msg.role === 'ai' ? (
                                            <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: 'var(--color-text-muted)',
                                                        textAlign: 'right',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    You (AI) - {formatTime(msg.createdAt)}
                                                </div>
                                                <div
                                                    style={{
                                                        background: '#7C3AED',
                                                        color: '#fff',
                                                        borderRadius: '16px 16px 4px 16px',
                                                        padding: '10px 14px',
                                                        fontSize: 13,
                                                        lineHeight: 1.55,
                                                        whiteSpace: 'pre-wrap',
                                                    }}
                                                >
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ) : msg.role === 'candidate' ? (
                                            <div
                                                style={{ alignSelf: 'flex-start', maxWidth: '80%' }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: 'var(--color-text-muted)',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    {candidate.name} - {formatTime(msg.createdAt)}
                                                </div>
                                                <div
                                                    style={{
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--color-border)',
                                                        color: 'var(--color-text)',
                                                        borderRadius: '16px 16px 16px 4px',
                                                        padding: '10px 14px',
                                                        fontSize: 13,
                                                        lineHeight: 1.55,
                                                        whiteSpace: 'pre-wrap',
                                                    }}
                                                >
                                                    {msg.content}
                                                </div>
                                                {msg.schedulingLink && (
                                                    <div
                                                        style={{
                                                            marginTop: 8,
                                                            border: '1px solid rgba(124,58,237,0.4)',
                                                            borderRadius: 12,
                                                            padding: 10,
                                                            background: 'rgba(124,58,237,0.08)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <Calendar
                                                            size={14}
                                                            style={{ color: '#a78bfa' }}
                                                        />
                                                        <a
                                                            href={msg.schedulingLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{
                                                                color: '#a78bfa',
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            Scheduling link
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    alignSelf: 'center',
                                                    maxWidth: '90%',
                                                    padding: '8px 16px',
                                                    borderRadius: '12px',
                                                    background: 'var(--sb-hover)',
                                                    border: '1px solid var(--sb-border)',
                                                    fontSize: '12px',
                                                    color: 'var(--color-text-muted)',
                                                    fontStyle: 'italic',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {msg.content}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                        <div ref={chatBottomRef} />
                    </div>

                    <div
                        style={{
                            padding: '12px 16px',
                            borderTop: '1px solid var(--color-border)',
                            background: 'rgba(255,255,255,0.01)',
                        }}
                    >
                        {candidate.status === 'contacted' && (
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    marginBottom: 12,
                                }}
                            >
                                {QUICK_REPLIES.map((qr) => (
                                    <button
                                        key={qr.label}
                                        onClick={() => responseMutation.mutate(qr.text)}
                                        disabled={isOutreaching || responseMutation.isPending}
                                        style={{
                                            fontSize: 12,
                                            padding: '6px 14px',
                                            borderRadius: 999,
                                            border: '1px solid var(--color-border)',
                                            background: 'rgba(255,255,255,0.03)',
                                            color: 'var(--color-text-muted)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                        aria-label={qr.label}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                                'rgba(255,255,255,0.06)';
                                            e.currentTarget.style.color = 'var(--color-text)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                                'rgba(255,255,255,0.03)';
                                            e.currentTarget.style.color = 'var(--color-text-muted)';
                                        }}
                                    >
                                        {qr.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {candidate.status === 'interested' && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: 'var(--color-success)',
                                    marginBottom: 10,
                                    padding: '4px 10px',
                                    background: 'rgba(16,185,129,0.05)',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <Check size={12} color="currentColor" /> Candidate expressed
                                interest — scheduling link sent
                            </div>
                        )}
                        {candidate.status === 'not_interested' && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: 'var(--color-warning)',
                                    marginBottom: 10,
                                    padding: '4px 10px',
                                    background: 'rgba(245,158,11,0.05)',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <X size={12} color="currentColor" /> Candidate is not interested
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <textarea
                                className="input"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                                        e.preventDefault();
                                        responseMutation.mutate(message);
                                    }
                                }}
                                placeholder="Type a response. Enter to send, Shift+Enter for newline"
                                rows={1}
                                disabled={isOutreaching || responseMutation.isPending}
                                style={{ flex: 1, resize: 'none', fontSize: 13 }}
                                ref={inputRef}
                                aria-label="Message input"
                            />
                            <button
                                className="btn btn--primary"
                                style={{ padding: '10px 14px', borderRadius: 12, flexShrink: 0 }}
                                onClick={() => message.trim() && responseMutation.mutate(message)}
                                disabled={
                                    responseMutation.isPending || !message.trim() || isOutreaching
                                }
                                aria-label="Send message"
                            >
                                {responseMutation.isPending ? (
                                    <div className="spinner" style={{ width: 16, height: 16 }} />
                                ) : (
                                    <Send size={16} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar Timeline */}
                <aside
                    style={{
                        width: 220,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                    }}
                >
                    <div className="card" style={{ padding: '20px' }}>
                        <h3
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <Calendar size={16} style={{ color: 'var(--sb-active-pill)' }} />
                            Pipeline Timeline
                        </h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 20,
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 7,
                                    top: 4,
                                    bottom: 4,
                                    width: 2,
                                    background: 'var(--color-border)',
                                }}
                            />

                            {[
                                { status: 'sourced', label: 'Sourced', date: candidate.createdAt },
                                { status: 'scored', label: 'Scored', date: candidate.scoredAt },
                                {
                                    status: 'contacted',
                                    label: 'Contacted',
                                    date: candidate.contactedAt,
                                },
                                {
                                    status: 'responded',
                                    label: 'Responded',
                                    date: candidate.respondedAt,
                                },
                                {
                                    status: 'interested',
                                    label: 'Interested',
                                    date:
                                        candidate.status === 'interested'
                                            ? candidate.updatedAt
                                            : null,
                                },
                                { status: 'hired', label: 'Hired', date: candidate.hiredAt },
                            ].map((step, idx, steps) => {
                                const isDone =
                                    !!step.date || steps.slice(idx + 1).some((s) => !!s.date);
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            gap: 16,
                                            alignItems: 'flex-start',
                                            position: 'relative',
                                            zIndex: 1,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                background: isDone
                                                    ? 'var(--accent)'
                                                    : 'var(--bg-card)',
                                                border: `2px solid ${isDone ? 'var(--accent)' : 'var(--color-border)'}`,
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {isDone && <Check size={10} color="#fff" />}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 2,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: isDone
                                                        ? 'var(--color-text)'
                                                        : 'var(--color-text-muted)',
                                                }}
                                            >
                                                {step.label}
                                            </span>
                                            {step.date && (
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: 'var(--color-text-muted)',
                                                    }}
                                                >
                                                    {new Date(step.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function Check({ size, color }: { size: number; color: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
