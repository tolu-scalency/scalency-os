// How long someone stays signed in. Supabase's own limits need a paid plan, so the
// app enforces these itself (see proxy.ts).
//
// "Keep me signed in" ticked:   up to 30 days, or 7 days without using the app.
// Not ticked (the default):     until the browser is closed, at most 24 hours,
//                               and 8 hours without using the app.

export const KEEP_COOKIE = "sc_keep"; // "1" when "Keep me signed in" was ticked
export const SEEN_COOKIE = "sc_seen"; // last time this browser used the app (seconds)

export const POLICY = {
  keep: { maxAge: 30 * 86400, idle: 7 * 86400 },
  normal: { maxAge: 24 * 3600, idle: 8 * 3600 },
};

/** A brand new sign-in, so the browser won't have SEEN_COOKIE yet. */
export const FRESH_SIGN_IN = 5 * 60;
