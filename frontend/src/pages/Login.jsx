import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Brand } from "../components/Layout";
import { Button, Card, ErrorBanner, Field } from "../components/ui";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, supabaseConfigured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const { data, error: err } = await (mode === "signin" ? signIn : signUp)(email, password);
    setBusy(false);
    if (err) setError(err.message);
    else if (mode === "signup" && !data.session) setNotice("Check your inbox to confirm your email, then sign in.");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Brand /></div>
        <Card className="p-6">
          <h1 className="text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">Plan trips in seconds, keep them forever.</p>
          {!supabaseConfigured ? (
            <div className="mt-4"><ErrorBanner>
              The backend requires sign-in but this build has no Supabase keys. Set VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY in frontend/.env and restart.
            </ErrorBanner></div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Field label="Email">
                <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <input className="input" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <ErrorBanner>{error}</ErrorBanner>
              {notice && <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>}
              <Button type="submit" loading={busy} className="w-full">{mode === "signin" ? "Sign in" : "Sign up"}</Button>
            </form>
          )}
        </Card>
        {supabaseConfigured && (
          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
