import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '70vh',
                gap: 16,
                textAlign: 'center',
                padding: '0 24px',
            }}
        >
            <div
                style={{
                    fontSize: 120,
                    fontWeight: 800,
                    color: 'var(--color-text-faint, #4a4a6a)',
                    lineHeight: 1,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.04em',
                }}
            >
                404
            </div>

            <h1
                style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: 0,
                }}
            >
                Page not found
            </h1>
            <p
                style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '1rem',
                    maxWidth: 380,
                    lineHeight: 1.6,
                }}
            >
                The page you're looking for doesn't exist or has been moved.
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                    onClick={() => navigate(-1)}
                    className="btn btn--secondary"
                    aria-label="Go back"
                >
                    ← Go back
                </button>
                <button
                    onClick={() => navigate('/jobs')}
                    className="btn btn--primary"
                    aria-label="Go to Jobs"
                >
                    Go to Jobs
                </button>
            </div>
        </div>
    );
}
