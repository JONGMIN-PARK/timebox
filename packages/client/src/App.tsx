import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { SocketProvider } from "@/lib/SocketProvider";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";
import JoinProjectPage from "@/pages/JoinProjectPage";
import ErrorBoundary from "@/components/ErrorBoundary";

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
          path="/app/join"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <JoinProjectPage />
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <DashboardPage />
              </SocketProvider>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
