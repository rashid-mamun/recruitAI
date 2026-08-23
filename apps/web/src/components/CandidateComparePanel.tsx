import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CheckSquare, Sparkles } from 'lucide-react';
import {
    compareCandidates,
    createHiringDecision,
    evaluateCandidate,
    getHiringDecisions,
    getJobEvaluations,
    overrideEvaluationScore,
} from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { Candidate, CandidateComparison, HiringDecision } from '@/types';

export default function CandidateComparePanel({
    jobId,
    candidates,
    selectedIds,
}: {
    jobId: string;
    candidates: Candidate[];
    selectedIds: string[];
}) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [decisionCandidateId, setDecisionCandidateId] = useState('');
    const [decision, setDecision] = useState<HiringDecision['decision']>('shortlist');
    const [decisionReason, setDecisionReason] = useState('');
    const [overrideEvaluationId, setOverrideEvaluationId] = useState('');
    const [overrideCompetencyId, setOverrideCompetencyId] = useState('');
    const [overrideScore, setOverrideScore] = useState(70);
    const [overrideReason, setOverrideReason] = useState('');

    const { data: decisions = [] } = useQuery({
        queryKey: ['hiring-decisions', jobId],
        queryFn: () => getHiringDecisions(jobId),
    });

    const { data: evaluations = [] } = useQuery({
        queryKey: ['job-evaluations', jobId],
        queryFn: () => getJobEvaluations(jobId),
        enabled: !!jobId,
        staleTime: 15_000,
    });

    const compareQuery = useQuery<CandidateComparison>({
        queryKey: ['candidate-compare', jobId, selectedIds.join(',')],
        queryFn: () => compareCandidates(jobId, selectedIds),
        enabled: selectedIds.length >= 2,
    });

    const evaluateMutation = useMutation({
        mutationFn: async () => {
            const targetIds = selectedIds.length > 0 ? selectedIds : candidates.map((c) => c._id);
            for (const candidateId of targetIds) {
                await evaluateCandidate(jobId, candidateId);
            }
            return targetIds.length;
        },
        onSuccess: (count) => {
            showSuccess(
                `evaluate-${jobId}`,
                `Evaluated ${count} candidate${count === 1 ? '' : 's'}.`,
            );
            queryClient.invalidateQueries({ queryKey: ['job-evaluations', jobId] });
            queryClient.invalidateQueries({ queryKey: ['candidate-compare', jobId] });
        },
        onError: (error: Error) => showError(`evaluate-${jobId}`, error.message),
    });

    const evaluationMap = new Map(
        evaluations.map((evaluation) => [evaluation.candidateId, evaluation]),
    );

    const decisionMutation = useMutation({
        mutationFn: () =>
            createHiringDecision(jobId, {
                candidateId: decisionCandidateId,
                decision,
                reason: decisionReason,
            }),
        onSuccess: () => {
            showSuccess(`decision-${jobId}`, 'Hiring decision saved.');
            setDecisionReason('');
            queryClient.invalidateQueries({ queryKey: ['hiring-decisions', jobId] });
            queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
        },
        onError: (error: Error) => showError(`decision-${jobId}`, error.message),
    });
    const selectedEvaluation = evaluations.find((item) => item._id === overrideEvaluationId);
    const overrideMutation = useMutation({
        mutationFn: () =>
            overrideEvaluationScore(overrideEvaluationId, {
                competencyId: overrideCompetencyId,
                score: overrideScore,
                reason: overrideReason,
            }),
        onSuccess: () => {
            showSuccess(`override-${jobId}`, 'Human score override saved and audited.');
            setOverrideReason('');
            queryClient.invalidateQueries({ queryKey: ['job-evaluations', jobId] });
            queryClient.invalidateQueries({ queryKey: ['candidate-compare', jobId] });
        },
        onError: (error: Error) => showError(`override-${jobId}`, error.message),
    });

    return (
        <div className="card section-panel" style={{ marginBottom: 16 }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={17} />
                        <h3 className="font-bold text-lg m-0">Evaluation & Compare</h3>
                    </div>
                    <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                        Select two or more candidates to compare on the same scorecard.
                    </p>
                </div>
                <button
                    className="btn btn--primary btn--sm"
                    disabled={evaluateMutation.isPending || candidates.length === 0}
                    onClick={() => evaluateMutation.mutate()}
                >
                    {evaluateMutation.isPending ? (
                        <div className="spinner" />
                    ) : (
                        <Sparkles size={14} />
                    )}
                    {selectedIds.length > 0 ? 'Evaluate selected' : 'Evaluate all'}
                </button>
            </div>

            {evaluations.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginTop: 14,
                    }}
                >
                    {candidates
                        .filter((candidate) => evaluationMap.has(candidate._id))
                        .slice(0, 8)
                        .map((candidate) => {
                            const evaluation = evaluationMap.get(candidate._id)!;
                            return (
                                <div
                                    key={candidate._id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 8,
                                        padding: '6px 9px',
                                        fontSize: 12,
                                    }}
                                >
                                    <CheckSquare size={13} color="#10b981" />
                                    {candidate.name}: <strong>{evaluation.overallScore}</strong>
                                </div>
                            );
                        })}
                </div>
            )}

            {selectedIds.length >= 2 && compareQuery.data && (
                <div style={{ marginTop: 16, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                <th style={cellStyle}>Competency</th>
                                {compareQuery.data.candidates.map(({ candidate }) => (
                                    <th key={candidate._id} style={cellStyle}>
                                        {candidate.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={cellStyle}>Overall</td>
                                {compareQuery.data.candidates.map(({ candidate, evaluation }) => (
                                    <td key={candidate._id} style={cellStyle}>
                                        <strong>{evaluation.overallScore}</strong> ·{' '}
                                        {evaluation.recommendation.replace('_', ' ')}
                                    </td>
                                ))}
                            </tr>
                            {compareQuery.data.scorecard.competencies.map((competency) => (
                                <tr key={competency.id}>
                                    <td style={cellStyle}>{competency.name}</td>
                                    {compareQuery.data!.candidates.map(
                                        ({ candidate, evaluation }) => {
                                            const score = evaluation.competencyScores.find(
                                                (item) => item.competencyId === competency.id,
                                            );
                                            return (
                                                <td key={candidate._id} style={cellStyle}>
                                                    {score ? score.score : '-'}
                                                </td>
                                            );
                                        },
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div
                style={{
                    marginTop: 18,
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 16,
                }}
            >
                <h4 style={{ margin: '0 0 10px' }}>Final decision</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 2fr auto', gap: 8 }}>
                    <select
                        className="input"
                        value={decisionCandidateId}
                        onChange={(event) => setDecisionCandidateId(event.target.value)}
                    >
                        <option value="">Select candidate</option>
                        {candidates.map((candidate) => (
                            <option key={candidate._id} value={candidate._id}>
                                {candidate.name}
                            </option>
                        ))}
                    </select>
                    <select
                        className="input"
                        value={decision}
                        onChange={(event) =>
                            setDecision(event.target.value as HiringDecision['decision'])
                        }
                    >
                        {['shortlist', 'hold', 'reject', 'offer', 'hired'].map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <input
                        className="input"
                        value={decisionReason}
                        onChange={(event) => setDecisionReason(event.target.value)}
                        placeholder="Evidence-based reason"
                    />
                    <button
                        className="btn btn--primary"
                        disabled={
                            !decisionCandidateId ||
                            decisionReason.trim().length < 3 ||
                            decisionMutation.isPending
                        }
                        onClick={() => decisionMutation.mutate()}
                    >
                        Save
                    </button>
                </div>
                {decisions.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        {decisions.slice(0, 5).map((item) => (
                            <div
                                key={item._id}
                                className="text-sm text-muted"
                                style={{ padding: '4px 0' }}
                            >
                                {candidates.find((candidate) => candidate._id === item.candidateId)
                                    ?.name ?? 'Candidate'}{' '}
                                · {item.decision} — {item.reason}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div
                style={{
                    marginTop: 18,
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 16,
                }}
            >
                <h4 style={{ margin: '0 0 10px' }}>Human score override</h4>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 90px 2fr auto',
                        gap: 8,
                    }}
                >
                    <select
                        className="input"
                        value={overrideEvaluationId}
                        onChange={(event) => {
                            setOverrideEvaluationId(event.target.value);
                            setOverrideCompetencyId('');
                        }}
                    >
                        <option value="">Select candidate</option>
                        {evaluations.map((evaluation) => (
                            <option key={evaluation._id} value={evaluation._id}>
                                {candidates.find(
                                    (candidate) => candidate._id === evaluation.candidateId,
                                )?.name ?? 'Candidate'}
                            </option>
                        ))}
                    </select>
                    <select
                        className="input"
                        value={overrideCompetencyId}
                        onChange={(event) => setOverrideCompetencyId(event.target.value)}
                    >
                        <option value="">Competency</option>
                        {selectedEvaluation?.competencyScores.map((item) => (
                            <option key={item.competencyId} value={item.competencyId}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                    <input
                        className="input"
                        type="number"
                        min={0}
                        max={100}
                        value={overrideScore}
                        onChange={(event) => setOverrideScore(Number(event.target.value))}
                    />
                    <input
                        className="input"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        placeholder="Required override reason"
                    />
                    <button
                        className="btn btn--primary"
                        disabled={
                            !overrideEvaluationId ||
                            !overrideCompetencyId ||
                            overrideReason.trim().length < 3 ||
                            overrideMutation.isPending
                        }
                        onClick={() => overrideMutation.mutate()}
                    >
                        Override
                    </button>
                </div>
            </div>
        </div>
    );
}

const cellStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--color-border)',
    padding: '9px 8px',
    textAlign: 'left',
    verticalAlign: 'top',
};
