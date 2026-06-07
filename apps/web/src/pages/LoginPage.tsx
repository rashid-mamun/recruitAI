import { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    BriefcaseBusiness,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    Sparkles,
    User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { login, register, loginWithGoogle } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

    useEffect(() => {
        if (!googleClientId || !googleButtonRef.current) return;

        let cancelled = false;

        const loadGoogleScript = () =>
            new Promise<void>((resolve, reject) => {
                if (window.google?.accounts?.id) {
                    resolve();
                    return;
                }

                const existing = document.querySelector<HTMLScriptElement>(
                    'script[src="https://accounts.google.com/gsi/client"]',
                );
                if (existing) {
                    existing.addEventListener('load', () => resolve(), { once: true });
                    existing.addEventListener('error', () => reject(), { once: true });
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => resolve();
                script.onerror = () => reject();
                document.head.appendChild(script);
            });

        loadGoogleScript()
            .then(() => {
                if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
                googleButtonRef.current.innerHTML = '';
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: async (response) => {
                        if (!response.credential) {
                            setError('Google sign-in did not return a credential');
                            return;
                        }

                        setError('');
                        setGoogleLoading(true);
                        try {
                            await loginWithGoogle(response.credential);
                        } catch (err: any) {
                            setError(
                                err?.message ||
                                    'Google sign-in failed. Please try again or use email and password.',
                            );
                        } finally {
                            setGoogleLoading(false);
                        }
                    },
                });
                window.google.accounts.id.renderButton(googleButtonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    type: 'standard',
                    shape: 'rectangular',
                    text: isLogin ? 'signin_with' : 'signup_with',
                    width: 320,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setError(
                        'Google sign-in is temporarily unavailable. Please use email and password.',
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [googleClientId, isLogin, loginWithGoogle]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(name, email, password);
            }
        } catch (err: any) {
            setError(err?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-shell animate-fade-in">
            <section
                className="auth-card-v2 animate-slide-up"
                aria-label="RecruitAI authentication"
            >
                <div className="auth-card-v2__mast">
                    <div className="auth-brand">
                        <span className="auth-brand-mark">
                            <BriefcaseBusiness size={22} />
                        </span>
                        <span>RecruitAI</span>
                    </div>

                    <div className="auth-hero__badge">
                        <Sparkles size={14} />
                        Hiring operations
                    </div>
                </div>

                <div className="auth-panel__header">
                    <p className="auth-kicker">{isLogin ? 'Welcome back' : 'Create workspace'}</p>
                    <h1>{isLogin ? 'Sign in to RecruitAI' : 'Start using RecruitAI'}</h1>
                    <p>
                        {isLogin
                            ? 'Access your recruiting command center.'
                            : 'Set up your recruiter account in a few seconds.'}
                    </p>
                </div>

                <div className="auth-toggle-shell" role="tablist" aria-label="Auth mode">
                    <button
                        type="button"
                        className={`auth-toggle-tab ${isLogin ? 'is-active' : ''}`}
                        aria-pressed={isLogin}
                        onClick={() => {
                            if (!isLogin) {
                                setIsLogin(true);
                                setError('');
                            }
                        }}
                    >
                        Sign in
                    </button>
                    <button
                        type="button"
                        className={`auth-toggle-tab ${!isLogin ? 'is-active' : ''}`}
                        aria-pressed={!isLogin}
                        onClick={() => {
                            if (isLogin) {
                                setIsLogin(false);
                                setError('');
                            }
                        }}
                    >
                        Sign up
                    </button>
                </div>

                <div className="auth-google-area">
                    {googleClientId ? (
                        <>
                            <div
                                ref={googleButtonRef}
                                className={
                                    googleLoading
                                        ? 'auth-google-button is-loading'
                                        : 'auth-google-button'
                                }
                            />
                            {googleLoading && <div className="auth-google-mask">Signing in...</div>}
                        </>
                    ) : (
                        <div className="auth-google-missing">
                            Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Google sign-in.
                        </div>
                    )}
                </div>

                <div className="auth-divider">
                    <span>or continue with email</span>
                </div>

                {error && (
                    <div className="auth-error animate-fade-in" role="alert">
                        {error}
                    </div>
                )}

                <form
                    key={isLogin ? 'login' : 'signup'}
                    onSubmit={handleSubmit}
                    className="auth-form animate-pop"
                >
                    {!isLogin && (
                        <div className="form-group">
                            <label className="label" htmlFor="auth-name">
                                Full name
                            </label>
                            <div className="auth-field">
                                <User size={17} />
                                <input
                                    id="auth-name"
                                    className="input"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Jane Recruiter"
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="label" htmlFor="auth-email">
                            Work email
                        </label>
                        <div className="auth-field">
                            <Mail size={17} />
                            <input
                                id="auth-email"
                                className="input"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label" htmlFor="auth-password">
                            Password
                        </label>
                        <div className="auth-field auth-field--password">
                            <LockKeyhole size={17} />
                            <input
                                id="auth-password"
                                className="input"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? 'Hide password' : 'Show password'}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn--primary auth-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner" />
                        ) : isLogin ? (
                            <>
                                Sign in
                                <ArrowRight size={18} />
                            </>
                        ) : (
                            <>
                                Create account
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <button
                        type="button"
                        className="auth-toggle-link"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </div>
            </section>
        </main>
    );
}
