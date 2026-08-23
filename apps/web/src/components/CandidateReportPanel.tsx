import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Sparkles } from 'lucide-react';
import { downloadReportPdf, generateCandidateReport, getCandidateReports } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

export default function CandidateReportPanel({ candidateId }: { candidateId: string }) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['candidate-reports', candidateId],
        queryFn: () => getCandidateReports(candidateId),
        enabled: !!candidateId,
        staleTime: 20_000,
    });

    const latest = reports[0];

    const generateMutation = useMutation({
        mutationFn: () => generateCandidateReport(candidateId),
        onSuccess: () => {
            showSuccess(`report-${candidateId}`, 'Candidate report generated.');
            queryClient.invalidateQueries({ queryKey: ['candidate-reports', candidateId] });
        },
        onError: (error: Error) => showError(`report-${candidateId}`, error.message),
    });

    return (
        <div className="card" style={{ padding: 20 }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 12,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} />
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Candidate Report</div>
                </div>
                <button
                    className="btn btn--secondary btn--sm"
                    disabled={generateMutation.isPending}
                    onClick={() => generateMutation.mutate()}
                >
                    {generateMutation.isPending ? (
                        <div className="spinner" />
                    ) : (
                        <Sparkles size={13} />
                    )}
                    Generate
                </button>
            </div>

            {isLoading ? (
                <div className="text-sm text-muted">Loading reports...</div>
            ) : !latest ? (
                <div className="text-sm text-muted">
                    Generate a leadership-ready report from the current evaluation and interview
                    evidence.
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    <div
                        style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            padding: 10,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <strong style={{ fontSize: 13 }}>{latest.overallScore}/100</strong>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {latest.recommendation.replace('_', ' ')}
                            </span>
                        </div>
                        <p
                            style={{
                                margin: '8px 0 0',
                                color: 'var(--color-text-muted)',
                                fontSize: 12,
                                lineHeight: 1.45,
                                maxHeight: 120,
                                overflow: 'auto',
                            }}
                        >
                            {latest.executiveSummary}
                        </p>
                    </div>

                    <button
                        className="btn btn--primary btn--sm"
                        onClick={() => void downloadReportPdf(latest._id)}
                        style={{ justifyContent: 'center' }}
                    >
                        <Download size={13} /> Download PDF
                    </button>
                </div>
            )}
        </div>
    );
}
