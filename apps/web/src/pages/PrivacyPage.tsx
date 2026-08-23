import { ShieldCheck } from 'lucide-react';
import { LegalPage, type LegalSectionData } from './TermsPage';

const privacySections: LegalSectionData[] = [
    {
        id: 'collection',
        title: '1. Information we process',
        content: (
            <>
                <p>
                    RecruitAI processes information supplied by you and your workspace, including:
                </p>
                <ul>
                    <li>account, workspace, and team membership details;</li>
                    <li>job descriptions, candidate profiles, resumes, and source links;</li>
                    <li>outreach, interview transcripts, evaluations, comments, and reports;</li>
                    <li>
                        security and audit information such as IP address, user agent, and activity
                        logs.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: 'use',
        title: '2. How information is used',
        content: (
            <p>
                We use this information to provide recruiting workflows, secure accounts, generate
                requested analysis, support collaboration, troubleshoot the service, and meet legal
                obligations. We do not use candidate data to make autonomous final hiring decisions.
            </p>
        ),
    },
    {
        id: 'ai-providers',
        title: '3. AI providers and integrations',
        content: (
            <p>
                When provider credentials are configured, relevant prompts and content may be
                processed by that provider to deliver the requested feature. The local free-first
                fallback remains available when no external AI key is configured. Connected services
                are also governed by their own privacy terms.
            </p>
        ),
    },
    {
        id: 'retention',
        title: '4. Retention and control',
        content: (
            <p>
                Workspace administrators should retain recruiting data only as long as necessary for
                a legitimate purpose. RecruitAI includes candidate export and deletion controls so
                authorized users can respond to privacy requests and internal retention policies.
            </p>
        ),
    },
    {
        id: 'security',
        title: '5. Security and access',
        content: (
            <p>
                Access is scoped by workspace and role. We use session controls, audit records, and
                technical safeguards designed to prevent unauthorized access. No system is
                completely secure, so users must also protect credentials and configure production
                infrastructure appropriately.
            </p>
        ),
    },
    {
        id: 'rights',
        title: '6. Privacy requests',
        content: (
            <p>
                Requests to access, correct, export, or delete personal information should normally
                be directed to the organization that collected the candidate data. For information
                submitted directly through RecruitAI public forms, contact our team through the
                contact page.
            </p>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            icon={<ShieldCheck size={21} />}
            eyebrow="Privacy"
            title="Privacy Policy"
            summary="A clear overview of what recruiting information RecruitAI processes, why it is used, and the controls available to your workspace."
            sections={privacySections}
        />
    );
}
