import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ApiSuccess, QueueStats as QueueStatsType } from '@/types';

interface Props {
    compact?: boolean;
}

export default function QueueStats({ compact }: Props) {
    const { data, isLoading } = useQuery<QueueStatsType[]>({
        queryKey: ['queue-stats'],
        queryFn: async () => {
            const res = await api.get<ApiSuccess<QueueStatsType[]>>('/api/queue-stats');
            return res.data.data;
        },
        refetchInterval: 10_000, // Poll every 10s
        staleTime: 5_000,
    });

    const totalActive = data?.reduce((sum, q) => sum + q.active, 0) ?? 0;
    const totalWaiting = data?.reduce((sum, q) => sum + q.waiting, 0) ?? 0;
    const totalFailed = data?.reduce((sum, q) => sum + q.failed, 0) ?? 0;

    if (compact) {
        return (
            <div
                style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                }}
            >
                <div
                    style={{
                        fontSize: '0.70rem',
                        color: 'var(--color-text-faint)',
                        marginBottom: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                    }}
                >
                    Queue Health
                </div>
                {isLoading ? (
                    <div
                        className="animate-pulse"
                        style={{
                            height: 20,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 4,
                        }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <DotStat label="Active" value={totalActive} color="var(--color-success)" />
                        <DotStat
                            label="Waiting"
                            value={totalWaiting}
                            color="var(--color-warning)"
                        />
                        <DotStat
                            label="Failed"
                            value={totalFailed}
                            color="var(--color-danger)"
                            pulse={totalFailed > 0}
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="stat-card animate-pulse" style={{ height: 70 }} />
                  ))
                : data?.map((queue) => (
                      <div key={queue.name} className="stat-card">
                          <div
                              style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--color-text-muted)',
                                  textTransform: 'capitalize',
                                  marginBottom: 6,
                              }}
                          >
                              {queue.name}
                          </div>
                          <div style={{ display: 'flex', gap: 12 }}>
                              <Stat
                                  label="Active"
                                  value={queue.active}
                                  color="var(--color-warning)"
                              />
                              <Stat label="Wait" value={queue.waiting} color="var(--color-info)" />
                              <Stat
                                  label="Done"
                                  value={queue.completed}
                                  color="var(--color-success)"
                              />
                          </div>
                      </div>
                  ))}
        </div>
    );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                {label}
            </div>
        </div>
    );
}

function DotStat({
    label,
    value,
    color,
    pulse = false,
}: {
    label: string;
    value: number;
    color: string;
    pulse?: boolean;
}) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--color-text-muted)',
            }}
        >
            <span
                className={pulse ? 'animate-pulse' : ''}
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: value > 0 ? color : 'transparent',
                    border: `1px solid ${value > 0 ? color : 'var(--color-border)'}`,
                    display: 'inline-block',
                }}
            />
            <span style={{ flex: 1 }}>{label}</span>
            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{value}</span>
        </div>
    );
}
