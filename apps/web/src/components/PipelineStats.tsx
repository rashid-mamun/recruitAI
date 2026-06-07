import { JobStats } from '@/types';

interface PipelineStatsProps {
    stats: JobStats | undefined;
}

export default function PipelineStats({ stats }: PipelineStatsProps) {
    if (!stats) return null;

    const calculateRate = (num: any, den: any) => {
        const n = Number(num);
        const d = Number(den);
        if (isNaN(n) || isNaN(d) || d === 0) return null;
        return Math.round((n / d) * 100);
    };

    const getRateColor = (rate: number | null) => {
        if (rate === null) return '#4a4a6a';
        if (rate === 0) return '#ef4444';
        if (rate >= 50) return '#10b981';
        return '#f59e0b';
    };

    const stages = [
        { label: 'SOURCED → SCORED', rate: calculateRate(stats.scored, stats.sourced) },
        { label: 'SCORED → CONTACTED', rate: calculateRate(stats.contacted, stats.scored) },
        { label: 'CONTACTED → INTERESTED', rate: calculateRate(stats.interested, stats.contacted) },
        { label: 'INTERESTED → HIRED', rate: calculateRate(stats.hired, stats.interested) },
    ];

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginTop: '16px',
            }}
        >
            {stages.map((stage, idx) => (
                <div
                    key={idx}
                    className="conv-cell"
                    style={{
                        padding: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <span
                        className="conv-label"
                        style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        {stage.label}
                    </span>
                    <span
                        className="conv-value"
                        style={{
                            fontSize: '20px',
                            fontWeight: 800,
                            color: getRateColor(stage.rate),
                        }}
                    >
                        {stage.rate === null ? '—' : `${stage.rate}%`}
                    </span>
                </div>
            ))}
        </div>
    );
}
