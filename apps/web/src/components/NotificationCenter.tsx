import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Star, MessageSquare, Users } from 'lucide-react';
import { useNotifications, relativeTime } from '@/contexts/NotificationContext';
import type { NotificationType } from '@/types';

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
    scored: <Star size={14} />,
    sourced: <Users size={14} />,
    responded: <MessageSquare size={14} />,
    outreach_sent: <CheckCircle2 size={14} />,
    hired: <CheckCircle2 size={14} />,
};

const TYPE_COLORS: Record<NotificationType, string> = {
    scored: '#7C3AED',
    sourced: '#3b82f6',
    responded: '#10b981',
    outreach_sent: '#f59e0b',
    hired: '#10b981',
};

export default function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
    const navigate = useNavigate();
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Bell button */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label={`Notifications — ${unreadCount} unread`}
                style={{
                    position: 'relative',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: open ? 'rgba(124,58,237,0.12)' : 'transparent',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    transition: 'all 0.2s',
                }}
            >
                <Bell size={17} />
                {unreadCount > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            minWidth: 16,
                            height: 16,
                            borderRadius: 999,
                            background: '#7C3AED',
                            border: '2px solid var(--color-bg)',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                        }}
                    >
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 46,
                        right: 0,
                        width: 320,
                        maxHeight: 480,
                        background: 'var(--color-surface-2, #111115)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 14,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                        zIndex: 8000,
                        display: 'flex',
                        flexDirection: 'column',
                        animation: 'notif-in 0.18s ease',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px 10px',
                            borderBottom: '1px solid var(--color-border)',
                        }}
                    >
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                            Notifications
                            {unreadCount > 0 && (
                                <span
                                    style={{
                                        marginLeft: 8,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: '#7C3AED',
                                        color: '#fff',
                                        borderRadius: 999,
                                        padding: '1px 7px',
                                    }}
                                >
                                    {unreadCount}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={markAllRead}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 12,
                                color: 'var(--color-primary)',
                                fontWeight: 600,
                            }}
                            aria-label="Mark all as read"
                        >
                            Mark all read
                        </button>
                    </div>

                    {/* List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div
                                style={{
                                    padding: 32,
                                    textAlign: 'center',
                                    color: 'var(--color-text-muted)',
                                    fontSize: 13,
                                }}
                            >
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => {
                                        markRead(n.id);
                                        if (n.link) navigate(n.link);
                                        setOpen(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        padding: '12px 16px',
                                        background: n.read
                                            ? 'transparent'
                                            : 'rgba(124,58,237,0.06)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        borderBottom: '1px solid var(--color-border)',
                                        transition: 'background 0.15s',
                                    }}
                                    aria-label={n.message}
                                >
                                    <div
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            background: `${TYPE_COLORS[n.type]}22`,
                                            color: TYPE_COLORS[n.type],
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {TYPE_ICONS[n.type]}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p
                                            style={{
                                                fontSize: 13,
                                                color: 'var(--color-text)',
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {n.message}
                                        </p>
                                        <p
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--color-text-muted)',
                                                marginTop: 2,
                                            }}
                                        >
                                            {relativeTime(n.createdAt)}
                                        </p>
                                    </div>
                                    {!n.read && (
                                        <div
                                            style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: '50%',
                                                background: '#7C3AED',
                                                flexShrink: 0,
                                                marginTop: 5,
                                            }}
                                        />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div
                            style={{
                                padding: '8px 16px',
                                borderTop: '1px solid var(--color-border)',
                            }}
                        >
                            <button
                                onClick={clearAll}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    color: 'var(--color-text-muted)',
                                    width: '100%',
                                    textAlign: 'center',
                                }}
                                aria-label="Clear all notifications"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
