import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your Supabase project's values."
  );
}

// Exported so callers (e.g. auth-context's own safety timers) can wait
// strictly longer than this before giving up — otherwise a caller-side
// timeout that fires first can let a *new* auth action start while the old
// one is still legitimately in flight underneath, and since supabase-js
// serializes all auth operations through one internal lock, the new one
// then queues up behind the old one instead of running, adding another
// full timeout's worth of wait on top instead of replacing it.
export const REQUEST_TIMEOUT_MS = 15000;

// Every request the client makes — auth, queries, RPCs — goes through this
// fetch. Without a timeout, a stalled connection leaves a promise pending
// forever with no error, which shows up as a screen stuck on a spinner with
// nothing to retry.
//
// This races the real fetch against a timer that *rejects* on its own,
// rather than only calling AbortController.abort() and hoping the fetch
// promise responds to it — on-device testing showed the abort alone doesn't
// reliably cancel a stalled request on React Native, which left it hanging
// well past the intended timeout. The race guarantees this function itself
// settles on time regardless of whether the underlying request ever does;
// the abort call is kept alongside it purely to stop wasting the
// connection when it does work.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const timeout = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), REQUEST_TIMEOUT_MS);
  });

  return Promise.race([fetch(input, { ...init, signal: controller.signal }), timeout]).finally(() =>
    clearTimeout(timeoutId)
  );
}

const STORAGE_TIMEOUT_MS = 5000;

// supabase-js reads/writes the session through this on every auth call
// before it ever gets to fetch — so if AsyncStorage itself hangs (a stuck
// native-module bridge call, not a network issue), every fix aimed at the
// network layer is powerless, since fetch never even gets invoked. This
// wraps every call with the same guaranteed-to-settle pattern used for
// fetch: getItem falls back to null (treated as "no stored session") and
// set/removeItem just give up quietly, rather than leaving the caller
// pending forever.
function raceStorage<T>(real: Promise<T>, fallback: T, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`[storage] ${label} TIMED OUT, falling back:`, fallback);
      resolve(fallback);
    }, STORAGE_TIMEOUT_MS);
  });
  // Clearing the timer once either side settles matters more here than it
  // did for fetch: this storage wrapper gets called repeatedly by
  // supabase-js's background auto-refresh timer, so leaving a stray 5s
  // timer running on every call (even ones that resolved instantly) piles
  // up over time and can bog down the JS thread on its own.
  return Promise.race([real, timeout]).finally(() => clearTimeout(timeoutId));
}

const timeoutSafeStorage = {
  getItem: (key: string) => raceStorage(AsyncStorage.getItem(key), null, `getItem(${key})`),
  setItem: (key: string, value: string) => raceStorage(AsyncStorage.setItem(key, value), undefined, `setItem(${key})`),
  removeItem: (key: string) => raceStorage(AsyncStorage.removeItem(key), undefined, `removeItem(${key})`),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: timeoutSafeStorage,
    // Off, not the default true. This runs on a background timer (roughly
    // every few seconds) that reads storage every tick to check whether the
    // token needs refreshing. On-device logs showed *every* storage read
    // timing out on this device, and with the timer re-triggering one
    // before the last had even given up, that piled up an ever-growing
    // stack of pending 5s timers — which was almost certainly why taps
    // (like the drawer's close button) started feeling unresponsive: not a
    // touch-handling bug, just the JS thread bogged down by all of it.
    // We don't lose correctness by turning it off — every request already
    // checks/refreshes the token on demand via _getAccessToken when it's
    // actually used, this only removes the redundant proactive polling.
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

// The AsyncStorage key supabase-js stores the session under (it derives this
// itself internally; duplicated here so auth-context can clear it directly
// as a last-resort recovery path — see the comment on signOut there).
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;
