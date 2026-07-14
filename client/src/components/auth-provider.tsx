import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Capture Supabase's callback params from the URL AT MODULE LOAD, before any
// router or component code has a chance to rewrite the URL. This runs the
// moment this module is imported (which happens in main.tsx before React
// mounts), which is early enough to catch:
//   /?code=abc123          (PKCE flow, query string on the path)
//   /#access_token=abc123  (implicit flow, in the hash)
// We then rewrite the URL to a clean /#/ so the hash router mounts cleanly,
// and we exchange the captured code for a session on mount.
const capturedAuthParams: {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
} = {
  code: null,
  accessToken: null,
  refreshToken: null,
  error: null,
  errorDescription: null,
};

(function captureAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const { search, hash, origin, pathname } = window.location;

  // PKCE flow: /?code=... on the path.
  if (search) {
    const params = new URLSearchParams(search);
    const code = params.get("code");
    const err = params.get("error");
    const errDesc = params.get("error_description");
    if (code) capturedAuthParams.code = code;
    if (err) capturedAuthParams.error = err;
    if (errDesc) capturedAuthParams.errorDescription = errDesc;
  }

  // Implicit flow or error: /#access_token=..., /#error=...
  // Also handles nested hash+query like /#/?code=... just in case.
  if (hash && hash.length > 1) {
    // Strip leading #, then also strip leading / and ? if present (hash router prefix).
    let hashBody = hash.slice(1);
    if (hashBody.startsWith("/")) hashBody = hashBody.slice(1);
    if (hashBody.startsWith("?")) hashBody = hashBody.slice(1);
    const params = new URLSearchParams(hashBody);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const code = params.get("code");
    const err = params.get("error");
    const errDesc = params.get("error_description");
    if (accessToken) capturedAuthParams.accessToken = accessToken;
    if (refreshToken) capturedAuthParams.refreshToken = refreshToken;
    if (code && !capturedAuthParams.code) capturedAuthParams.code = code;
    if (err && !capturedAuthParams.error) capturedAuthParams.error = err;
    if (errDesc && !capturedAuthParams.errorDescription)
      capturedAuthParams.errorDescription = errDesc;
  }

  // If we found anything, clean up the URL so the router doesn't get confused
  // and so a refresh doesn't re-trigger the exchange.
  const foundSomething =
    capturedAuthParams.code ||
    capturedAuthParams.accessToken ||
    capturedAuthParams.error;
  if (foundSomething) {
    window.history.replaceState({}, "", `${origin}${pathname}#/`);
  }
})();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // If we captured an error from the callback, surface it and skip the exchange.
      if (capturedAuthParams.error) {
        setAuthError(
          capturedAuthParams.errorDescription ||
            capturedAuthParams.error ||
            "Sign-in failed",
        );
      }

      // If we have a code from the PKCE flow, exchange it for a session.
      if (capturedAuthParams.code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            capturedAuthParams.code,
          );
          if (!cancelled) {
            if (error) {
              setAuthError(error.message);
            } else if (data.session) {
              setSession(data.session);
            }
          }
        } catch (e) {
          if (!cancelled) {
            setAuthError(
              e instanceof Error ? e.message : "Sign-in exchange failed",
            );
          }
        } finally {
          // Zero out the code so a re-render doesn't try to reuse it.
          capturedAuthParams.code = null;
        }
      }

      // If we have tokens from the implicit flow, set the session directly.
      if (capturedAuthParams.accessToken && capturedAuthParams.refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: capturedAuthParams.accessToken,
            refresh_token: capturedAuthParams.refreshToken,
          });
          if (!cancelled) {
            if (error) {
              setAuthError(error.message);
            } else if (data.session) {
              setSession(data.session);
            }
          }
        } catch (e) {
          if (!cancelled) {
            setAuthError(
              e instanceof Error ? e.message : "Sign-in failed",
            );
          }
        } finally {
          capturedAuthParams.accessToken = null;
          capturedAuthParams.refreshToken = null;
        }
      }

      // Read any existing session (e.g., user came back after previously signing in).
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession((prev) => prev ?? data.session);
        setLoading(false);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!cancelled) setSession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail: async (email: string) => {
      // Send Supabase's redirect to the app's root (no hash, no query). The
      // module-load capture above will pull the code param out and rewrite the
      // URL to /#/ before the hash router runs.
      const redirectTo = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      return { error: error ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  // Expose auth error to consumers via the sign-in page pattern in future;
  // for now, log to console so it's visible in DevTools.
  if (authError) {
    // eslint-disable-next-line no-console
    console.error("[auth] callback error:", authError);
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
