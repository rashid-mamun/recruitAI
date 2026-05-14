import { api } from './api';
import type { User } from '@/types';

const TOKEN_KEY = 'recruit-ai-token';
const LEGACY_TOKEN_KEY = 'token';

function normalizeUser(payload: any): User {
    const user = payload?.user ?? payload?.data?.user ?? payload?.data ?? payload ?? null;
    if (!user) {
        return { id: '', name: '', email: '' } as User;
    }

    return {
        id: user.id || user._id || '',
        name: user.name || '',
        email: user.email || '',
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
    const user = normalizeUser(res.data);

    if (!token) {
        throw new Error('Authentication failed');
    }

    localStorage.setItem(TOKEN_KEY, token);
    return user;
}

export async function register(name: string, email: string, password: string): Promise<User> {
    const res = await api.post('/api/auth/register', { name, email, password });
    const token = res.data?.token ?? res.data?.data?.token;
    const user = normalizeUser(res.data);

    if (!token) {
        throw new Error('Registration failed');
    }

    localStorage.setItem(TOKEN_KEY, token);
    return user;
}

export async function getMe(): Promise<User> {
    const res = await api.get('/api/auth/me');
    return normalizeUser(res.data);
}

export function logout(redirect = true) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (redirect) {
        window.location.href = '/login';
    }
}
