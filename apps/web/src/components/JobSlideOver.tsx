import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createJob, updateJob } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { Job, JobType, JobStatus } from '@/types';

interface JobSlideOverProps {
    isOpen: boolean;
    onClose: () => void;
    editJob?: Job | null;
}

const LOCATIONS = ['Remote', 'Hybrid', 'On-site'];
const TYPES: JobType[] = ['full-time', 'part-time', 'contract'];

export default function JobSlideOver({ isOpen, onClose, editJob }: JobSlideOverProps) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [title, setTitle] = useState('');
    const [titleError, setTitleError] = useState('');
    const [description, setDescription] = useState('');
    const [descriptionError, setDescriptionError] = useState('');
    const [requirements, setRequirements] = useState<string[]>([]);
    const [requirementsError, setRequirementsError] = useState('');
    const [reqInput, setReqInput] = useState('');
    const [location, setLocation] = useState('Remote');
    const [type, setType] = useState<JobType>('full-time');
    const [status, setStatus] = useState<JobStatus>('active');
    const panelRef = useRef<HTMLDivElement>(null);

    // Populate fields when editing
    useEffect(() => {
        if (editJob) {
            setTitle(editJob.title);
            setDescription(editJob.description);
            setRequirements(editJob.requirements ?? []);
            setLocation(editJob.location ?? 'Remote');
            setType(editJob.type ?? 'full-time');
            setStatus(editJob.status ?? 'active');
        } else {
            setTitle('');
            setDescription('');
            setRequirements([]);
            setLocation('Remote');
            setType('full-time');
            setStatus('active');
        }
    }, [editJob, isOpen]);

    // Escape closes
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const addReq = () => {
        const trimmed = reqInput.trim();
        if (trimmed && !requirements.includes(trimmed)) {
            setRequirements((prev) => [...prev, trimmed]);
            setRequirementsError('');
        }
        setReqInput('');
    };

    const validate = () => {
        let valid = true;
        if (!title.trim()) {
            setTitleError('Job title is required');
            valid = false;
        }
        if (!description.trim()) {
            setDescriptionError('Description is required');
            valid = false;
        }
        if (requirements.length === 0) {
            setRequirementsError('Add at least one requirement');
            valid = false;
        }
        return valid;
    };

    const mutation = useMutation({
        mutationFn: async () => {
            const dto = { title, description, requirements, location, type, status };
            return editJob ? updateJob(editJob._id, dto) : createJob(dto);
        },
        onSuccess: (job) => {
            queryClient.setQueryData<Job[]>(['jobs'], (current = []) => {
                const next = current.filter((item) => item._id !== job._id);
                return [job, ...next];
            });
            showSuccess(
                `job-${job._id}`,
                `${editJob ? 'Role updated' : 'Role created'}: "${job.title}"`,
            );
            onClose();
        },
        onError: (err: Error) => {
            showError('job-save-failed', `Failed to save role: ${err.message}`);
        },
    });

    const handleSubmit = () => {
        setTitleError('');
        setDescriptionError('');
        setRequirementsError('');
        if (!validate()) return;
        mutation.mutate();
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 7000,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(6px)',
                    animation: 'fade-in 0.2s ease',
                }}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 400,
                    maxWidth: '100vw',
                    background: 'var(--color-surface-2, #111115)',
                    borderLeft: '1px solid var(--color-border)',
                    zIndex: 7001,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slide-in-right 0.25s cubic-bezier(0.22,1,0.36,1)',
                    boxShadow: '-16px 0 64px rgba(0,0,0,0.4)',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                >
                    <h2
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            margin: 0,
                        }}
                    >
                        {editJob ? 'Edit Role' : 'Create New Role'}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close panel"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {/* Title */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="label" htmlFor="job-title">
                            Job Title <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            id="job-title"
                            className="input"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (titleError) setTitleError('');
                            }}
                            placeholder="e.g. Senior Node.js Engineer"
                            required
                        />
                        {titleError && (
                            <div style={{ fontSize: 12, color: '#f87171' }}>{titleError}</div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="label" htmlFor="job-desc">
                            Description
                        </label>
                        <textarea
                            id="job-desc"
                            className="input"
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                if (descriptionError) setDescriptionError('');
                            }}
                            placeholder="Describe the role, responsibilities, and team..."
                            rows={4}
                            style={{ resize: 'vertical', minHeight: 90 }}
                        />
                        {descriptionError && (
                            <div style={{ fontSize: 12, color: '#f87171' }}>{descriptionError}</div>
                        )}
                    </div>

                    {/* Requirements tag input */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="label" htmlFor="job-req">
                            Requirements
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {requirements.map((r) => (
                                <span
                                    key={r}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '3px 10px',
                                        borderRadius: 24,
                                        background: 'rgba(124,58,237,0.15)',
                                        border: '1px solid rgba(124,58,237,0.3)',
                                        fontSize: 12,
                                        color: '#a78bfa',
                                    }}
                                >
                                    {r}
                                    <button
                                        onClick={() =>
                                            setRequirements((prev) => prev.filter((x) => x !== r))
                                        }
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            display: 'flex',
                                            padding: 0,
                                        }}
                                        aria-label={`Remove ${r}`}
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                id="job-req"
                                className="input"
                                value={reqInput}
                                onChange={(e) => setReqInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addReq();
                                    }
                                }}
                                placeholder="Type requirement, press Enter..."
                                style={{ flex: 1 }}
                            />
                            <button
                                onClick={addReq}
                                className="btn btn--secondary"
                                aria-label="Add requirement"
                                style={{ padding: '0 14px' }}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        {requirementsError && (
                            <div style={{ fontSize: 12, color: '#f87171' }}>
                                {requirementsError}
                            </div>
                        )}
                    </div>

                    {/* Location pill selector */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="label">Location</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {LOCATIONS.map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setLocation(l)}
                                    aria-pressed={location === l}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: 24,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        border: `1px solid ${location === l ? '#7C3AED' : 'var(--color-border)'}`,
                                        background:
                                            location === l
                                                ? 'rgba(124,58,237,0.15)'
                                                : 'transparent',
                                        color:
                                            location === l ? '#a78bfa' : 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Type pill selector */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="label">Employment Type</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {TYPES.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    aria-pressed={type === t}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: 24,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        border: `1px solid ${type === t ? '#7C3AED' : 'var(--color-border)'}`,
                                        background:
                                            type === t ? 'rgba(124,58,237,0.15)' : 'transparent',
                                        color: type === t ? '#a78bfa' : 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status toggle */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="label">Status</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['active', 'paused'] as JobStatus[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    aria-pressed={status === s}
                                    style={{
                                        padding: '6px 20px',
                                        borderRadius: 24,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        border: `1px solid ${status === s ? (s === 'active' ? '#10b981' : '#f59e0b') : 'var(--color-border)'}`,
                                        background:
                                            status === s
                                                ? s === 'active'
                                                    ? 'rgba(16,185,129,0.12)'
                                                    : 'rgba(245,158,11,0.12)'
                                                : 'transparent',
                                        color:
                                            status === s
                                                ? s === 'active'
                                                    ? '#10b981'
                                                    : '#f59e0b'
                                                : 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--color-border)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                    }}
                >
                    <button className="btn btn--secondary" onClick={onClose} aria-label="Cancel">
                        Cancel
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                        aria-label={editJob ? 'Save changes' : 'Create role'}
                    >
                        {mutation.isPending ? <div className="spinner" /> : null}
                        {editJob ? 'Save Changes' : 'Create Role'}
                    </button>
                </div>
            </div>
        </>
    );
}
