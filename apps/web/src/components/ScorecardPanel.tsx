import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X } from 'lucide-react';
import {
    applyScorecardTemplate,
    getJobScorecard,
    getScorecardTemplates,
    saveJobScorecard,
} from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { ScorecardCompetency } from '@/types';

export default function ScorecardPanel({ jobId }: { jobId: string }) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [name, setName] = useState('Role Scorecard');
    const [passingScore, setPassingScore] = useState(70);
    const [competencies, setCompetencies] = useState<ScorecardCompetency[]>([]);
    const [templateId, setTemplateId] = useState('');
    const { data: templates = [] } = useQuery({
        queryKey: ['scorecard-templates'],
        queryFn: getScorecardTemplates,
    });

    const { data: scorecard, isLoading } = useQuery({
        queryKey: ['job-scorecard', jobId],
        queryFn: () => getJobScorecard(jobId),
        enabled: !!jobId,
    });

    useEffect(() => {
        if (!scorecard) return;
        setName(scorecard.name);
        setPassingScore(scorecard.passingScore);
        setCompetencies(scorecard.competencies);
    }, [scorecard]);

    const saveMutation = useMutation({
        mutationFn: () => saveJobScorecard(jobId, { name, passingScore, competencies }),
        onSuccess: () => {
            showSuccess(`scorecard-${jobId}`, 'Scorecard saved.');
            queryClient.invalidateQueries({ queryKey: ['job-scorecard', jobId] });
        },
        onError: (error: Error) => showError(`scorecard-${jobId}`, error.message),
    });
    const applyMutation = useMutation({
        mutationFn: () => applyScorecardTemplate(jobId, templateId),
        onSuccess: (value) => {
            setName(value.name);
            setPassingScore(value.passingScore);
            setCompetencies(value.competencies);
            showSuccess(`scorecard-template-${jobId}`, 'Template applied to job.');
            queryClient.invalidateQueries({ queryKey: ['job-scorecard', jobId] });
        },
        onError: (error: Error) => showError(`scorecard-template-${jobId}`, error.message),
    });

    const addCompetency = () => {
        setCompetencies((prev) => [
            ...prev,
            {
                id: `competency-${Date.now()}`,
                name: 'New competency',
                description: '',
                weight: 10,
            },
        ]);
    };

    const updateCompetency = (index: number, patch: Partial<ScorecardCompetency>) => {
        setCompetencies((prev) =>
            prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
        );
    };

    const removeCompetency = (index: number) => {
        setCompetencies((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    };

    return (
        <div className="card section-panel">
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 14,
                }}
            >
                <div>
                    <h3 className="font-bold text-lg m-0">Structured Scorecard</h3>
                    <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                        Standardize candidate evaluation before compare and decision review.
                    </p>
                </div>
                <button
                    className="btn btn--primary btn--sm"
                    disabled={saveMutation.isPending || competencies.length === 0}
                    onClick={() => saveMutation.mutate()}
                >
                    {saveMutation.isPending ? <div className="spinner" /> : <Save size={14} />}
                    Save
                </button>
            </div>

            {isLoading ? (
                <div className="text-muted text-sm">Loading scorecard...</div>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <select
                            className="input"
                            value={templateId}
                            onChange={(event) => setTemplateId(event.target.value)}
                        >
                            <option value="">Choose reusable template</option>
                            {templates.map((template) => (
                                <option value={template._id} key={template._id}>
                                    {template.roleFamily} · {template.name}
                                </option>
                            ))}
                        </select>
                        <button
                            className="btn btn--secondary btn--sm"
                            disabled={!templateId || applyMutation.isPending}
                            onClick={() => applyMutation.mutate()}
                        >
                            Apply
                        </button>
                    </div>
                    <div
                        className="scorecard-meta-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) 140px',
                            gap: 10,
                        }}
                    >
                        <label>
                            <div className="label">Name</div>
                            <input
                                className="input"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>
                        <label>
                            <div className="label">Passing Score</div>
                            <input
                                className="input"
                                type="number"
                                min={0}
                                max={100}
                                value={passingScore}
                                onChange={(event) => setPassingScore(Number(event.target.value))}
                            />
                        </label>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                        {competencies.map((competency, index) => (
                            <div
                                key={`${competency.id}-${index}`}
                                className="scorecard-competency-row"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        'minmax(150px, 1fr) minmax(180px, 1.3fr) 86px 36px',
                                    gap: 8,
                                    alignItems: 'center',
                                }}
                            >
                                <input
                                    className="input"
                                    value={competency.name}
                                    onChange={(event) =>
                                        updateCompetency(index, {
                                            name: event.target.value,
                                            id: competency.id || event.target.value,
                                        })
                                    }
                                    aria-label="Competency name"
                                />
                                <input
                                    className="input"
                                    value={competency.description}
                                    onChange={(event) =>
                                        updateCompetency(index, { description: event.target.value })
                                    }
                                    placeholder="Evidence to look for"
                                    aria-label="Competency description"
                                />
                                <input
                                    className="input"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={competency.weight}
                                    onChange={(event) =>
                                        updateCompetency(index, {
                                            weight: Number(event.target.value),
                                        })
                                    }
                                    aria-label="Competency weight"
                                />
                                <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => removeCompetency(index)}
                                    aria-label="Remove competency"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button className="btn btn--secondary btn--sm" onClick={addCompetency}>
                        <Plus size={14} /> Add competency
                    </button>
                </div>
            )}
        </div>
    );
}
