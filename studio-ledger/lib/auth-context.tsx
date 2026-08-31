import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, SUPABASE_AUTH_STORAGE_KEY, REQUEST_TIMEOUT_MS } from "@/lib/supabase";
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

  // Clears the locally stored session directly, bypassing supabase-js's own
  // auth methods. Every one of those (signOut, signIn, getSession, ...)
  // serializes through a single internal lock; if one call to it never
  // resolves (e.g. a background token refresh stalls on a bad network), the
  // lock stays "held" forever and every later auth call queues up behind it
  // indefinitely, with no error — confirmed on-device (signOut logged that
  // it was called, then never logged a result). Writing straight to
  // AsyncStorage and resetting local state sidesteps that lock entirely.
  const clearLocalSession = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    } catch (err) {
      console.log("[auth-context] clearLocalSession: storage clear threw", err);
    }
    setSession(null);
    setStaffUser(null);
    setStudio(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let settled = false;

    // supabase-js's getSession() can refresh a stale token over the network
    // with no built-in timeout, so a flaky connection (or the internal lock
    // issue described on clearLocalSession above) can otherwise leave the
    // app stuck on the loading screen forever. This safety net gives up on
    // the initial load and proactively clears whatever session is stored —
    // if that stored session is what's causing the hang, leaving it in
    // place would just cause the exact same hang on every future launch.
    //
    // This MUST wait longer than REQUEST_TIMEOUT_MS (lib/supabase.ts), not
    // less. supabase-js serializes every auth call through one internal
    // lock; if we give up here before the underlying getSession() call has
    // actually finished (which is guaranteed by REQUEST_TIMEOUT_MS, just
    // not any sooner), the lock is still held when the login screen lets
    // the user sign in, so that sign-in silently queues up behind the
    // still-running original call instead of running — and then whatever
    // the user does after signing in queues up behind *that*. Confirmed
    // on-device: an 8s timer here (shorter than the 15s fetch timeout)
    // produced exactly this cascade. Waiting past REQUEST_TIMEOUT_MS
    // guarantees the lock is free before we ever offer a new action.
    const safetyTimer = setTimeout(() => {
      if (mounted && !settled) {
        settled = true;
        console.log("[auth-context] initial session check timed out; clearing local session");
        clearLocalSession().finally(() => {
          if (mounted) setLoading(false);
        });
      }
    }, REQUEST_TIMEOUT_MS + 3000);

    const finishInitialLoad = () => {
      settled = true;
      clearTimeout(safetyTimer);
      if (mounted) setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        await loadStaffUser(data.session?.user.id);
        finishInitialLoad();
      })
      .catch(() => finishInitialLoad());

    // NOT async, and deliberately doesn't await loadStaffUser directly.
    //
    // Root cause of the hangs traced all the way through: supabase-js
    // awaits every onAuthStateChange listener (via _notifyAllSubscribers)
    // from *inside* the lock-guarded call that triggered the event (sign
    // in/out, token refresh) — before that call releases its lock. Calling
    // any supabase.from()/rpc() here (which needs a fresh-token check, i.e.
    // another lock acquisition) therefore deadlocks: the nested call waits
    // for the triggering operation to finish, which is itself waiting for
    // this callback to return first. No network or storage timeout can
    // catch this — it's two in-memory promises waiting on each other.
    // Confirmed by reading @supabase/auth-js's source (GoTrueClient's
    // _acquireLock/_notifyAllSubscribers); this is a known supabase-js
    // gotcha, not specific to this app. Deferring the real work to a
    // separate macrotask lets this callback (and therefore the lock) return
    // first, so the deferred call acquires a free lock instead of queuing
    // behind itself.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      console.log("[auth-context] onAuthStateChange:", _event);
      setSession(nextSession);
      setTimeout(() => {
        loadStaffUser(nextSession?.user.id).finally(finishInitialLoad);
      }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.subscription.unsubscribe();
    };
  }, [loadStaffUser, clearLocalSession]);

  const refreshStaffUser = useCallback(async () => {
    await loadStaffUser(session?.user.id);
  }, [loadStaffUser, session?.user.id]);

  const refreshStudio = useCallback(async () => {
    await loadStudio(staffUser?.studio_id);
  }, [loadStudio, staffUser?.studio_id]);

  const signIn = useCallback(async (email: string, password: string) => {
    console.log("[auth-context] signIn: called");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("[auth-context] signIn: settled, error =", error?.message ?? null);
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
    console.log("[auth-context] signOut: called");
    // See clearLocalSession's comment: supabase.auth.signOut() itself can
    // hang forever if the client's internal lock is stuck, so it's not
    // called (or awaited) on the critical path anymore. Best-effort fire it
    // in the background in case the lock isn't actually stuck this time, so
    // the refresh token gets revoked server-side — but nothing waits on it.
    supabase.auth.signOut().catch(() => {});
    await clearLocalSession();
    console.log("[auth-context] signOut: local state cleared");
  }, [clearLocalSession]);

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
