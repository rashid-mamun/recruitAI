import { api } from './api';
import type { User } from '@/types';

const TOKEN_KEY = 'recruit-ai-token';
const LEGACY_TOKEN_KEY = 'token';
export const REFRESH_TOKEN_KEY = 'recruit-ai-refresh-token';

function normalizeUser(payload: any): User {
    const user = payload?.user ?? payload?.data?.user ?? payload?.data ?? payload ?? null;
    if (!user) {
        return { id: '', name: '', email: '' } as User;
    }

    return {
        id: user.id || user._id || '',
        name: user.name || '',
        email: user.email || '',
        role: user.role,
        workspaceRole: user.workspaceRole,
        defaultOrganizationId: user.defaultOrganizationId ?? null,
        organization: user.organization ?? null,
    };
}

export function getToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    if (token && !localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    return token;
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

export async function login(email: string, password: string): Promise<User> {
    const res = await api.post('/api/auth/login', { email, password });
    const token = res.data?.token ?? res.data?.data?.token;
    const refreshToken = res.data?.refreshToken ?? res.data?.data?.refreshToken;
    const user = normalizeUser(res.data);

    if (!token) {
        throw new Error('Authentication failed');
    }

    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return user;
}

export async function register(name: string, email: string, password: string): Promise<User> {
    const res = await api.post('/api/auth/register', { name, email, password });
    const token = res.data?.token ?? res.data?.data?.token;
    const refreshToken = res.data?.refreshToken ?? res.data?.data?.refreshToken;
    const user = normalizeUser(res.data);

    if (!token) {
        throw new Error('Registration failed');
    }

    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return user;
}

export async function loginWithGoogle(credential: string): Promise<User> {
    const res = await api.post('/api/auth/google', { credential });
    const token = res.data?.token ?? res.data?.data?.token;
    const refreshToken = res.data?.refreshToken ?? res.data?.data?.refreshToken;
    const user = normalizeUser(res.data);

    if (!token) {
        throw new Error('Google authentication failed');
    }

    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return user;
}

export async function getMe(): Promise<User> {
    const res = await api.get('/api/auth/me');
    return normalizeUser(res.data);
}

export async function switchWorkspace(organizationId: string): Promise<User> {
    const res = await api.post('/api/auth/switch-workspace', { organizationId });
    const payload = res.data?.data;
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    return normalizeUser(payload);
}

export async function requestPasswordReset(
    email: string,
): Promise<{ message: string; resetToken?: string }> {
    const res = await api.post('/api/auth/password-reset/request', { email });
    return res.data?.data;
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
    await api.post('/api/auth/password-reset/confirm', { token, password });
}

export async function logout(redirect = true) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
        if (refreshToken) {
            await api.post('/api/auth/logout', { refreshToken });
        }
    } catch {
        // Local logout should still complete if the session is already expired.
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    if (redirect) {
        window.location.href = '/login';
    }
}
