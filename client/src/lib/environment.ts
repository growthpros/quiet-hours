// Which database this copy of the app is using. Previews (and local
// development) use the test project; the live app uses the real one.
// The "Test version" strip keys off this rather than the web address,
// because the database is what decides whether you're looking at real data.

/** The test project (quiet-hours-test), from CLAUDE.md. */
export const TEST_PROJECT_REF = "kavamvoavpecwsmozaij";
export const LIVE_APP_URL = "https://quiet-hours-chi-ruby.vercel.app";

export function isTestDatabase(supabaseUrl: string | undefined | null): boolean {
  if (!supabaseUrl) return false;
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] === TEST_PROJECT_REF;
  } catch (e) {
    // A malformed address can't be the test project; the app logs the
    // missing or broken setting separately in lib/supabase.ts.
    console.warn("Couldn't read the Supabase address", e);
    return false;
  }
}

export const IS_TEST_DATABASE = isTestDatabase(import.meta.env.VITE_SUPABASE_URL as string | undefined);
