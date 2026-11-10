// The two public Supabase settings. They live in platform/.env.local (never in the repo).
// The publishable key (or the older "anon" key) is safe in the browser: row-level security protects the data.

export function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing. Add it to platform/.env.local (see .env.example).");
  return url;
}

export function supabaseKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Add it to platform/.env.local (see .env.example).");
  return key;
}
