import { Outlet, useLocation, useParams, Link } from 'react-router-dom';
import { LogOut, Menu, X, Home, Moon, Sun } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import CommandPalette, { pushRecentPage } from './CommandPalette';
import NotificationCenter from './NotificationCenter';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { buildApiUrl, getCandidate, getJob } from '@/services/api';
import Sidebar from './Sidebar';

const THEME_KEY = 'recruit-ai-theme';

export default function Layout() {
    const location = useLocation();
    const params = useParams();
    const { logout, user } = useAuth();
    const queryClient = useQueryClient();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>(() =>
        document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    );

    useEffect(() => {
        const eventSource = new EventSource(buildApiUrl('/api/stream/events'));

        eventSource.onmessage = () => {
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
            queryClient.invalidateQueries({ queryKey: ['candidate-messages'] });
        };

        return () => eventSource.close();
    }, [queryClient]);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    useEffect(() => {
        if (!userMenuOpen) return;
        const handler = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-user-menu]')) return;
            setUserMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [userMenuOpen]);

    useEffect(() => {
        if (!userMenuOpen) return;
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setUserMenuOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [userMenuOpen]);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac');
            const hotkey = isMac
                ? event.metaKey && event.key.toLowerCase() === 'k'
                : event.ctrlKey && event.key.toLowerCase() === 'k';
            if (hotkey) {
                event.preventDefault();
                setCommandOpen(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        const path = location.pathname;
        const label =
            path.startsWith('/jobs/') && path.includes('/candidates')
                ? 'Job Candidates'
                : path.startsWith('/jobs/')
                  ? 'Job Details'
                  : path.startsWith('/jobs')
                    ? 'Jobs'
                    : path.startsWith('/candidates/')
                      ? 'Candidate Details'
                      : path.startsWith('/candidates')
                        ? 'All Candidates'
                        : 'Dashboard';
        pushRecentPage(label, path);
    }, [location.pathname]);

    const jobId = params.jobId;
    const candidateId = params.candidateId;

    const { data: jobTitle } = useQuery({
        queryKey: ['job-breadcrumb', jobId],
        queryFn: async () => (jobId ? (await getJob(jobId)).title : ''),
        enabled: !!jobId,
        staleTime: 60_000,
    });

    const { data: candidateName } = useQuery({
        queryKey: ['candidate-breadcrumb', candidateId],
        queryFn: async () => (candidateId ? (await getCandidate(candidateId)).name : ''),
        enabled: !!candidateId,
        staleTime: 60_000,
    });

    const breadcrumb: Array<{ label: string; to?: string }> = (() => {
        const homeCrumb = { label: 'Home', to: '/' };
        if (location.pathname.startsWith('/jobs/') && location.pathname.includes('/candidates')) {
            return [
                homeCrumb,
                { label: 'Jobs', to: '/jobs' },
                { label: jobTitle || 'Job', to: jobId ? `/jobs/${jobId}` : '/jobs' },
                { label: 'Candidates' },
            ];
        }
        if (location.pathname.startsWith('/jobs/')) {
            return [homeCrumb, { label: 'Jobs', to: '/jobs' }, { label: jobTitle || 'Job' }];
        }
        if (location.pathname.startsWith('/candidates/')) {
            return [
                homeCrumb,
                { label: 'Candidates', to: '/candidates' },
                { label: candidateName || 'Candidate' },
            ];
        }
        if (location.pathname.startsWith('/candidates')) {
            return [homeCrumb, { label: 'Candidates' }];
        }
        if (location.pathname.startsWith('/jobs')) {
            return [homeCrumb, { label: 'Jobs' }];
        }
        return [homeCrumb];
    })();

    return (
        <div
            className={`flex flex-col-mobile min-h-screen app-shell`}
            style={{ overflow: 'hidden', height: '100vh', position: 'relative' }}
        >
            {/* ── Mobile Header ─── */}
            <div
                className="flex items-center justify-between p-4 border mobile-topbar"
                style={{
                    backgroundColor: 'var(--color-surface)',
                    display: 'none',
                    borderBottomWidth: '1px',
                }}
                id="mobile-header"
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold"
                        style={{
                            background:
                                'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                            boxShadow: 'var(--shadow-glow)',
                        }}
                    >
                        R
                    </div>
                    <div className="font-bold font-display leading-none">RecruitAI</div>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-muted hover:text-white topbar-icon-btn"
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* ── Sidebar ─── */}
            <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                setUserMenuOpen={setUserMenuOpen}
            />
            {/* ── Main Content ──────── */}
            <main
                className="flex-1 flex flex-col"
                style={{ overflow: 'auto', background: 'var(--color-bg)' }}
            >
                <header
                    className="flex items-center justify-between px-8 border mobile-hidden flex-shrink-0 gap-2 topbar-shell"
                    style={{
                        height: 'var(--header-height)',
                        background: 'rgba(5, 5, 5, 0.4)',
                        backdropFilter: 'blur(20px)',
                        borderBottomWidth: '1px',
                        borderTop: 0,
                        borderRight: 0,
                        borderLeft: 0,
                        borderColor: 'var(--color-border)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                    }}
                >
                    <div
                        className="flex items-center gap-2 text-sm font-medium font-display tracking-wider uppercase breadcrumb-shell"
                        style={{ fontSize: 12 }}
                    >
                        {breadcrumb.map((crumb, index) => (
                            <span
                                key={`${crumb.label}-${index}`}
                                className="flex items-center gap-2"
                            >
                                {index === 0 && <Home size={12} className="opacity-60" />}
                                {crumb.to ? (
                                    <Link
                                        to={crumb.to}
                                        className={
                                            index === breadcrumb.length - 1
                                                ? 'breadcrumb-current'
                                                : 'breadcrumb-link'
                                        }
                                    >
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span
                                        className={
                                            index === breadcrumb.length - 1
                                                ? 'breadcrumb-current'
                                                : 'breadcrumb-link'
                                        }
                                    >
                                        {crumb.label}
                                    </span>
                                )}
                                {index < breadcrumb.length - 1 && (
                                    <span className="opacity-40">/</span>
                                )}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            className="header-search-chip"
                            onClick={() => setCommandOpen(true)}
                            aria-label="Open command palette"
                        >
                            <span className="opacity-50">⌘ K</span>
                            <span
                                className="ml-2 font-sans opacity-70 header-search-chip__label"
                                style={{ textTransform: 'none' }}
                            >
                                Quick search...
                            </span>
                        </button>
                        <NotificationCenter />
                        <div data-user-menu style={{ position: 'relative' }}>
                            <button
                                onClick={() => setUserMenuOpen((value) => !value)}
                                className="header-chip"
                                aria-label="Open user menu"
                                title="User menu"
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{
                                        background: 'var(--color-surface-2)',
                                        border: '1px solid var(--color-border-hover)',
                                        color: 'var(--color-text)',
                                    }}
                                >
                                    {user?.name?.charAt(0) || 'U'}
                                </div>
                            </button>
                            {userMenuOpen && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: 46,
                                        width: 240,
                                        background: 'var(--color-surface-2)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 14,
                                        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                                        padding: 12,
                                        zIndex: 9000,
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: '6px 8px 10px',
                                            borderBottom: '1px solid var(--color-border)',
                                        }}
                                    >
                                        <div
                                            style={{ fontWeight: 600, color: 'var(--color-text)' }}
                                        >
                                            {user?.name || 'User'}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: 'var(--color-text-muted)',
                                                marginTop: 2,
                                            }}
                                        >
                                            {user?.email || 'Admin'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() =>
                                            setTheme((current) =>
                                                current === 'dark' ? 'light' : 'dark',
                                            )
                                        }
                                        style={{
                                            width: '100%',
                                            marginTop: 10,
                                            padding: '8px 10px',
                                            borderRadius: 10,
                                            border: '1px solid var(--color-border)',
                                            background: 'transparent',
                                            color: 'var(--color-text-muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                            cursor: 'pointer',
                                        }}
                                        aria-label="Toggle theme"
                                    >
                                        <span
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {theme === 'dark' ? (
                                                <Moon size={16} />
                                            ) : (
                                                <Sun size={16} />
                                            )}
                                            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                                        </span>
                                        <span
                                            style={{
                                                width: 34,
                                                height: 20,
                                                borderRadius: 999,
                                                border: '1px solid var(--color-border)',
                                                background: 'rgba(255,255,255,0.04)',
                                                padding: 2,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent:
                                                    theme === 'dark' ? 'flex-end' : 'flex-start',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: '50%',
                                                    background: 'var(--color-primary)',
                                                }}
                                            />
                                        </span>
                                    </button>
                                    <div
                                        style={{
                                            height: 1,
                                            background: 'var(--color-border)',
                                            margin: '10px 0',
                                        }}
                                    />
                                    <button
                                        onClick={logout}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: 10,
                                            border: '1px solid var(--color-border)',
                                            background: 'transparent',
                                            color: 'var(--color-text-muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            cursor: 'pointer',
                                        }}
                                        aria-label="Sign out"
                                    >
                                        <LogOut size={16} />
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                                            Sign out
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div key={location.pathname} className="page-transition">
                        <Outlet />
                    </div>
                </div>
            </main>
            <CommandPalette isOpen={commandOpen} onClose={() => setCommandOpen(false)} />
        </div>
    );
}
