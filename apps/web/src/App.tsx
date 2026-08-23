import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ToastContainer';
import { NotificationProvider } from '@/contexts/NotificationContext';
import './index.css';

const JobsListPage = lazy(() => import('@/pages/JobsListPage'));
const JobDetailsPage = lazy(() => import('@/pages/JobDetailsPage'));
const CandidateListPage = lazy(() => import('@/pages/CandidateListPage'));
const AllCandidatesPage = lazy(() => import('@/pages/AllCandidatesPage'));
const CandidateDetailsPage = lazy(() => import('@/pages/CandidateDetailsPage'));
const InterviewsPage = lazy(() => import('@/pages/InterviewsPage'));
const InterviewDetailsPage = lazy(() => import('@/pages/InterviewDetailsPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));

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

function HomeRoute() {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading)
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner spinner--lg" />
            </div>
        );
    return isAuthenticated ? <Navigate to="/jobs" replace /> : <LandingPage />;
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <Suspense
                            fallback={
                                <div className="min-h-screen flex items-center justify-center">
                                    <div className="spinner spinner--lg" />
                                </div>
                            }
                        >
                            <Routes>
                                <Route path="/" element={<HomeRoute />} />
                                <Route path="/contact" element={<ContactPage />} />
                                <Route path="/terms" element={<TermsPage />} />
                                <Route path="/privacy" element={<PrivacyPage />} />
                                <Route
                                    path="/login"
                                    element={
                                        <PublicRoute>
                                            <LoginPage />
                                        </PublicRoute>
                                    }
                                />
                                <Route
                                    path="/forgot-password"
                                    element={
                                        <PublicRoute>
                                            <ForgotPasswordPage />
                                        </PublicRoute>
                                    }
                                />
                                <Route
                                    path="/reset-password"
                                    element={
                                        <PublicRoute>
                                            <ResetPasswordPage />
                                        </PublicRoute>
                                    }
                                />
                                <Route path="/" element={<ProtectedRoute />}>
                                    <Route element={<Layout />}>
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
                                        <Route path="interviews" element={<InterviewsPage />} />
                                        <Route
                                            path="interviews/:interviewId"
                                            element={<InterviewDetailsPage />}
                                        />
                                        <Route path="settings" element={<SettingsPage />} />
                                        <Route path="analytics" element={<AnalyticsPage />} />
                                        <Route path="404" element={<NotFoundPage />} />
                                    </Route>
                                </Route>
                                <Route path="*" element={<NotFoundPage />} />
                            </Routes>
                        </Suspense>
                        <ToastContainer />
                    </NotificationProvider>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}
