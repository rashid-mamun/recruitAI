import { useEffect, useRef, useState } from 'react';

interface ScoreRingProps {
    score: number; // 0–100
    size?: number; // px, default 120
    strokeWidth?: number; // default 8
    animate?: boolean; // animate on mount, default true
}

function scoreColor(score: number): string {
    if (score >= 71) return '#10b981'; // green
    if (score >= 41) return '#f59e0b'; // amber
    return '#ef4444'; // red
}

export default function ScoreRing({
    score,
    size = 120,
    strokeWidth = 8,
    animate = true,
}: ScoreRingProps) {
    const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
    const [dashOffset, setDashOffset] = useState<number>(0);
    const rafRef = useRef<number>(0);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    useEffect(() => {
        if (!animate) {
            setDisplayScore(score);
            setDashOffset(circumference * (1 - score / 100));
            return;
        }

        // Reset
        setDisplayScore(0);
        setDashOffset(circumference);

        const duration = 1200;
        const start = performance.now();

        const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * score);
            setDisplayScore(current);
            setDashOffset(circumference * (1 - (eased * score) / 100));
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [score, animate, circumference]);

    const color = scoreColor(score);
    const fontSize = size < 80 ? size * 0.22 : size * 0.18;

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                />
                {/* Animated progress */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: animate ? 'none' : 'stroke-dashoffset 0.35s ease' }}
                />
            </svg>
            {/* Center label */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <span
                    style={{
                        fontSize,
                        fontWeight: 700,
                        color,
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {displayScore}
                </span>
                {size >= 80 && (
                    <span
                        style={{
                            fontSize: fontSize * 0.55,
                            color: 'var(--color-text-muted)',
                            marginTop: 2,
                        }}
                    >
                        /100
                    </span>
                )}
            </div>
        </div>
    );
}
