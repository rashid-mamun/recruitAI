import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Plus, Search, Sparkles } from 'lucide-react';
import { createInterview, getCandidates, getInterviews, getJobs } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { Candidate, Interview, Job } from '@/types';

const STATUS_COLORS: Record<string, string> = {
    draft: '#8b8ba7',
    scheduled: '#3b82f6',
    completed: '#f59e0b',
    analyzing: '#7C3AED',
    analysis_ready: '#10b981',
    reviewed: '#10b981',
    cancelled: '#ef4444',
};

export default function InterviewsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [jobId, setJobId] = useState('');
    const [candidateId, setCandidateId] = useState('');
    const [title, setTitle] = useState('Technical Interview');
    const [type, setType] = useState<Interview['type']>('technical');
    const [transcriptText, setTranscriptText] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);

    const { data: interviewsData, isLoading } = useQuery({
        queryKey: ['interviews'],
        queryFn: () => getInterviews({ limit: 50 }),
        staleTime: 15_000,
    });

    const { data: jobs = [] } = useQuery<Job[]>({
        queryKey: ['jobs'],
        queryFn: () => getJobs(),
        staleTime: 30_000,
    });

    const { data: candidatesData } = useQuery({
        queryKey: ['candidates-for-interviews'],
        queryFn: () => getCandidates({ limit: 100, sort: '-updatedAt' }),
        staleTime: 30_000,
    });

    const candidates = candidatesData?.data ?? [];
    const interviews = interviewsData?.data ?? [];

    const jobMap = useMemo(() => new Map(jobs.map((job) => [job._id, job.title])), [jobs]);
    const candidateMap = useMemo(
        () => new Map(candidates.map((candidate) => [candidate._id, candidate.name])),
        [candidates],
    );

    const visible = interviews.filter((interview) => {
        const haystack = [
            interview.title,
            candidateMap.get(interview.candidateId),
            jobMap.get(interview.jobId),
            interview.status,
        ]
            .join(' ')
            .toLowerCase();
        return haystack.includes(search.toLowerCase());
    });

    const createMutation = useMutation({
        mutationFn: () =>
            createInterview({
                jobId,
                candidateId,
                title,
                type,
                round: 'Round 1',
                status: transcriptText.trim() ? 'completed' : scheduledAt ? 'scheduled' : 'draft',
                scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
                durationMinutes,
                transcriptText: transcriptText.trim() || undefined,
            }),
        onSuccess: (interview) => {
            showSuccess(`interview-${interview._id}`, 'Interview created.');
            queryClient.invalidateQueries({ queryKey: ['interviews'] });
            setShowCreate(false);
            navigate(`/interviews/${interview._id}`);
        },
        onError: (error: Error) => showError(`interview-${Date.now()}`, error.message),
    });

    const canCreate = !!jobId && !!candidateId && title.trim().length > 1;

    return (
        <div className="animate-fade-in pb-12">
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '2rem' }}>
                        Interviews
                    </h1>
                    <p className="page-subtitle">
                        Capture transcripts, run free-first AI analysis, and review evidence.
                    </p>
                </div>
                <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Interview
                </button>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 18,
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 14,
                }}
            >
                <div style={{ position: 'relative', flex: 1 }}>
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
                        placeholder="Search interviews..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            </div>

            {showCreate && (
                <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 12,
                        }}
                    >
                        <label>
                            <div className="label">Job</div>
                            <select
                                className="input"
                                value={jobId}
                                onChange={(event) => {
                                    setJobId(event.target.value);
                                    setCandidateId('');
                                }}
                            >
                                <option value="">Select job</option>
                                {jobs.map((job) => (
                                    <option key={job._id} value={job._id}>
                                        {job.title}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <div className="label">Candidate</div>
                            <select
                                className="input"
                                value={candidateId}
                                onChange={(event) => setCandidateId(event.target.value)}
                            >
                                <option value="">Select candidate</option>
                                {candidates
                                    .filter((candidate: Candidate) =>
                                        jobId ? candidate.jobId === jobId : true,
                                    )
                                    .map((candidate: Candidate) => (
                                        <option key={candidate._id} value={candidate._id}>
                                            {candidate.name}
                                        </option>
                                    ))}
                            </select>
                        </label>

                        <label>
                            <div className="label">Title</div>
                            <input
                                className="input"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                            />
                        </label>

                        <label>
                            <div className="label">Type</div>
                            <select
                                className="input"
                                value={type}
                                onChange={(event) =>
                                    setType(event.target.value as Interview['type'])
                                }
                            >
                                <option value="screening">Screening</option>
                                <option value="technical">Technical</option>
                                <option value="behavioral">Behavioral</option>
                                <option value="system_design">System Design</option>
                                <option value="final">Final</option>
                            </select>
                        </label>

                        <label>
                            <div className="label">Schedule (optional)</div>
                            <input
                                className="input"
                                type="datetime-local"
                                value={scheduledAt}
                                min={new Date().toISOString().slice(0, 16)}
                                onChange={(event) => setScheduledAt(event.target.value)}
                                aria-label="Interview schedule"
                            />
                        </label>

                        <label>
                            <div className="label">Duration (minutes)</div>
                            <input
                                className="input"
                                type="number"
                                min={15}
                                max={600}
                                step={15}
                                value={durationMinutes}
                                onChange={(event) =>
                                    setDurationMinutes(
                                        Math.min(
                                            600,
                                            Math.max(15, Number(event.target.value) || 60),
                                        ),
                                    )
                                }
                                aria-label="Interview duration"
                            />
                        </label>
                    </div>

                    <label style={{ display: 'block', marginTop: 12 }}>
                        <div className="label">Transcript or notes</div>
                        <textarea
                            className="input"
                            rows={6}
                            value={transcriptText}
                            onChange={(event) => setTranscriptText(event.target.value)}
                            placeholder="Interviewer: Tell me about a complex project&#10;Candidate: I led..."
                            style={{ resize: 'vertical' }}
                        />
                    </label>

                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                            marginTop: 14,
                        }}
                    >
                        <button className="btn btn--secondary" onClick={() => setShowCreate(false)}>
                            Cancel
                        </button>
                        <button
                            className="btn btn--primary"
                            disabled={!canCreate || createMutation.isPending}
                            onClick={() => createMutation.mutate()}
                        >
                            {createMutation.isPending ? (
                                <div className="spinner" />
                            ) : (
                                <Plus size={15} />
                            )}
                            Create
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gap: 12 }}>
                {isLoading ? (
                    <div className="card" style={{ padding: 24, color: 'var(--color-text-muted)' }}>
                        Loading interviews...
                    </div>
                ) : visible.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                        <FileText size={28} color="var(--color-text-muted)" />
                        <div style={{ marginTop: 10, fontWeight: 700 }}>No interviews yet</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                            Create an interview and add a transcript to start analysis.
                        </div>
                    </div>
                ) : (
                    visible.map((interview) => (
                        <Link
                            key={interview._id}
                            to={`/interviews/${interview._id}`}
                            className="card"
                            style={{
                                padding: 18,
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: 12,
                                textDecoration: 'none',
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <h2
                                        style={{
                                            fontSize: 16,
                                            margin: 0,
                                            color: 'var(--color-text)',
                                        }}
                                    >
                                        {interview.title}
                                    </h2>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: STATUS_COLORS[interview.status],
                                            background: `${STATUS_COLORS[interview.status]}18`,
                                            border: `1px solid ${STATUS_COLORS[interview.status]}30`,
                                            borderRadius: 999,
                                            padding: '2px 10px',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {interview.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        color: 'var(--color-text-muted)',
                                        fontSize: 13,
                                        marginTop: 6,
                                    }}
                                >
                                    {candidateMap.get(interview.candidateId) ?? 'Candidate'} for{' '}
                                    {jobMap.get(interview.jobId) ?? 'Job'} · {interview.round}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {interview.status === 'analysis_ready' ? (
                                    <Sparkles size={18} color="#10b981" />
                                ) : (
                                    <CalendarDays size={18} color="var(--color-text-muted)" />
                                )}
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
