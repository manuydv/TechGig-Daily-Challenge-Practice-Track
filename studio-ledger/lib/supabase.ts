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

const REQUEST_TIMEOUT_MS = 15000;

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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
