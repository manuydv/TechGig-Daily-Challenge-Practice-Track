import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values."
  );
}

// The browser's localStorage (supabase-js's default web storage) is
// synchronous and reliable, unlike React Native's AsyncStorage bridge on the
// mobile app — none of that project's timeout/mirror workarounds are needed
// here.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
