import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, Scale } from 'lucide-react';

const termsSections = [
    {
        id: 'service',
        title: '1. Using RecruitAI',
        content: (
            <p>
                RecruitAI provides tools for sourcing, outreach, interview analysis, structured
                evaluation, reporting, and team review. You may use the service only for lawful
                recruiting activities and must keep your account information accurate and secure.
            </p>
        ),
    },
    {
        id: 'responsibilities',
        title: '2. Your responsibilities',
        content: (
            <>
                <p>You are responsible for the data submitted through your workspace and for:</p>
                <ul>
                    <li>having permission to process candidate and interview information;</li>
                    <li>following employment, privacy, and anti-discrimination laws;</li>
                    <li>protecting credentials, API keys, exports, and generated reports;</li>
                    <li>reviewing access when teammates join, change roles, or leave.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'ai',
        title: '3. AI-assisted decisions',
        content: (
            <p>
                Scores, summaries, and recommendations are decision-support outputs. They may be
                incomplete or inaccurate and must not be treated as final employment decisions.
                Meaningful human review is required before taking action on a candidate.
            </p>
        ),
    },
    {
        id: 'acceptable-use',
        title: '4. Acceptable use',
        content: (
            <p>
                Do not misuse the service, attempt unauthorized access, upload malicious content,
                scrape prohibited sources, or process sensitive data without a valid legal basis. We
                may restrict access when use creates a security, legal, or operational risk.
            </p>
        ),
    },
    {
        id: 'availability',
        title: '5. Availability and changes',
        content: (
            <p>
                Features may change as the product evolves. Integrations and AI providers can have
                their own availability and terms. Material updates to these terms will be reflected
                by the effective date shown on this page.
            </p>
        ),
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            icon={<Scale size={21} />}
            eyebrow="Legal"
            title="Terms of Use"
            summary="The ground rules for using RecruitAI responsibly, securely, and with meaningful human oversight."
            sections={termsSections}
        />
    );
}

export interface LegalSectionData {
    id: string;
    title: string;
    content: ReactNode;
}

export function LegalPage({
    icon,
    eyebrow,
    title,
    summary,
    sections,
}: {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    summary: string;
    sections: LegalSectionData[];
}) {
    return (
        <main className="legal-page">
            <header className="legal-nav">
                <Link to="/" className="legal-brand" aria-label="RecruitAI home">
                    <span className="legal-brand__mark">
                        <BriefcaseBusiness size={17} />
                    </span>
                    <span>RecruitAI</span>
                </Link>
                <nav className="legal-nav__actions" aria-label="Legal page navigation">
                    <Link to="/privacy">Privacy</Link>
                    <Link to="/terms">Terms</Link>
                    <Link to="/login" className="btn btn--secondary btn--sm">
                        Sign in
                    </Link>
                </nav>
            </header>
            <div className="legal-shell">
                <Link to="/" className="legal-back">
                    <ArrowLeft size={15} /> Back to RecruitAI
                </Link>
                <section className="legal-hero">
                    <div className="legal-hero__icon">{icon}</div>
                    <div className="legal-eyebrow">{eyebrow} · Effective August 23, 2026</div>
                    <h1>{title}</h1>
                    <p>{summary}</p>
                </section>
                <div className="legal-layout">
                    <aside className="legal-toc">
                        <div className="legal-toc__label">On this page</div>
                        {sections.map((section) => (
                            <a key={section.id} href={`#${section.id}`}>
                                {section.title.replace(/^\d+\.\s*/, '')}
                            </a>
                        ))}
                        <Link to="/contact" className="legal-contact-link">
                            Questions? Contact us <ArrowUpRight size={14} />
                        </Link>
                    </aside>
                    <article className="legal-document">
                        {sections.map((section) => (
                            <section id={section.id} key={section.id} className="legal-section">
                                <h2>{section.title}</h2>
                                <div>{section.content}</div>
                            </section>
                        ))}
                        <div className="legal-footer-note">
                            Need help understanding this document?{' '}
                            <Link to="/contact">Talk to our team</Link>.
                        </div>
                    </article>
                </div>
            </div>
        </main>
    );
}
