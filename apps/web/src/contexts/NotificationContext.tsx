import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppNotification, NotificationType } from '@/types';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextValue {
    notifications: AppNotification[];
    unreadCount: number;
    addNotification: (type: NotificationType, message: string, link?: string) => void;
    markRead: (id: string) => void;
    markAllRead: () => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isAuthenticated) {
            setNotifications([]);
            return;
        }
        let active = true;
        api.get('/api/notifications')
            .then((response) => {
                if (!active) return;
                setNotifications((response.data.data ?? []).map(normalizeNotification));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    const addNotification = useCallback(
        (type: NotificationType, message: string, link?: string) => {
            void api.post('/api/notifications', { type, message, link }).then((response) => {
                const item = normalizeNotification(response.data.data);
                setNotifications((prev) => [item, ...prev].slice(0, 100));
            });
        },
        [],
    );

    const markRead = useCallback((id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        void api.patch(`/api/notifications/${id}/read`);
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        void api.patch('/api/notifications/read-all');
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
        void api.delete('/api/notifications');
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <NotificationContext.Provider
            value={{ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

function normalizeNotification(value: any): AppNotification {
    return {
        id: value._id ?? value.id,
        type: value.type,
        message: value.message,
        link: value.link ?? undefined,
        read: Boolean(value.read),
        createdAt: value.createdAt,
    };
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
