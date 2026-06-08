import { createClient } from "@supabase/supabase-js";

function readEnvValue(env, key) {
  return String(env?.[key] || "").trim();
}

export function hasServerSupabaseEnv(env = process.env) {
  return Boolean(
    readEnvValue(env, "SUPABASE_URL") &&
      readEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export function createServerSupabaseClient(env = process.env) {
  if (!hasServerSupabaseEnv(env)) {
    return null;
  }

  return createClient(
    readEnvValue(env, "SUPABASE_URL"),
    readEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function createBrowserSupabaseClient({ url, anonKey } = {}) {
  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}
