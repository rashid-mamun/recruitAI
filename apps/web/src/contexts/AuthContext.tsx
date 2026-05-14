import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getMe,
    login as loginService,
    register as registerService,
    logout as logoutService,
    getToken as getStoredToken,
} from '../services/auth';
import type { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: async () => {},
    register: async () => {},
    logout: () => {},
    isAuthenticated: false,
    isLoading: true,
});

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
                    logoutService(false);
                    setUser(null);
                    if (location.pathname !== '/login') {
                        navigate('/login');
                    }
                }
            } else if (location.pathname !== '/login') {
                navigate('/login');
            }
            setIsLoading(false);
        };

        initAuth();
    }, [navigate]);

    const login = async (email: string, password: string) => {
        const profile = await loginService(email, password);
        setUser(profile);
        navigate('/');
    };

    const register = async (name: string, email: string, password: string) => {
        const profile = await registerService(name, email, password);
        setUser(profile);
        navigate('/');
    };

    const logout = () => {
        logoutService(true);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{ user, login, register, logout, isAuthenticated: !!user, isLoading }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
