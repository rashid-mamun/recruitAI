import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { downloadAnalyticsCsv, getAnalytics } from '@/services/api';

export default function AnalyticsPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['analytics'],
        queryFn: () => getAnalytics(),
    });
    if (isLoading)
        return (
            <div className="page-content">
                <div className="spinner spinner--lg" />
            </div>
        );
    if (error || !data)
        return (
            <div className="page-content">
                <div className="empty-state">Analytics could not be loaded.</div>
            </div>
        );
    const metrics = [
        ['Candidates', data.totals.candidates],
        ['Interviews', data.totals.interviews],
        ['Response rate', `${data.responseRate}%`],
        ['Interview completion', `${data.interviewCompletionRate}%`],
        ['Average score', data.averageScore],
        [
            'Time to shortlist',
            data.timeToShortlistHours === null
                ? '—'
                : data.timeToShortlistHours === 0
                  ? '<1h'
                  : `${data.timeToShortlistHours}h`,
        ],
    ];
    return (
        <div className="page-content analytics-page">
            <div
                className="page-header"
                style={{ display: 'flex', justifyContent: 'space-between' }}
            >
                <div>
                    <h1 className="page-title" style={{ fontSize: '2rem' }}>
                        Hiring analytics
                    </h1>
                    <p className="page-subtitle">
                        Workspace-wide funnel, quality, and velocity indicators.
                    </p>
                </div>
                <button className="btn btn--secondary" onClick={() => void downloadAnalyticsCsv()}>
                    <Download size={15} /> Export CSV
                </button>
            </div>
            <div className="analytics-metric-grid">
                {metrics.map(([label, value]) => (
                    <div className="card analytics-metric-card" key={label}>
                        <div className="text-muted analytics-metric-label">{label}</div>
                        <div className="analytics-metric-value">{value}</div>
                    </div>
                ))}
            </div>
            <div className="analytics-detail-grid">
                <div className="card" style={{ padding: 20 }}>
                    <h3>Hiring funnel</h3>
                    {Object.entries(data.funnel).map(([label, value]) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '8px 0',
                            }}
                        >
                            <span style={{ textTransform: 'capitalize' }}>
                                {label.replace('_', ' ')}
                            </span>
                            <div className="analytics-bar-row">
                                <span className="analytics-bar">
                                    <i
                                        style={{
                                            width: `${Math.min(100, (Number(value) / Math.max(1, data.totals.candidates)) * 100)}%`,
                                        }}
                                    />
                                </span>
                                <strong>{value}</strong>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <h3>Score distribution</h3>
                    {data.scoreDistribution.map((item) => (
                        <div
                            key={item.range}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '8px 0',
                            }}
                        >
                            <span>{item.range}</span>
                            <div className="analytics-bar-row">
                                <span className="analytics-bar">
                                    <i
                                        style={{
                                            width: `${Math.min(100, (item.count / Math.max(1, data.totals.candidates)) * 100)}%`,
                                        }}
                                    />
                                </span>
                                <strong>{item.count}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
