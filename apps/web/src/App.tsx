import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import JobsListPage from '@/pages/JobsListPage';
import JobDetailsPage from '@/pages/JobDetailsPage';
import CandidateListPage from '@/pages/CandidateListPage';
import AllCandidatesPage from '@/pages/AllCandidatesPage';
import CandidateDetailsPage from '@/pages/CandidateDetailsPage';
import LoginPage from '@/pages/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ToastContainer';
import { NotificationProvider } from '@/contexts/NotificationContext';
import './index.css';

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading)
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner spinner--lg" />
            </div>
        );
    if (isAuthenticated) return <Navigate to="/jobs" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <NotificationProvider>
                    <AuthProvider>
                        <Routes>
                            <Route
                                path="/login"
                                element={
                                    <PublicRoute>
                                        <LoginPage />
                                    </PublicRoute>
                                }
                            />
                            <Route path="/" element={<ProtectedRoute />}>
                                <Route element={<Layout />}>
                                    <Route index element={<Navigate to="/jobs" replace />} />
                                    <Route path="jobs" element={<JobsListPage />} />
                                    <Route path="jobs/:jobId" element={<JobDetailsPage />} />
                                    <Route
                                        path="jobs/:jobId/candidates"
                                        element={<CandidateListPage />}
                                    />
                                    <Route path="candidates" element={<AllCandidatesPage />} />
                                    <Route
                                        path="candidates/:candidateId"
                                        element={<CandidateDetailsPage />}
                                    />
                                    <Route path="404" element={<NotFoundPage />} />
                                </Route>
                            </Route>
                            <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                    </AuthProvider>
                    <ToastContainer />
                </NotificationProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}
