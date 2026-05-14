import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppNotification, NotificationType } from '@/types';

interface NotificationContextValue {
    notifications: AppNotification[];
    unreadCount: number;
    addNotification: (type: NotificationType, message: string, link?: string) => void;
    markRead: (id: string) => void;
    markAllRead: () => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = 'recruit-ai-notifications';

function load(): AppNotification[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function save(items: AppNotification[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
    } catch {}
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>(load);

    useEffect(() => {
        save(notifications);
    }, [notifications]);

    const addNotification = useCallback(
        (type: NotificationType, message: string, link?: string) => {
            const item: AppNotification = {
                id: crypto.randomUUID(),
                type,
                message,
                link,
                read: false,
                createdAt: new Date().toISOString(),
            };
            setNotifications((prev) => [item, ...prev].slice(0, 50));
        },
        [],
    );

    const markRead = useCallback((id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <NotificationContext.Provider
            value={{ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
    return ctx;
}

// ─── Relative time helper ─────────
export function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
