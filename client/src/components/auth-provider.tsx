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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On first mount, clean up Supabase's auth-callback params from the URL.
    // Supabase's magic link lands at /?code=... or /#access_token=... which
    // wouter's hash router doesn't understand, resulting in a 404 render.
    // Supabase's JS client reads these params from window.location on init,
    // so we let it read them, then rewrite the URL back to /#/ .
    const cleanupAuthCallback = () => {
      const { search, hash, origin, pathname } = window.location;
      const hasQueryCode = search.includes("code=") || search.includes("error_code=");
      const hasHashToken =
        hash.includes("access_token=") ||
        hash.includes("error=") ||
        hash.includes("type=magiclink");
      if (hasQueryCode || hasHashToken) {
        // Replace the URL with the clean hash-router home, keeping the base path.
        window.history.replaceState({}, "", `${origin}${pathname}#/`);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      cleanupAuthCallback();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      cleanupAuthCallback();
    });
    return () => subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail: async (email: string) => {
      // Hash-routed app. Send Supabase's redirect back to the root hash so
      // wouter's hash router sees a real path and mounts Today. Supabase
      // appends its own callback params after this; we strip them below.
      const redirectTo = `${window.location.origin}/#/`;
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
