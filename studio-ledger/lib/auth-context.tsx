import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { StaffUser, Studio } from "@/types/database";

interface AuthContextValue {
  session: Session | null;
  staffUser: StaffUser | null;
  studio: Studio | null;
  loading: boolean;
  refreshStaffUser: () => Promise<void>;
  refreshStudio: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStudio = useCallback(async (studioId: string | undefined) => {
    if (!studioId) {
      setStudio(null);
      return;
    }
    const { data, error } = await supabase.from("studios").select("*").eq("id", studioId).maybeSingle();
    if (error) {
      console.warn("Failed to load studio", error.message);
      setStudio(null);
      return;
    }
    setStudio(data);
  }, []);

  const loadStaffUser = useCallback(
    async (userId: string | undefined) => {
      if (!userId) {
        setStaffUser(null);
        setStudio(null);
        return;
      }
      const { data, error } = await supabase.from("staff_users").select("*").eq("id", userId).maybeSingle();
      if (error) {
        console.warn("Failed to load staff user", error.message);
        setStaffUser(null);
        setStudio(null);
        return;
      }
      setStaffUser(data);
      await loadStudio(data?.studio_id);
    },
    [loadStudio]
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadStaffUser(data.session?.user.id);
      if (mounted) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await loadStaffUser(nextSession?.user.id);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadStaffUser]);

  const refreshStaffUser = useCallback(async () => {
    await loadStaffUser(session?.user.id);
  }, [loadStaffUser, session?.user.id]);

  const refreshStudio = useCallback(async () => {
    await loadStudio(staffUser?.studio_id);
  }, [loadStudio, staffUser?.studio_id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return {
      error: error?.message ?? null,
      needsEmailConfirmation: !error && !data.session,
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      staffUser,
      studio,
      loading,
      refreshStaffUser,
      refreshStudio,
      signIn,
      signUp,
      signOut,
    }),
    [session, staffUser, studio, loading, refreshStaffUser, refreshStudio, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
