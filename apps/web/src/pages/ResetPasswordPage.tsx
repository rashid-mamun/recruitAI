import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { confirmPasswordReset } from '@/services/auth';

export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = useMemo(() => params.get('token') || '', [params]);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setLoading(true);
        try {
            await confirmPasswordReset(token, password);
            navigate('/login');
        } catch (err: any) {
            setError(err?.message || 'Password reset failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-shell animate-fade-in">
            <section className="auth-card-v2 animate-slide-up" aria-label="Set new password">
                <div className="auth-panel__header">
                    <p className="auth-kicker">Account recovery</p>
                    <h1>Set new password</h1>
                    <p>Choose a new password for your RecruitAI account.</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {!token && <div className="auth-error">Reset token is missing.</div>}

                <form onSubmit={submit} className="auth-form">
                    <div className="form-group">
                        <label className="label" htmlFor="new-password">
                            New password
                        </label>
                        <div className="auth-field">
                            <LockKeyhole size={17} />
                            <input
                                id="new-password"
                                className="input"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="New password"
                            />
                        </div>
                    </div>

                    <button
                        className="btn btn--primary auth-submit-btn"
                        disabled={loading || !token}
                    >
                        {loading ? <div className="spinner" /> : 'Update password'}
                    </button>
                </form>

                <div className="auth-footer">
                    <Link className="auth-toggle-link" to="/login">
                        <ArrowLeft size={14} /> Back to sign in
                    </Link>
                </div>
            </section>
        </main>
    );
}
