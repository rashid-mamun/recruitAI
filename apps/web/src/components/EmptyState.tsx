import { Briefcase, Users, MessageSquare } from 'lucide-react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '64px 24px',
                textAlign: 'center',
                gap: 12,
            }}
        >
            {icon && (
                <div
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'rgba(124,58,237,0.10)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                        color: 'var(--color-primary)',
                    }}
                >
                    {icon}
                </div>
            )}
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {title}
            </p>
            {description && (
                <p
                    style={{
                        fontSize: '0.9rem',
                        color: 'var(--color-text-muted)',
                        maxWidth: 380,
                        lineHeight: 1.6,
                    }}
                >
                    {description}
                </p>
            )}
            {action && (
                <button
                    className="btn btn--primary"
                    onClick={action.onClick}
                    style={{ marginTop: 12 }}
                    aria-label={action.label}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

export function NoJobs({ onCreate }: { onCreate: () => void }) {
    return (
        <EmptyState
            icon={<Briefcase size={28} />}
            title="No roles yet"
            description="Create your first job to start sourcing candidates automatically with AI."
            action={{ label: 'Create New Role', onClick: onCreate }}
        />
    );
}

export function NoCandidates({ onSource }: { onSource?: () => void }) {
    return (
        <EmptyState
            icon={<Users size={28} />}
            title="Pipeline is empty"
            description="Start sourcing to find candidates that match your role requirements."
            action={onSource ? { label: 'Start Sourcing', onClick: onSource } : undefined}
        />
    );
}

export function NoMessages() {
    return (
        <EmptyState
            icon={<MessageSquare size={28} />}
            title="No conversation yet"
            description="Send an outreach message to start the conversation with this candidate."
        />
    );
}
