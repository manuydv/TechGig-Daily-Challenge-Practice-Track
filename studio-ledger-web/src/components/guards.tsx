import { Navigate, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";

/** Wraps /login and /signup: bounces a signed-in user straight into the app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Gate for every screen under the main app shell: needs a session AND a studio. */
export function RequireApp() {
  const { session, staffUser, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!staffUser) return <Navigate to="/create-studio" replace />;
  return <Outlet />;
}
