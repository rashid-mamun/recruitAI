import { useEffect, useRef } from 'react';
import { useToast, type Toast } from '@/contexts/ToastContext';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const ICONS: Record<Toast['type'], typeof X> = {
    success: CheckCircle2,
    error: AlertCircle,
    loading: Loader2,
};

const COLORS: Record<Toast['type'], string> = {
    success: 'var(--color-success)',
    error: 'var(--color-danger)',
    loading: 'var(--color-primary)',
};

function ToastItem({ toast }: { toast: Toast }) {
    const { dismiss } = useToast();
    const Icon = ICONS[toast.type];
    const color = COLORS[toast.type];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--color-surface-2)',
                border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.35)' : toast.type === 'error' ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}`,
                borderLeft:
                    toast.type === 'success'
                        ? '3px solid var(--color-success)'
                        : toast.type === 'error'
                          ? '3px solid var(--color-danger)'
                          : '3px solid transparent',
                boxShadow: '0 0 0 1px var(--color-border)',
                minWidth: 280,
                maxWidth: 360,
                position: 'relative',
                animation: toast.leaving ? undefined : 'toast-in 0.25s cubic-bezier(.22,1,.36,1)',
                opacity: toast.leaving ? 0 : 1,
                transform: toast.leaving ? 'translateX(16px)' : 'translateX(0)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                overflow: 'hidden',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon
                    size={18}
                    style={{
                        color,
                        flexShrink: 0,
                        animation:
                            toast.type === 'loading' ? 'spin 1.2s linear infinite' : undefined,
                    }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>
                        {toast.message}
                    </div>
                </div>
                <button
                    onClick={() => dismiss(toast.id)}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 6,
                        flexShrink: 0,
                    }}
                    aria-label="Dismiss"
                >
                    <X size={14} />
                </button>
            </div>

            {toast.type === 'error' && toast.retryFn && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={toast.retryFn}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 999,
                            cursor: 'pointer',
                        }}
                        aria-label="Retry"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Progress bar */}
            {toast.type === 'loading' && typeof toast.progress === 'number' && (
                <div
                    style={{
                        height: 3,
                        borderRadius: 99,
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${toast.progress}%`,
                            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                            borderRadius: 99,
                            transition: 'width 0.25s ease',
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export function ToastContainer() {
    const { toasts } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);

    // Inject keyframe animations once
    useEffect(() => {
        if (document.getElementById('toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes toast-in {
                from { opacity: 0; transform: translateX(16px); }
                to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'flex-end',
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => (
                <div key={toast.id} style={{ pointerEvents: 'auto' }}>
                    <ToastItem toast={toast} />
                </div>
            ))}
        </div>
    );
}
