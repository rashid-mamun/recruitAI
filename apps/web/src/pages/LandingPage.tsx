import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
    ArrowRight,
    BarChart3,
    FileText,
    MessageSquare,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const heroImage =
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1800&q=80';

export default function LandingPage() {
    const { isAuthenticated } = useAuth();

    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <section
                style={{
                    minHeight: '88vh',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundImage: `linear-gradient(90deg, rgba(7,10,22,0.86), rgba(7,10,22,0.58), rgba(7,10,22,0.22)), url(${heroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: '32px min(6vw, 72px)',
                }}
            >
                <div style={{ maxWidth: 760 }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            border: '1px solid rgba(255,255,255,0.24)',
                            borderRadius: 999,
                            padding: '6px 12px',
                            color: '#dbeafe',
                            fontSize: 13,
                            marginBottom: 18,
                        }}
                    >
                        <Sparkles size={14} />
                        <span>Free-first AI recruiting intelligence</span>
                    </div>
                    <h1
                        style={{
                            fontSize: 64,
                            lineHeight: 0.96,
                            margin: 0,
                            color: '#fff',
                            letterSpacing: 0,
                        }}
                    >
                        RecruitAI
                    </h1>
                    <p
                        style={{
                            maxWidth: 660,
                            color: 'rgba(255,255,255,0.82)',
                            fontSize: 18,
                            lineHeight: 1.6,
                            margin: '22px 0 28px',
                        }}
                    >
                        Capture interviews, analyze evidence, score candidates on structured
                        scorecards, compare finalists, and generate leadership-ready reports.
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Link className="btn btn--primary" to="/contact">
                            Request Demo <ArrowRight size={16} />
                        </Link>
                        <Link
                            className="btn btn--secondary"
                            to={isAuthenticated ? '/jobs' : '/login'}
                            style={{
                                color: '#fff',
                                borderColor: 'rgba(255,255,255,0.38)',
                                background: 'rgba(255,255,255,0.12)',
                                backdropFilter: 'blur(10px)',
                            }}
                        >
                            {isAuthenticated ? 'Open Dashboard' : 'Sign In'}
                        </Link>
                    </div>
                </div>
            </section>

            <section style={{ padding: '56px min(6vw, 72px)' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 14,
                    }}
                >
                    <Feature icon={<FileText size={20} />} title="Interview Intelligence">
                        Upload transcripts, parse speaker turns, and produce structured interview
                        analysis with free-first AI fallback.
                    </Feature>
                    <Feature icon={<BarChart3 size={20} />} title="Structured Evaluation">
                        Evaluate every candidate on the same weighted scorecard and compare
                        finalists side by side.
                    </Feature>
                    <Feature icon={<MessageSquare size={20} />} title="Team Review">
                        Add comments, open reviews, capture decisions, and preserve audit trails.
                    </Feature>
                    <Feature icon={<ShieldCheck size={20} />} title="Production Foundation">
                        Queues, tests, audit logs, rate limits, docs, and deployment-ready services.
                    </Feature>
                </div>
            </section>
            <footer
                style={{
                    padding: '24px min(6vw, 72px)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                }}
            >
                <span>RecruitAI</span>
                <div style={{ display: 'flex', gap: 14 }}>
                    <Link to="/privacy" style={{ color: 'inherit' }}>
                        Privacy
                    </Link>
                    <Link to="/terms" style={{ color: 'inherit' }}>
                        Terms
                    </Link>
                </div>
            </footer>
        </main>
    );
}

function Feature({
    icon,
    title,
    children,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <article
            className="card"
            style={{
                padding: 20,
                minHeight: 170,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
            }}
        >
            <div style={{ color: 'var(--color-primary)' }}>{icon}</div>
            <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
            <p
                style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    margin: 0,
                }}
            >
                {children}
            </p>
        </article>
    );
}
