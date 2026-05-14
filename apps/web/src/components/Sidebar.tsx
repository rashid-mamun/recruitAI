import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    LogIn as LogInIcon,
    ChevronLeft as ChevronLeftIcon,
    Briefcase as BriefcaseIcon,
    Users as UsersIcon,
    Activity as ActivityIcon,
    Globe as GlobeIcon,
    ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getJobs, getCandidates, api } from '../services/api';
import type { ApiSuccess, QueueStats as QueueStatsType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    badge?: number;
    active?: boolean;
    collapsed: boolean;
    onClick: () => void;
    external?: boolean;
}

const NavItem = ({ icon, label, badge, active, collapsed, onClick, external }: NavItemProps) => {
    return (
        <button
            className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
            onClick={onClick}
        >
            <div className="nav-icon-box">{icon}</div>
            {!collapsed && <div className="nav-label">{label}</div>}
            {!collapsed && badge !== undefined && <div className="nav-badge">{badge}</div>}
            {!collapsed && external && <ExternalLink size={14} className="nav-ext-icon" />}
        </button>
    );
};

const NavItemWrapper = ({
    children,
    collapsed,
    tooltip,
}: {
    children: React.ReactNode;
    collapsed: boolean;
    tooltip: string;
}) => {
    return (
        <div className="nav-item-wrapper">
            {children}
            {collapsed && <div className="sb-tooltip">{tooltip}</div>}
        </div>
    );
};

const QueueRow = ({
    dot,
    label,
    count,
    pulse,
}: {
    dot: string;
    label: string;
    count: number;
    pulse?: boolean;
}) => {
    return (
        <div className="queue-row">
            <div className={`q-dot ${pulse ? 'pulse' : ''}`} style={{ background: dot }} />
            <div className="q-label">{label}</div>
            <div className="q-count">{count}</div>
        </div>
    );
};

interface SidebarProps {
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (val: boolean) => void;
    setUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({
    mobileMenuOpen,
    setMobileMenuOpen,
    setUserMenuOpen,
}: SidebarProps) {
    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem('sidebar-collapsed') === 'true';
    });
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        localStorage.setItem('sidebar-collapsed', String(next));
    };

    const isJobs = location.pathname.startsWith('/jobs');
    const isCandidates = location.pathname.startsWith('/candidates');

    // Queries
    const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: () => getJobs() });
    const { data: candidatesRes } = useQuery({
        queryKey: ['candidates'],
        queryFn: () => getCandidates(),
    });
    const { data: queueData } = useQuery<QueueStatsType[]>({
        queryKey: ['queue-stats'],
        queryFn: async () => {
            const res = await api.get<ApiSuccess<QueueStatsType[]>>('/api/queue-stats');
            return res.data.data;
        },
        refetchInterval: 10_000,
    });

    const activeJobCount = jobs?.length || 0;
    const totalCandidates = candidatesRes?.pagination?.total || 0;

    const activeCount = queueData?.reduce((sum, q) => sum + q.active, 0) ?? 0;
    const waitingCount = queueData?.reduce((sum, q) => sum + q.waiting, 0) ?? 0;
    const failedCount = queueData?.reduce((sum, q) => sum + q.failed, 0) ?? 0;

    const initials = user?.name?.charAt(0) || 'U';

    const openUserMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setUserMenuOpen((v: boolean) => !v);
    };

    return (
        <>
            <div
                className={`sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
            />
            <aside
                className={`sidebar ${collapsed ? 'collapsed' : 'expanded'} ${mobileMenuOpen ? 'mobile-open' : ''}`}
            >
                <div className="sb-top">
                    <div className="logo-row">
                        <div className="logo-icon">
                            <LogInIcon size={14} color="#fff" />
                        </div>
                        {!collapsed && <span className="logo-text">RecruitAI</span>}
                    </div>
                    <button
                        className="collapse-btn"
                        onClick={toggleCollapsed}
                        aria-label="Toggle sidebar"
                    >
                        <ChevronLeftIcon
                            size={12}
                            style={{
                                transform: collapsed ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.25s',
                            }}
                        />
                    </button>
                </div>

                <div className="sb-body">
                    {!collapsed && <div className="section-label">Menu</div>}
                    <NavItemWrapper collapsed={collapsed} tooltip="Jobs">
                        <NavItem
                            icon={<BriefcaseIcon size={16} />}
                            label="Jobs"
                            badge={activeJobCount}
                            active={isJobs}
                            collapsed={collapsed}
                            onClick={() => {
                                setMobileMenuOpen(false);
                                navigate('/jobs');
                            }}
                        />
                    </NavItemWrapper>

                    <NavItemWrapper collapsed={collapsed} tooltip="All candidates">
                        <NavItem
                            icon={<UsersIcon size={16} />}
                            label="All candidates"
                            badge={totalCandidates}
                            active={isCandidates}
                            collapsed={collapsed}
                            onClick={() => {
                                setMobileMenuOpen(false);
                                navigate('/candidates');
                            }}
                        />
                    </NavItemWrapper>

                    <div className="sb-divider" />

                    {!collapsed && <div className="section-label">System</div>}
                    <NavItemWrapper collapsed={collapsed} tooltip="Queue monitor">
                        <NavItem
                            icon={<ActivityIcon size={16} />}
                            label="Queue monitor"
                            external
                            onClick={() =>
                                window.open('http://localhost:5000/admin/queues', '_blank')
                            }
                            collapsed={collapsed}
                        />
                    </NavItemWrapper>

                    <NavItemWrapper collapsed={collapsed} tooltip="API docs">
                        <NavItem
                            icon={<GlobeIcon size={16} />}
                            label="API docs"
                            external
                            onClick={() => window.open('http://localhost:5000/api-docs', '_blank')}
                            collapsed={collapsed}
                        />
                    </NavItemWrapper>
                </div>

                <div className="sb-footer">
                    {!collapsed && (
                        <div className="queue-section">
                            <div className="queue-title">Queue health</div>
                            <QueueRow dot="#10b981" label="Active" count={activeCount} />
                            <QueueRow
                                dot={waitingCount > 0 ? '#f59e0b' : '#2a2a3a'}
                                label="Waiting"
                                count={waitingCount}
                            />
                            <QueueRow
                                dot={failedCount > 0 ? '#ef4444' : '#2a2a3a'}
                                label="Failed"
                                count={failedCount}
                                pulse={failedCount > 0}
                            />
                        </div>
                    )}

                    <div
                        className={`user-row ${collapsed ? 'collapsed' : ''}`}
                        onClick={openUserMenu}
                        data-user-menu
                    >
                        <div className="user-avatar">{initials}</div>
                        {!collapsed && (
                            <div className="user-info">
                                <div className="user-name">{user?.name || 'User'}</div>
                                <div className="user-email">{user?.email || 'Admin'}</div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
