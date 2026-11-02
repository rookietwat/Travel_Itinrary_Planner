import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, cached, setTokenGetter } from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = !!(url && anonKey);

// supabase-js is ~100 kB, so it is only downloaded when a project is configured.
let clientPromise = null;
const loadClient = () => {
  clientPromise ??= import("@supabase/supabase-js").then((m) => m.createClient(url, anonKey));
  return clientPromise;
};

/**
 * Asks the backend whether auth is required. With no Supabase configured the
 * backend runs in demo mode and the app skips the login screen entirely.
 */
export function AuthProvider({ children }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    let cancelled = false;
    api.health()
      .then((h) => !cancelled && setHealth(h))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!configured) return undefined;
    let subscription;
    loadClient().then((sb) => {
      setClient(sb);
      sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
      subscription = sb.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        if (!next) cached.clear(); // never show one user's cached trips to the next
      }).data.subscription;
    });
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    setTokenGetter(async () => {
      if (!configured) return null;
      const sb = await loadClient();
      return (await sb.auth.getSession()).data.session?.access_token ?? null;
    });
  }, []);

  const value = useMemo(() => {
    const authRequired = !!health?.auth;
    return {
      health,
      error,
      loading: (!health && !error) || !ready,
      authRequired,
      supabaseConfigured: configured,
      user: authRequired ? session?.user ?? null : { email: "demo@localhost", demo: true },
      signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
      signUp: (email, password) => client.auth.signUp({ email, password }),
      signOut: () => client?.auth.signOut(),
    };
  }, [health, error, session, ready, client]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
