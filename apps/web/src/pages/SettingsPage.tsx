import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CreditCard,
    ListChecks,
    Mail,
    Plus,
    Send,
    Settings,
    Shield,
    Trash2,
    Users,
} from 'lucide-react';
import {
    createBillingCheckout,
    getBillingStatus,
    getCurrentOrganization,
    getOrganizationMembers,
    inviteOrganizationMember,
    updateOrganizationMember,
    createCommunicationTemplate,
    deleteCommunicationTemplate,
    getCommunicationTemplates,
    createScorecardTemplate,
    deleteScorecardTemplate,
    getScorecardTemplates,
    getAuditLogs,
    getMyOrganizations,
} from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Membership } from '@/types';
import type { ScorecardCompetency } from '@/types';

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const { user, switchWorkspace } = useAuth();
    const canManage = user?.workspaceRole === 'owner' || user?.workspaceRole === 'admin';
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'recruiter' | 'interviewer' | 'viewer'>(
        'recruiter',
    );
    const [templateName, setTemplateName] = useState('');
    const [templateKind, setTemplateKind] = useState<'outreach' | 'rejection' | 'interview_invite'>(
        'outreach',
    );
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');
    const [scorecardName, setScorecardName] = useState('');
    const [roleFamily, setRoleFamily] = useState('');
    const [scorecardCompetencies, setScorecardCompetencies] = useState<ScorecardCompetency[]>([
        {
            id: 'role-fit',
            name: 'Role fit',
            description: 'Evidence of role alignment',
            weight: 100,
        },
    ]);
    const competencyWeightTotal = scorecardCompetencies.reduce(
        (total, competency) => total + (Number(competency.weight) || 0),
        0,
    );
    const canSaveScorecard =
        canManage &&
        scorecardName.trim().length > 1 &&
        roleFamily.trim().length > 1 &&
        scorecardCompetencies.every(
            (competency) =>
                competency.name.trim().length > 0 &&
                competency.description.trim().length > 0 &&
                competency.weight > 0,
        ) &&
        competencyWeightTotal === 100;

    const { data: organization } = useQuery({
        queryKey: ['current-organization'],
        queryFn: getCurrentOrganization,
    });
    const { data: workspaces = [] } = useQuery({
        queryKey: ['my-organizations'],
        queryFn: getMyOrganizations,
    });
    const { data: members = [] } = useQuery({
        queryKey: ['organization-members'],
        queryFn: getOrganizationMembers,
    });
    const { data: billing } = useQuery({
        queryKey: ['billing-status'],
        queryFn: getBillingStatus,
    });
    const { data: templates = [] } = useQuery({
        queryKey: ['communication-templates'],
        queryFn: getCommunicationTemplates,
    });
    const { data: scorecardTemplates = [] } = useQuery({
        queryKey: ['scorecard-templates'],
        queryFn: getScorecardTemplates,
    });
    const { data: auditLogs = [] } = useQuery({
        queryKey: ['audit-logs'],
        queryFn: () => getAuditLogs({ limit: 50 }),
        enabled: canManage,
    });

    const templateMutation = useMutation({
        mutationFn: () =>
            createCommunicationTemplate({
                name: templateName,
                kind: templateKind,
                subject: templateSubject,
                body: templateBody,
            }),
        onSuccess: () => {
            showSuccess('template-create', 'Email template saved.');
            setTemplateName('');
            setTemplateSubject('');
            setTemplateBody('');
            queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
        },
        onError: (error: Error) => showError('template-create', error.message),
    });
    const scorecardTemplateMutation = useMutation({
        mutationFn: () =>
            createScorecardTemplate({
                name: scorecardName,
                roleFamily,
                passingScore: 70,
                competencies: scorecardCompetencies,
            }),
        onSuccess: () => {
            showSuccess('scorecard-template-create', 'Scorecard template saved.');
            setScorecardName('');
            setRoleFamily('');
            queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
        },
        onError: (error: Error) => showError('scorecard-template-create', error.message),
    });

    const inviteMutation = useMutation({
        mutationFn: () => inviteOrganizationMember({ email: inviteEmail, role: inviteRole }),
        onSuccess: (invite) => {
            showSuccess('invite-member', 'Invite created.');
            setInviteEmail('');
            queryClient.invalidateQueries({ queryKey: ['organization-members'] });
            if (invite.inviteToken) {
                navigator.clipboard?.writeText(invite.inviteToken).catch(() => undefined);
            }
        },
        onError: (error: Error) => showError('invite-member', error.message),
    });

    const memberMutation = useMutation({
        mutationFn: ({
            id,
            dto,
        }: {
            id: string;
            dto: { role?: Membership['role']; status?: 'active' | 'disabled' };
        }) => updateOrganizationMember(id, dto),
        onSuccess: () => {
            showSuccess('member-update', 'Member updated.');
            queryClient.invalidateQueries({ queryKey: ['organization-members'] });
        },
        onError: (error: Error) => showError('member-update', error.message),
    });

    const billingMutation = useMutation({
        mutationFn: createBillingCheckout,
        onSuccess: (result) => {
            if (result.mode === 'stripe') {
                window.location.href = result.checkoutUrl;
                return;
            }
            showSuccess('billing-upgrade', `Workspace upgraded to ${result.plan}.`);
            queryClient.invalidateQueries({ queryKey: ['billing-status'] });
            queryClient.invalidateQueries({ queryKey: ['current-organization'] });
        },
        onError: (error: Error) => showError('billing-upgrade', error.message),
    });

    return (
        <div className="settings-page">
            <div>
                <div
                    className="page-title"
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                    <Settings size={22} /> Settings
                </div>
                <p className="text-muted" style={{ marginTop: 6 }}>
                    {organization?.name ?? 'Workspace'} · {organization?.slug ?? 'workspace'}
                </p>
                {workspaces.length > 1 && (
                    <select
                        className="input"
                        aria-label="Switch workspace"
                        value={user?.defaultOrganizationId ?? ''}
                        onChange={(event) => void switchWorkspace(event.target.value)}
                        style={{ maxWidth: 320, marginTop: 10 }}
                    >
                        {workspaces.map((membership) => (
                            <option key={membership._id} value={membership.organizationId}>
                                {membership.organization?.name ?? 'Workspace'} · {membership.role}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <section className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <CreditCard size={17} />
                    <h2 style={{ fontSize: 16, margin: 0 }}>Billing</h2>
                </div>
                <div className="settings-billing-grid">
                    <div>
                        <strong style={{ textTransform: 'capitalize' }}>
                            {billing?.plan ?? 'free'} plan
                        </strong>
                        <div className="text-sm text-muted">
                            Status: {billing?.subscriptionStatus ?? 'none'}
                        </div>
                    </div>
                    <button
                        className="btn btn--secondary btn--sm"
                        disabled={
                            !canManage || billingMutation.isPending || billing?.plan === 'pro'
                        }
                        onClick={() => billingMutation.mutate('pro')}
                    >
                        {billing?.plan === 'pro' ? 'Current plan' : 'Choose Pro'}
                    </button>
                    <button
                        className="btn btn--primary btn--sm"
                        disabled={
                            !canManage ||
                            billingMutation.isPending ||
                            billing?.plan === 'enterprise'
                        }
                        onClick={() => billingMutation.mutate('enterprise')}
                    >
                        {billing?.plan === 'enterprise' ? 'Current plan' : 'Upgrade to Enterprise'}
                    </button>
                </div>
            </section>

            {canManage && (
                <section className="card" style={{ padding: 20 }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}
                    >
                        <Shield size={17} />
                        <h2 style={{ fontSize: 16, margin: 0 }}>Audit log</h2>
                    </div>
                    <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflow: 'auto' }}>
                        {auditLogs.length === 0 && (
                            <div className="text-sm text-muted">
                                No audited workspace changes yet.
                            </div>
                        )}
                        {auditLogs.map((entry) => (
                            <div
                                key={entry._id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        'minmax(170px, 1fr) minmax(120px, .8fr) auto',
                                    gap: 10,
                                    borderBottom: '1px solid var(--color-border)',
                                    paddingBottom: 8,
                                }}
                            >
                                <div>
                                    <strong>
                                        {entry.action.replace(/_/g, ' ').replace(/\./g, ' · ')}
                                    </strong>
                                    <div className="text-sm text-muted">
                                        {entry.resourceType}
                                        {entry.resourceId ? ` · ${entry.resourceId}` : ''}
                                    </div>
                                </div>
                                <span className="text-sm text-muted">
                                    {entry.actorUserId
                                        ? (members.find(
                                              (member) => member.userId === entry.actorUserId,
                                          )?.user?.name ?? 'Former workspace member')
                                        : 'System'}
                                </span>
                                <time className="text-sm text-muted">
                                    {new Date(entry.createdAt).toLocaleString()}
                                </time>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <ListChecks size={17} />
                    <h2 style={{ fontSize: 16, margin: 0 }}>Scorecard templates</h2>
                </div>
                <div className="settings-two-column-form">
                    <label>
                        <span className="label">Template name</span>
                        <input
                            className="input"
                            value={scorecardName}
                            onChange={(event) => setScorecardName(event.target.value)}
                            placeholder="e.g. Engineering scorecard"
                        />
                    </label>
                    <label>
                        <span className="label">Role family</span>
                        <input
                            className="input"
                            value={roleFamily}
                            onChange={(event) => setRoleFamily(event.target.value)}
                            placeholder="e.g. Engineering"
                        />
                    </label>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {scorecardCompetencies.map((competency, index) => (
                        <div
                            key={competency.id}
                            className="scorecard-competency-row"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1.4fr 90px auto',
                                gap: 8,
                            }}
                        >
                            <input
                                className="input"
                                value={competency.name}
                                onChange={(event) =>
                                    setScorecardCompetencies((items) =>
                                        items.map((item, itemIndex) =>
                                            itemIndex === index
                                                ? { ...item, name: event.target.value }
                                                : item,
                                        ),
                                    )
                                }
                            />
                            <input
                                className="input"
                                value={competency.description}
                                onChange={(event) =>
                                    setScorecardCompetencies((items) =>
                                        items.map((item, itemIndex) =>
                                            itemIndex === index
                                                ? { ...item, description: event.target.value }
                                                : item,
                                        ),
                                    )
                                }
                            />
                            <input
                                className="input"
                                type="number"
                                min={1}
                                max={100}
                                value={competency.weight}
                                onChange={(event) =>
                                    setScorecardCompetencies((items) =>
                                        items.map((item, itemIndex) =>
                                            itemIndex === index
                                                ? { ...item, weight: Number(event.target.value) }
                                                : item,
                                        ),
                                    )
                                }
                            />
                            <button
                                className="btn btn--secondary btn--sm"
                                aria-label={`Remove ${competency.name}`}
                                disabled={!canManage || scorecardCompetencies.length === 1}
                                onClick={() =>
                                    setScorecardCompetencies((items) =>
                                        items.filter((_, itemIndex) => itemIndex !== index),
                                    )
                                }
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                        className="btn btn--secondary btn--sm"
                        onClick={() =>
                            setScorecardCompetencies((items) => [
                                ...items,
                                {
                                    id: `competency-${Date.now()}`,
                                    name: 'New competency',
                                    description: '',
                                    weight: 10,
                                },
                            ])
                        }
                    >
                        <Plus size={13} /> Add competency
                    </button>
                    <button
                        className="btn btn--primary btn--sm"
                        disabled={!canSaveScorecard || scorecardTemplateMutation.isPending}
                        onClick={() => scorecardTemplateMutation.mutate()}
                    >
                        Save template
                    </button>
                    <span
                        className={`settings-weight-total${competencyWeightTotal === 100 ? ' is-valid' : ''}`}
                    >
                        Total weight: {competencyWeightTotal}/100
                    </span>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    {scorecardTemplates.map((template) => (
                        <div
                            key={template._id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                border: '1px solid var(--color-border)',
                                borderRadius: 8,
                                padding: 10,
                            }}
                        >
                            <div>
                                <strong>{template.name}</strong>
                                <div className="text-sm text-muted">
                                    {template.roleFamily} · {template.competencies.length}{' '}
                                    competencies
                                </div>
                            </div>
                            <button
                                className="btn btn--secondary btn--sm"
                                aria-label={`Delete ${template.name}`}
                                disabled={!canManage}
                                onClick={() =>
                                    void deleteScorecardTemplate(template._id).then(() =>
                                        queryClient.invalidateQueries({
                                            queryKey: ['scorecard-templates'],
                                        }),
                                    )
                                }
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Mail size={17} />
                    <h2 style={{ fontSize: 16, margin: 0 }}>Email templates</h2>
                </div>
                <div className="settings-email-form">
                    <input
                        className="input"
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                        placeholder="Template name"
                    />
                    <select
                        className="input"
                        value={templateKind}
                        onChange={(event) =>
                            setTemplateKind(event.target.value as typeof templateKind)
                        }
                    >
                        <option value="outreach">Outreach</option>
                        <option value="rejection">Rejection</option>
                        <option value="interview_invite">Interview invite</option>
                    </select>
                    <input
                        className="input"
                        style={{ gridColumn: '1 / -1' }}
                        value={templateSubject}
                        onChange={(event) => setTemplateSubject(event.target.value)}
                        placeholder="Subject — use {{candidateName}} and {{jobTitle}}"
                    />
                    <textarea
                        className="input"
                        style={{ gridColumn: '1 / -1' }}
                        rows={4}
                        value={templateBody}
                        onChange={(event) => setTemplateBody(event.target.value)}
                        placeholder="Message body"
                    />
                    <button
                        className="btn btn--primary"
                        disabled={
                            !canManage ||
                            templateMutation.isPending ||
                            !templateName ||
                            !templateSubject ||
                            !templateBody
                        }
                        onClick={() => templateMutation.mutate()}
                    >
                        Save template
                    </button>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    {templates.map((template) => (
                        <div
                            key={template._id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                border: '1px solid var(--color-border)',
                                borderRadius: 8,
                                padding: 10,
                            }}
                        >
                            <div>
                                <strong>{template.name}</strong>
                                <div className="text-sm text-muted">
                                    {template.kind} · {template.subject}
                                </div>
                            </div>
                            <button
                                className="btn btn--secondary btn--sm"
                                aria-label={`Delete ${template.name}`}
                                disabled={!canManage}
                                onClick={() =>
                                    void deleteCommunicationTemplate(template._id).then(() =>
                                        queryClient.invalidateQueries({
                                            queryKey: ['communication-templates'],
                                        }),
                                    )
                                }
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Users size={17} />
                    <h2 style={{ fontSize: 16, margin: 0 }}>Team Members</h2>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        inviteMutation.mutate();
                    }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(180px, 1fr) 160px auto',
                        gap: 10,
                        marginBottom: 16,
                    }}
                    className="settings-invite-form"
                >
                    <input
                        className="input"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="teammate@company.com"
                    />
                    <select
                        className="input"
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}
                    >
                        <option value="admin">Admin</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="interviewer">Interviewer</option>
                        <option value="viewer">Viewer</option>
                    </select>
                    <button
                        className="btn btn--primary"
                        disabled={!canManage || inviteMutation.isPending}
                    >
                        <Send size={14} /> Invite
                    </button>
                </form>

                <div style={{ display: 'grid', gap: 8 }}>
                    {members.map((member) => (
                        <div
                            key={member._id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 150px 120px auto',
                                gap: 10,
                                alignItems: 'center',
                                border: '1px solid var(--color-border)',
                                borderRadius: 8,
                                padding: 10,
                            }}
                            className="settings-member-row"
                        >
                            <div>
                                <strong>
                                    {member.user?.name || member.invitedEmail || 'Member'}
                                </strong>
                                <div className="text-sm text-muted">
                                    {member.user?.email || member.invitedEmail} · {member.status}
                                </div>
                            </div>
                            <select
                                className="input"
                                value={member.role}
                                disabled={!canManage || member.role === 'owner'}
                                onChange={(event) =>
                                    memberMutation.mutate({
                                        id: member._id,
                                        dto: { role: event.target.value as Membership['role'] },
                                    })
                                }
                            >
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="recruiter">Recruiter</option>
                                <option value="interviewer">Interviewer</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <span className="text-sm text-muted">
                                <Shield size={13} /> {member.role}
                            </span>
                            {member.role !== 'owner' && (
                                <button
                                    className="btn btn--secondary btn--sm"
                                    disabled={!canManage || memberMutation.isPending}
                                    onClick={() =>
                                        memberMutation.mutate({
                                            id: member._id,
                                            dto: {
                                                status:
                                                    member.status === 'disabled'
                                                        ? 'active'
                                                        : 'disabled',
                                            },
                                        })
                                    }
                                >
                                    {member.status === 'disabled' ? 'Enable' : 'Disable'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
