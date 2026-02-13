import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.error("Supabase error: SUPABASE_URL is missing in environment variables.");
    throw new Error("Missing env: SUPABASE_URL");
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("Supabase error: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.");
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  }

  // Basic URL validation to catch obvious mistakes
  if (!url.startsWith("http")) {
    throw new Error("Invalid env: SUPABASE_URL must start with http/https");
  }

  _supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _supabaseAdmin;
}
