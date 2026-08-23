import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Bot,
    CheckCircle2,
    FileText,
    Save,
    Sparkles,
    TriangleAlert,
    CalendarPlus,
    Upload,
} from 'lucide-react';
import {
    analyzeInterview,
    getCandidate,
    getInterview,
    getJob,
    updateInterviewTranscript,
    updateInterview,
    sendInterviewInvite,
    uploadInterviewAudio,
    downloadFileAsset,
} from '@/services/api';
import { useTaskStream } from '@/hooks/useTaskStream';
import { useToast } from '@/contexts/ToastContext';
import type { InterviewAnalysis } from '@/types';

const recommendationLabel: Record<InterviewAnalysis['recommendation'], string> = {
    strong_yes: 'Strong yes',
    yes: 'Yes',
    maybe: 'Maybe',
    no: 'No',
};

export default function InterviewDetailsPage() {
    const { interviewId } = useParams();
    const queryClient = useQueryClient();
    const { showLoading, updateProgress, showSuccess, showError } = useToast();
    const [transcript, setTranscript] = useState('');
    const [analysisTaskId, setAnalysisTaskId] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [scheduleValue, setScheduleValue] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const stream = useTaskStream(analysisTaskId);

    const { data, isLoading } = useQuery({
        queryKey: ['interview-details', interviewId],
        queryFn: () => getInterview(interviewId as string),
        enabled: !!interviewId,
    });

    const interview = data?.interview;
    const analysis = data?.analysis;
    const analysisAny = analysis as any;
    const segments = data?.transcriptSegments ?? [];
    const recommendation =
        analysis?.recommendation && recommendationLabel[analysis.recommendation]
            ? recommendationLabel[analysis.recommendation]
            : 'Review needed';
    const confidence =
        typeof analysis?.confidence === 'number'
            ? analysis.confidence
            : typeof analysisAny?.overallScore === 'number'
              ? analysisAny.overallScore / 100
              : 0;
    const executiveSummary = analysis?.executiveSummary ?? analysisAny?.summary ?? '';
    const technicalSignals =
        analysis?.technicalSignals ??
        analysisAny?.competencies
            ?.filter((competency: any) =>
                /technical|system|engineering|depth/i.test(competency.name),
            )
            .map(
                (competency: any) =>
                    `${competency.name}: ${competency.evidence?.[0] ?? competency.score}`,
            ) ??
        [];
    const behavioralSignals = analysis?.behavioralSignals ?? analysisAny?.strengths ?? [];
    const communicationSignals = analysis?.communicationSignals ?? analysisAny?.questions ?? [];
    const riskFlags: string[] = analysis?.riskFlags ?? analysisAny?.risks ?? [];
    const evidence = analysis?.evidence ?? [];

    const { data: candidate } = useQuery({
        queryKey: ['candidate', interview?.candidateId],
        queryFn: () => getCandidate(interview!.candidateId),
        enabled: !!interview?.candidateId,
    });

    const { data: job } = useQuery({
        queryKey: ['job', interview?.jobId],
        queryFn: () => getJob(interview!.jobId),
        enabled: !!interview?.jobId,
    });

    useEffect(() => {
        if (interview?.transcriptText !== undefined) {
            setTranscript(interview.transcriptText || '');
        }
    }, [interview?.transcriptText]);

    useEffect(() => {
        if (!interview) return;
        setScheduleValue(
            interview.scheduledAt ? new Date(interview.scheduledAt).toISOString().slice(0, 16) : '',
        );
        setDurationMinutes(interview.durationMinutes || 60);
    }, [interview?._id, interview?.scheduledAt, interview?.durationMinutes]);

    useEffect(() => {
        if (!interview?.audioFileId) {
            setAudioUrl(null);
            return;
        }
        let active = true;
        void downloadFileAsset(interview.audioFileId).then((blob) => {
            if (!active) return;
            setAudioUrl(URL.createObjectURL(blob));
        });
        return () => {
            active = false;
            setAudioUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return null;
            });
        };
    }, [interview?.audioFileId]);

    useEffect(() => {
        if (!analysisTaskId || !stream.status) return;
        const toastId = `analysis-${analysisTaskId}`;

        if (stream.status === 'processing' || stream.status === 'queued') {
            updateProgress(toastId, stream.progress);
        }

        if (stream.status === 'completed') {
            showSuccess(toastId, 'Interview analysis ready.');
            queryClient.invalidateQueries({ queryKey: ['interview-details', interviewId] });
            queryClient.invalidateQueries({ queryKey: ['interviews'] });
            setAnalysisTaskId(null);
        }

        if (stream.status === 'failed') {
            showError(toastId, stream.error ?? 'Interview analysis failed.');
            setAnalysisTaskId(null);
        }
    }, [stream.status, stream.progress]);

    const transcriptMutation = useMutation({
        mutationFn: () => updateInterviewTranscript(interviewId as string, transcript),
        onSuccess: () => {
            showSuccess(`transcript-${interviewId}`, 'Transcript saved.');
            queryClient.invalidateQueries({ queryKey: ['interview-details', interviewId] });
        },
        onError: (error: Error) => showError(`transcript-${interviewId}`, error.message),
    });

    const analyzeMutation = useMutation({
        mutationFn: () => analyzeInterview(interviewId as string),
        onSuccess: (result) => {
            const toastId = `analysis-${result.taskId}`;
            showLoading(toastId, 'Analyzing interview with free-first AI flow...');
            setAnalysisTaskId(result.taskId);
            queryClient.invalidateQueries({ queryKey: ['interview-details', interviewId] });
        },
        onError: (error: Error) => showError(`analysis-${interviewId}`, error.message),
    });

    const inviteMutation = useMutation({
        mutationFn: () => sendInterviewInvite(interviewId as string),
        onSuccess: (result) => {
            showSuccess(`invite-${interviewId}`, 'Calendar invitation sent.');
            queryClient.invalidateQueries({ queryKey: ['interview-details', interviewId] });
            window.open(result.calendarEventUrl, '_blank', 'noopener,noreferrer');
        },
        onError: (error: Error) => showError(`invite-${interviewId}`, error.message),
    });

    const audioMutation = useMutation({
        mutationFn: (file: File) => uploadInterviewAudio(interviewId as string, file),
        onSuccess: () => {
            showSuccess(`audio-${interviewId}`, 'Interview audio uploaded.');
            queryClient.invalidateQueries({ queryKey: ['interview-details', interviewId] });
        },
        onError: (error: Error) => showError(`audio-${interviewId}`, error.message),
    });

    const scheduleMutation = useMutation({
        mutationFn: () =>
            updateInterview(
                interviewId as string,
                {
                    scheduledAt: scheduleValue ? new Date(scheduleValue).toISOString() : null,
                    durationMinutes,
                    status:
                        scheduleValue && interview?.status === 'draft'
                            ? 'scheduled'
                            : interview?.status,
                } as any,
            ),
        onSuccess: () => {
            showSuccess(`schedule-${interviewId}`, 'Interview schedule saved.');
            queryClient.invalidateQueries({ queryKey: ['interview-details', interviewId] });
            queryClient.invalidateQueries({ queryKey: ['interviews'] });
        },
        onError: (error: Error) => showError(`schedule-${interviewId}`, error.message),
    });

    if (isLoading || !interview) {
        return (
            <div className="card" style={{ padding: 32, color: 'var(--color-text-muted)' }}>
                Loading interview...
            </div>
        );
    }

    const isAnalyzing =
        analyzeMutation.isPending || !!analysisTaskId || interview.status === 'analyzing';

    return (
        <div className="animate-fade-in pb-12">
            <div style={{ marginBottom: 20 }}>
                <Link
                    to="/interviews"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    <ArrowLeft size={15} /> Back to interviews
                </Link>
            </div>

            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '2rem' }}>
                        {interview.title}
                    </h1>
                    <p className="page-subtitle">
                        {candidate?.name ?? 'Candidate'} · {job?.title ?? 'Job'} ·{' '}
                        {interview.status.replace('_', ' ')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn--secondary"
                        disabled={!interview.scheduledAt || inviteMutation.isPending}
                        onClick={() => inviteMutation.mutate()}
                    >
                        <CalendarPlus size={16} /> Send invite
                    </button>
                    <button
                        className="btn btn--primary"
                        disabled={isAnalyzing || !transcript.trim()}
                        onClick={() => analyzeMutation.mutate()}
                    >
                        {isAnalyzing ? <div className="spinner" /> : <Sparkles size={16} />}
                        {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                    </button>
                </div>
            </div>

            <div
                className="flex-col-mobile"
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18 }}
            >
                <section className="card" style={{ padding: 20 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={17} />
                            <h2 style={{ fontSize: 16, margin: 0 }}>Transcript</h2>
                        </div>
                        <button
                            className="btn btn--secondary btn--sm"
                            disabled={transcriptMutation.isPending || !transcript.trim()}
                            onClick={() => transcriptMutation.mutate()}
                        >
                            {transcriptMutation.isPending ? (
                                <div className="spinner" />
                            ) : (
                                <Save size={14} />
                            )}
                            Save
                        </button>
                    </div>

                    <textarea
                        className="input"
                        rows={18}
                        value={transcript}
                        onChange={(event) => setTranscript(event.target.value)}
                        placeholder="Interviewer: Walk me through a project you owned.&#10;Candidate: I built..."
                        style={{ resize: 'vertical', lineHeight: 1.55 }}
                    />

                    {segments.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div className="label" style={{ marginBottom: 8 }}>
                                Parsed segments
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {segments.slice(0, 6).map((segment) => (
                                    <div
                                        key={segment._id}
                                        style={{
                                            padding: 10,
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 8,
                                            fontSize: 13,
                                        }}
                                    >
                                        <strong>{segment.speaker}</strong>: {segment.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                    <section className="card" style={{ padding: 20 }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <strong>Recording</strong>
                            <label
                                className="btn btn--secondary btn--sm"
                                style={{ cursor: 'pointer' }}
                            >
                                <Upload size={14} /> Upload audio
                                <input
                                    type="file"
                                    accept="audio/*"
                                    hidden
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) audioMutation.mutate(file);
                                        event.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                        {audioMutation.isPending && (
                            <div className="text-sm text-muted" style={{ marginTop: 10 }}>
                                Uploading and scanning…
                            </div>
                        )}
                        {audioUrl && (
                            <audio
                                controls
                                src={audioUrl}
                                style={{ width: '100%', marginTop: 12 }}
                            />
                        )}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr) 90px',
                                gap: 8,
                                marginTop: 16,
                            }}
                        >
                            <input
                                className="input"
                                type="datetime-local"
                                value={scheduleValue}
                                onChange={(event) => setScheduleValue(event.target.value)}
                                aria-label="Interview schedule"
                            />
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
                        </div>
                        <button
                            className="btn btn--secondary btn--sm"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                            disabled={!scheduleValue || scheduleMutation.isPending}
                            onClick={() => scheduleMutation.mutate()}
                        >
                            {scheduleMutation.isPending ? (
                                <div className="spinner" />
                            ) : (
                                <Save size={13} />
                            )}
                            Save schedule
                        </button>
                    </section>
                    <section className="card" style={{ padding: 20 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 10,
                            }}
                        >
                            <Bot size={17} />
                            <h2 style={{ fontSize: 16, margin: 0 }}>Analysis</h2>
                        </div>

                        {!analysis ? (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                                Add transcript text, then run analysis. The backend uses Groq/Gemini
                                free-tier keys when available and falls back locally without paid
                                API cost.
                            </div>
                        ) : analysis.status === 'failed' ? (
                            <div style={{ color: '#ef4444', fontSize: 13 }}>
                                {analysis.error ?? 'Analysis failed.'}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 14 }}>
                                <div
                                    style={{
                                        padding: 12,
                                        borderRadius: 8,
                                        background: 'rgba(16,185,129,0.09)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CheckCircle2 size={16} color="#10b981" />
                                        <strong>{recommendation}</strong>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: 'var(--color-text-muted)',
                                            marginTop: 4,
                                        }}
                                    >
                                        Confidence {(confidence * 100).toFixed(0)}% ·{' '}
                                        {analysis.source === 'ai'
                                            ? analysis.aiModel
                                            : 'local fallback'}
                                    </div>
                                </div>

                                <p
                                    style={{
                                        fontSize: 13,
                                        color: 'var(--color-text-muted)',
                                        margin: 0,
                                    }}
                                >
                                    {executiveSummary}
                                </p>

                                <SignalList title="Technical" items={technicalSignals} />
                                <SignalList title="Behavioral" items={behavioralSignals} />
                                <SignalList title="Communication" items={communicationSignals} />

                                {riskFlags.length > 0 && (
                                    <div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontWeight: 700,
                                                fontSize: 13,
                                                marginBottom: 6,
                                            }}
                                        >
                                            <TriangleAlert size={14} color="#f59e0b" /> Risks
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                                            {riskFlags.map((risk) => (
                                                <li key={risk}>{risk}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {evidence.length ? (
                        <section className="card" style={{ padding: 20 }}>
                            <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Evidence</h2>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {evidence.map((item, index) => (
                                    <div
                                        key={`${item.label}-${index}`}
                                        style={{
                                            borderLeft: '3px solid #7C3AED',
                                            paddingLeft: 10,
                                            fontSize: 13,
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{item.label}</div>
                                        <div style={{ color: 'var(--color-text-muted)' }}>
                                            "{item.quote}"
                                        </div>
                                        {item.speaker && (
                                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                                {item.speaker}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </aside>
            </div>
        </div>
    );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null;
    return (
        <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}
