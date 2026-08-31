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
  // TEMPORARY diagnostic logging while chasing a "gets stuck" report —
  // remove once resolved.
  const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);
  const start = Date.now();
  console.log("[fetch] start:", url);

  const controller = new AbortController();
  const abortTimeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Bug fixed here: this timer's id used to go uncaptured, so only the
  // abort timer above ever got cleared. Once the real fetch already won
  // the race, this one kept running anyway and fired its console.log (and
  // a reject() that Promise.race just silently ignores, since it had
  // already settled) a full REQUEST_TIMEOUT_MS later regardless — which is
  // exactly what produced a wall of misleading "TIMED OUT" lines in the
  // logs for requests that had already succeeded. Harmless to the actual
  // request, but very misleading diagnostically. Capturing and clearing it
  // alongside the abort timer fixes both.
  let rejectTimeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<Response>((_, reject) => {
    rejectTimeoutId = setTimeout(() => {
      console.log(`[fetch] TIMED OUT after ${Date.now() - start}ms:`, url);
      reject(new Error("Request timed out. Check your connection and try again."));
    }, REQUEST_TIMEOUT_MS);
  });

  return Promise.race([fetch(input, { ...init, signal: controller.signal }), timeout])
    .then((res) => {
      console.log(`[fetch] done in ${Date.now() - start}ms:`, url);
      return res;
    })
    .finally(() => {
      clearTimeout(abortTimeoutId);
      clearTimeout(rejectTimeoutId);
    });
}

// A real (working) AsyncStorage read/write on-device normally takes low
// single-digit milliseconds, so this has generous margin without being the
// multi-second stall it was — now that a timeout falls back to a mirror
// that's actually correct (see memoryMirror below) rather than a lossy
// guess, there's no upside to waiting any longer than this on a call that's
// going to hang anyway.
const STORAGE_TIMEOUT_MS = 400;
const TIMED_OUT = Symbol("storage-timed-out");

// A simple in-memory mirror of whatever's been read/written through this
// wrapper. This matters for more than just responsiveness: @supabase/auth-js
// re-reads storage from scratch on *every single* getSession() call — it
// never trusts an in-memory session (see GoTrueClient's __loadSession,
// which unconditionally awaits storage before doing anything else) — and
// getSession() is what every authenticated query calls first to attach a
// token. On this device every AsyncStorage call has been observed to hang
// rather than fail fast, so without this mirror, our timeout fallback
// returning null would make every query *after the first* look logged-out
// to Supabase and get sent with the anon key instead of the real user's
// token — explaining both the multi-second stall on every screen change
// (waiting out the guaranteed timeout) and queries silently coming back
// empty afterward (RLS correctly treating an anon-keyed request as
// unauthenticated). Falling back to this mirror instead of null on a
// timeout fixes that without needing AsyncStorage to actually work.
const memoryMirror = new Map<string, string>();

function raceStorage<T>(real: Promise<T>, label: string): Promise<T | typeof TIMED_OUT> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`[storage] ${label} TIMED OUT`);
      resolve(TIMED_OUT);
    }, STORAGE_TIMEOUT_MS);
  });
  return Promise.race([real, timeout]).finally(() => clearTimeout(timeoutId));
}

const timeoutSafeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const result = await raceStorage(AsyncStorage.getItem(key), `getItem(${key})`);
    if (result === TIMED_OUT) {
      return memoryMirror.has(key) ? memoryMirror.get(key)! : null;
    }
    if (result !== null) {
      memoryMirror.set(key, result);
    } else {
      memoryMirror.delete(key);
    }
    return result;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    // Set eagerly, not only after the real write settles — a caller that
    // reads this key again immediately (as getSession() does constantly)
    // should see the value it just wrote even if the underlying storage
    // write itself is one of the ones that hangs.
    memoryMirror.set(key, value);
    await raceStorage(AsyncStorage.setItem(key, value), `setItem(${key})`);
  },
  removeItem: async (key: string): Promise<void> => {
    memoryMirror.delete(key);
    await raceStorage(AsyncStorage.removeItem(key), `removeItem(${key})`);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: timeoutSafeStorage,
    // Off, not the default true. This runs on a background timer (roughly
    // every few seconds) that reads storage every tick to check whether the
    // token needs refreshing. On-device logs showed *every* storage read
    // timing out on this device, and with the timer re-triggering one
    // before the last had even given up, that piled up an ever-growing
    // stack of pending 5s timers, bogging down the JS thread. We don't lose
    // correctness by turning it off — every request already checks/
    // refreshes the token on demand via _getAccessToken when it's actually
    // used; this only removes the redundant proactive background polling.
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
// as a last-resort recovery path — see the comment on signOut there). Goes
// through the same timeoutSafeStorage.removeItem as everything else, not
// raw AsyncStorage, so the in-memory mirror above gets cleared too —
// otherwise a stale session would keep coming back from the mirror on the
// next getItem even after "signing out".
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;

export function clearStoredSession(): Promise<void> {
  return timeoutSafeStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
}
