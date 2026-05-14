import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type ToastType = 'loading' | 'success' | 'error';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    progress?: number; // 0-100 for loading
    retryFn?: () => void;
    leaving?: boolean;
}

interface ToastContextValue {
    toasts: Toast[];
    showLoading: (id: string, message: string) => void;
    updateProgress: (id: string, percent: number) => void;
    showSuccess: (id: string, message: string) => void;
    showError: (id: string, message: string, retryFn?: () => void) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const scheduleDismiss = useCallback((id: string, delay: number) => {
        const existing = timers.current.get(id);
        if (existing) clearTimeout(existing);
        timers.current.set(
            id,
            setTimeout(() => {
                setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
                timers.current.set(
                    id,
                    setTimeout(() => {
                        setToasts((prev) => prev.filter((t) => t.id !== id));
                        timers.current.delete(id);
                    }, 200),
                );
            }, delay),
        );
    }, []);

    const upsertToast = useCallback((next: Toast) => {
        setToasts((prev) => {
            const exists = prev.some((t) => t.id === next.id);
            const updated = exists
                ? prev.map((t) => (t.id === next.id ? { ...next, leaving: false } : t))
                : [...prev, next];
            if (updated.length > 4) return updated.slice(updated.length - 4);
            return updated;
        });
    }, []);

    const showLoading = useCallback(
        (id: string, message: string) => {
            upsertToast({ id, type: 'loading', message, progress: 0 });
        },
        [upsertToast],
    );

    const updateProgress = useCallback((id: string, percent: number) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, progress: percent } : t)));
    }, []);

    const showSuccess = useCallback(
        (id: string, message: string) => {
            upsertToast({ id, type: 'success', message, progress: 100 });
            scheduleDismiss(id, 4000);
        },
        [scheduleDismiss, upsertToast],
    );

    const showError = useCallback(
        (id: string, message: string, retryFn?: () => void) => {
            upsertToast({ id, type: 'error', message, retryFn });
            scheduleDismiss(id, 6000);
        },
        [scheduleDismiss, upsertToast],
    );

    const dismiss = useCallback((id: string) => {
        const existing = timers.current.get(id);
        if (existing) clearTimeout(existing);
        timers.current.delete(id);
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        timers.current.set(
            id,
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
                timers.current.delete(id);
            }, 200),
        );
    }, []);

    return (
        <ToastContext.Provider
            value={{ toasts, showLoading, updateProgress, showSuccess, showError, dismiss }}
        >
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}
