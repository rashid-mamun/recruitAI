interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    radius?: number | string;
    style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            style={{
                width,
                height,
                borderRadius: radius,
                background:
                    'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.5s infinite',
                flexShrink: 0,
                ...style,
            }}
        />
    );
}

export function SkeletonJobCard() {
    return (
        <div
            className="card section-panel"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Skeleton width={52} height={52} radius={12} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton width="65%" height={18} />
                    <Skeleton width="45%" height={11} />
                </div>
                <Skeleton width={72} height={26} radius={999} />
            </div>
            <Skeleton width="100%" height={12} />
            <Skeleton width="82%" height={12} />
            <Skeleton width="60%" height={12} />
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 12,
                    borderTop: '1px solid var(--color-border)',
                }}
            >
                <Skeleton width={100} height={14} />
                <Skeleton width={88} height={32} radius={999} />
            </div>
        </div>
    );
}

export function SkeletonCandidateRow() {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 20px',
                borderBottom: '1px solid var(--color-border)',
            }}
        >
            <Skeleton width={44} height={44} radius={999} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Skeleton width="38%" height={14} />
                <Skeleton width="62%" height={11} />
            </div>
            <Skeleton width={90} height={26} radius={999} />
            <Skeleton width={80} height={26} radius={999} />
            <Skeleton width={70} height={32} radius={8} />
        </div>
    );
}

export function SkeletonCandidateSidebar() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
            <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
            >
                <Skeleton width={80} height={80} radius={999} />
                <Skeleton width={120} height={18} />
                <Skeleton width={180} height={13} />
            </div>
            <Skeleton width="100%" height={4} radius={999} />
            {[1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height={40} radius={10} />
            ))}
            <Skeleton width="100%" height={80} radius={10} />
        </div>
    );
}
