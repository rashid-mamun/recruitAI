import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { requestPasswordReset } from '@/services/auth';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [devToken, setDevToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setDevToken('');
        setLoading(true);
        try {
            const result = await requestPasswordReset(email);
            setMessage(result.message);
            if (result.resetToken) setDevToken(result.resetToken);
        } catch (err: any) {
            setError(err?.message || 'Password reset request failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-shell animate-fade-in">
            <section className="auth-card-v2 animate-slide-up" aria-label="Forgot password">
                <div className="auth-panel__header">
                    <p className="auth-kicker">Account recovery</p>
                    <h1>Reset password</h1>
                    <p>Enter your work email and we will send reset instructions.</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {message && <div className="auth-success">{message}</div>}

                <form onSubmit={submit} className="auth-form">
                    <div className="form-group">
                        <label className="label" htmlFor="reset-email">
                            Work email
                        </label>
                        <div className="auth-field">
                            <Mail size={17} />
                            <input
                                id="reset-email"
                                className="input"
                                type="email"
                                required
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>

                    <button className="btn btn--primary auth-submit-btn" disabled={loading}>
                        {loading ? <div className="spinner" /> : 'Send reset link'}
                    </button>
                </form>

                {devToken && (
                    <div className="auth-google-missing" style={{ wordBreak: 'break-all' }}>
                        Dev reset token: {devToken}
                    </div>
                )}

                <div className="auth-footer">
                    <Link className="auth-toggle-link" to="/login">
                        <ArrowLeft size={14} /> Back to sign in
                    </Link>
                </div>
            </section>
        </main>
    );
}
