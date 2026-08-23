import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import {
    getCandidateEmailDeliveries,
    getCommunicationTemplates,
    sendCandidateEmail,
} from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

export default function CandidateEmailPanel({
    candidateId,
    hasEmail,
}: {
    candidateId: string;
    hasEmail: boolean;
}) {
    const [templateId, setTemplateId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const { data: templates = [] } = useQuery({
        queryKey: ['communication-templates'],
        queryFn: getCommunicationTemplates,
    });
    const { data: deliveries = [] } = useQuery({
        queryKey: ['email-deliveries', candidateId],
        queryFn: () => getCandidateEmailDeliveries(candidateId),
    });
    const mutation = useMutation({
        mutationFn: () =>
            sendCandidateEmail(candidateId, templateId ? { templateId } : { subject, body }),
        onSuccess: (delivery) => {
            showSuccess(
                `email-${candidateId}`,
                delivery.status === 'preview'
                    ? 'Email preview recorded. Configure SMTP to deliver.'
                    : 'Email sent.',
            );
            setSubject('');
            setBody('');
            queryClient.invalidateQueries({ queryKey: ['email-deliveries', candidateId] });
        },
        onError: (error: Error) => showError(`email-${candidateId}`, error.message),
    });
    return (
        <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Mail size={16} />
                <strong>Candidate email</strong>
            </div>
            {!hasEmail ? (
                <div className="text-sm text-muted">
                    Add an email address to contact this candidate.
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    <select
                        className="input"
                        value={templateId}
                        onChange={(event) => setTemplateId(event.target.value)}
                    >
                        <option value="">Custom message</option>
                        {templates.map((template) => (
                            <option key={template._id} value={template._id}>
                                {template.name}
                            </option>
                        ))}
                    </select>
                    {!templateId && (
                        <>
                            <input
                                className="input"
                                value={subject}
                                onChange={(event) => setSubject(event.target.value)}
                                placeholder="Subject"
                            />
                            <textarea
                                className="input"
                                rows={4}
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                placeholder="Message"
                            />
                        </>
                    )}
                    <button
                        className="btn btn--primary btn--sm"
                        disabled={
                            mutation.isPending || (!templateId && (!subject.trim() || !body.trim()))
                        }
                        onClick={() => mutation.mutate()}
                    >
                        <Send size={13} /> Send
                    </button>
                </div>
            )}
            {deliveries.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    {deliveries.slice(0, 4).map((item) => (
                        <div
                            key={item._id}
                            className="text-sm text-muted"
                            style={{ padding: '4px 0' }}
                        >
                            {item.subject} · {item.status}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
