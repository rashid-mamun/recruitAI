import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getMe,
    login as loginService,
    loginWithGoogle as googleLoginService,
    register as registerService,
    logout as logoutService,
    switchWorkspace as switchWorkspaceService,
    getToken as getStoredToken,
} from '../services/auth';
import type { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: async () => {},
    register: async () => {},
    loginWithGoogle: async () => {},
    logout: () => {},
    switchWorkspace: async () => {},
    isAuthenticated: false,
    isLoading: true,
});

const PUBLIC_PATHS = new Set([
    '/',
    '/contact',
    '/privacy',
    '/terms',
    '/forgot-password',
    '/reset-password',
]);

function isPublicPath(pathname: string) {
    return PUBLIC_PATHS.has(pathname);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = getStoredToken();
            if (storedToken) {
                try {
                    const profile = await getMe();
                    setUser(profile);
                } catch (error) {
                    await logoutService(false);
                    setUser(null);
                    if (location.pathname !== '/login') {
                        navigate('/login');
                    }
                }
            } else if (location.pathname !== '/login' && !isPublicPath(location.pathname)) {
                navigate('/login');
            }
            setIsLoading(false);
        };

        initAuth();
    }, [navigate]);

    const login = useCallback(
        async (email: string, password: string) => {
            await loginService(email, password);
            setUser(await getMe());
            navigate('/jobs', { replace: true });
        },
        [navigate],
    );

    const register = useCallback(
        async (name: string, email: string, password: string) => {
            await registerService(name, email, password);
            setUser(await getMe());
            navigate('/jobs', { replace: true });
        },
        [navigate],
    );

    const loginWithGoogle = useCallback(
        async (credential: string) => {
            await googleLoginService(credential);
            setUser(await getMe());
            navigate('/jobs', { replace: true });
        },
        [navigate],
    );

    const logout = useCallback(() => {
        void logoutService(true);
        setUser(null);
    }, []);

    const switchWorkspace = useCallback(
        async (organizationId: string) => {
            await switchWorkspaceService(organizationId);
            setUser(await getMe());
            navigate('/jobs');
        },
        [navigate],
    );

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                register,
                loginWithGoogle,
                logout,
                switchWorkspace,
                isAuthenticated: !!user,
                isLoading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
