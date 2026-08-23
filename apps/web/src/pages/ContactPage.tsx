import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, BriefcaseBusiness, CheckCircle2, Sparkles } from 'lucide-react';
import { submitContactRequest, submitDemoRequest } from '@/services/api';

type FormMode = 'demo' | 'contact';

export default function ContactPage() {
    const [mode, setMode] = useState<FormMode>('demo');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');
    const nameInputRef = useRef<HTMLInputElement | null>(null);

    const canSubmit = name.trim().length >= 2 && email.includes('@') && message.trim().length >= 10;

    const selectMode = (nextMode: FormMode) => {
        setMode(nextMode);
        setStatus('idle');
        setError('');
        requestAnimationFrame(() => {
            nameInputRef.current?.focus();
            nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    };

    const submit = async () => {
        if (!canSubmit) return;
        setStatus('submitting');
        setError('');
        try {
            const payload = {
                name,
                email,
                company,
                role,
                message,
                sourcePage: '/contact',
            };
            if (mode === 'demo') {
                await submitDemoRequest(payload);
            } else {
                await submitContactRequest(payload);
            }
            setStatus('success');
            setMessage('');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Submission failed.');
        }
    };

    return (
        <main className="contact-page">
            <div className="contact-page__glow contact-page__glow--one" />
            <div className="contact-page__glow contact-page__glow--two" />
            <header className="contact-nav">
                <Link to="/" className="contact-brand">
                    <span>
                        <BriefcaseBusiness size={19} />
                    </span>
                    RecruitAI
                </Link>
                <Link to="/" className="contact-back">
                    <ArrowLeft size={15} /> Back to home
                </Link>
            </header>

            <div className="contact-layout">
                <section className="contact-intro">
                    <div className="contact-eyebrow">
                        <Sparkles size={14} /> Hiring intelligence, built around your team
                    </div>
                    <h1>Let’s improve how your team hires.</h1>
                    <p>
                        Share your hiring workflow and we will help map RecruitAI to sourcing,
                        interview analysis, structured evaluation, reports, and review governance.
                    </p>
                    <div className="contact-benefits">
                        <div>
                            <CheckCircle2 size={17} /> See the complete recruiter workflow
                        </div>
                        <div>
                            <CheckCircle2 size={17} /> Discuss integrations and data security
                        </div>
                        <div>
                            <CheckCircle2 size={17} /> Get a rollout plan for your hiring team
                        </div>
                    </div>
                </section>

                <section className="contact-form-card">
                    <div className="contact-form-head">
                        <div>
                            <span>
                                {mode === 'demo' ? 'Book a walkthrough' : 'Contact our team'}
                            </span>
                            <h2>
                                {mode === 'demo' ? 'See RecruitAI in action' : 'How can we help?'}
                            </h2>
                            <p>
                                {mode === 'demo'
                                    ? 'Tell us about your team and we’ll arrange a tailored product walkthrough.'
                                    : 'Send your question and our team will reply by email.'}
                            </p>
                        </div>
                        <div className="contact-mode" role="tablist" aria-label="Request type">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'demo'}
                                className={mode === 'demo' ? 'is-active' : ''}
                                onClick={() => selectMode('demo')}
                            >
                                Demo
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'contact'}
                                className={mode === 'contact' ? 'is-active' : ''}
                                onClick={() => selectMode('contact')}
                            >
                                Contact
                            </button>
                        </div>
                    </div>
                    <div className="contact-form-grid">
                        <label>
                            <div className="label">
                                Name <b>*</b>
                            </div>
                            <input
                                ref={nameInputRef}
                                className="input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your full name"
                                autoComplete="name"
                            />
                        </label>
                        <label>
                            <div className="label">
                                Work email <b>*</b>
                            </div>
                            <input
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                type="email"
                                placeholder="you@company.com"
                                autoComplete="email"
                            />
                        </label>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 12,
                            }}
                        >
                            <label>
                                <div className="label">Company</div>
                                <input
                                    className="input"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    placeholder="Company name"
                                />
                            </label>
                            <label>
                                <div className="label">Role</div>
                                <input
                                    className="input"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    placeholder="Your role"
                                />
                            </label>
                        </div>
                        <label>
                            <div className="label">
                                Message <b>*</b>
                            </div>
                            <textarea
                                className="input"
                                rows={6}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                style={{ resize: 'vertical' }}
                                placeholder="Tell us what you want to improve in your hiring workflow."
                            />
                        </label>

                        {status === 'success' && (
                            <div className="contact-status contact-status--success">
                                <CheckCircle2 size={16} /> Thanks—your request has been received.
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="contact-status contact-status--error">{error}</div>
                        )}

                        <button
                            className="btn btn--primary"
                            disabled={!canSubmit || status === 'submitting'}
                            onClick={submit}
                            style={{ justifyContent: 'center' }}
                        >
                            {status === 'submitting' ? (
                                <div className="spinner" />
                            ) : (
                                <Send size={16} />
                            )}
                            {mode === 'demo' ? 'Request demo' : 'Send message'}
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
