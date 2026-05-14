import { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
        <div
            className="min-h-screen flex items-center justify-center p-6 animate-fade-in app-shell auth-shell"
            style={{ backgroundColor: 'var(--color-bg)' }}
        >
            <div className="card card-glowing w-full max-w-md p-8 animate-slide-up section-panel auth-card">
                <div className="flex flex-col items-center mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white animated-float"
                        style={{
                            background:
                                'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                            boxShadow: 'var(--shadow-glow)',
                            width: '64px',
                            height: '64px',
                        }}
                    >
                        <LogIn size={32} />
                    </div>
                    <h1
                        className="text-2xl font-bold m-0 text-white"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        Recruit AI Platform
                    </h1>
                    <p className="text-muted text-sm mt-2">
                        Sign in to manage your automated pipelines
                    </p>
                </div>

                <div className="auth-toggle-shell mb-6">
                    <button
                        type="button"
                        className={`auth-toggle-tab ${isLogin ? 'is-active' : ''}`}
                        onClick={() => {
                            if (!isLogin) {
                                setIsLogin(true);
                                setError('');
                            }
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        className={`auth-toggle-tab ${!isLogin ? 'is-active' : ''}`}
                        onClick={() => {
                            if (isLogin) {
                                setIsLogin(false);
                                setError('');
                            }
                        }}
                    >
                        Sign Up
                    </button>
                </div>

                {error && (
                    <div
                        className="p-4 mb-6 rounded-md border text-sm animate-fade-in"
                        style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            borderColor: 'rgba(239, 68, 68, 0.4)',
                            color: '#fca5a5',
                        }}
                    >
                        {error}
                    </div>
                )}

                <form
                    key={isLogin ? 'login' : 'signup'}
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-5 animate-pop"
                >
                    {!isLogin && (
                        <div className="form-group">
                            <label className="label">Full Name</label>
                            <input
                                className="input"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="label">Work Email</label>
                        <input
                            className="input"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Password</label>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input
                                className="input"
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ paddingRight: 40 }}
                            />
                            <button
                                type="button"
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--color-text-muted)',
                                }}
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn--primary w-full justify-center mt-2 h-11 text-base font-semibold auth-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner" />
                        ) : isLogin ? (
                            'Sign In'
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-muted">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <button
                        type="button"
                        className="text-primary font-bold ml-1 auth-toggle-link"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: 'inherit',
                        }}
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
}
