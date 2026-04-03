import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";
import ErrorBoundary from "@/components/ErrorBoundary";

const UserManualPage = lazy(() => import("@/pages/UserManualPage"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuthStore();
  if (!authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { authenticated } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={authenticated ? <Navigate to="/app" replace /> : <LandingPage />}
        />
        <Route
          path="/login"
          element={authenticated ? <Navigate to="/app" replace /> : <LoginPage />}
        />
        <Route
          path="/app/manual"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
                <UserManualPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
