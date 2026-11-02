import { useEffect } from "react";
import { Loader2, X } from "lucide-react";

const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-sand-200 hover:bg-sand-100",
  ghost: "text-slate-600 hover:bg-sand-100",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
};

const base = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition";

export function Button({ variant = "primary", loading = false, icon: Icon, children, className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${base} disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** A link styled as a button, for external destinations such as maps. */
export function LinkButton({ variant = "secondary", icon: Icon, children, className = "", ...props }) {
  return (
    <a {...props} className={`${base} ${variants[variant]} ${className}`}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </a>
  );
}

export const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl border border-sand-200 bg-white shadow-card ${className}`}>{children}</div>
);

const tones = {
  neutral: "bg-sand-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

export const Badge = ({ tone = "neutral", icon: Icon, children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
    {Icon && <Icon className="h-3 w-3" />}
    {children}
  </span>
);

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>
);

export const Spinner = ({ label = "Loading…" }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-24 text-slate-500">
    <Loader2 className="h-5 w-5 animate-spin" /> {label}
  </div>
);

export const ErrorBanner = ({ children }) =>
  children ? (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{children}</div>
  ) : null;

export function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="mx-auto my-6 w-full max-w-3xl rounded-2xl bg-sand-50 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-sand-200"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
