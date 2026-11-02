import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Plus, Sparkles, User, Users, UsersRound } from "lucide-react";
import { Button, Card, ErrorBanner, Field } from "../components/ui";
import { api } from "../lib/api";
import { addDays, dayCount, toIso } from "../lib/format";

const STYLES = [
  { id: "solo", label: "Solo", icon: User },
  { id: "couple", label: "Couple", icon: Heart },
  { id: "group", label: "Friends", icon: UsersRound },
  { id: "family", label: "Family", icon: Users },
];
const PACES = [
  { id: "relaxed", label: "Relaxed", hint: "2–3 stops a day" },
  { id: "balanced", label: "Balanced", hint: "4–5 stops" },
  { id: "packed", label: "Packed", hint: "6+ stops" },
];
const STAYS = [
  { id: "budget", label: "Budget" },
  { id: "comfort", label: "Comfort" },
  { id: "premium", label: "Premium" },
];
const INTERESTS = ["food", "sightseeing", "culture", "history", "adventure", "nature", "art", "shopping", "nightlife", "relaxation"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "AED"];
const MAX_DAYS = 14;

export function defaultPreferences() {
  const today = toIso(new Date());
  return {
    destination: "", start_date: addDays(today, 14), end_date: addDays(today, 17), budget: 1500, currency: "USD",
    travelers: 1, travel_style: "solo", pace: "balanced", accommodation: "comfort", interests: ["food", "sightseeing"], notes: "",
  };
}

function Choice({ selected, onClick, children, hint }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
        selected ? "border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500" : "border-sand-200 bg-white text-slate-600 hover:bg-sand-50"
      }`}
    >
      {children}
      {hint && <span className="block text-xs font-normal text-slate-400">{hint}</span>}
    </button>
  );
}

/** The preferences form, used both for new trips and for editing an existing trip's brief. */
export function PreferencesForm({ initial, onSubmit, busy, error, submitLabel = "Generate itinerary", busyLabel }) {
  const [form, setForm] = useState(() => ({ ...defaultPreferences(), ...initial }));
  const [custom, setCustom] = useState("");

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const days = dayCount(form.start_date, form.end_date);
  const dateProblem = days < 1 ? "The end date is before the start date." : days > MAX_DAYS ? `Trips are limited to ${MAX_DAYS} days.` : "";

  const toggleInterest = (name) =>
    set({ interests: form.interests.includes(name) ? form.interests.filter((i) => i !== name) : [...form.interests, name] });

  function addCustom() {
    const name = custom.trim().toLowerCase();
    if (name && !form.interests.includes(name) && form.interests.length < 12) set({ interests: [...form.interests, name] });
    setCustom("");
  }

  function submit(e) {
    e.preventDefault();
    if (dateProblem) return;
    onSubmit({ ...form, destination: form.destination.trim(), budget: Number(form.budget), travelers: Number(form.travelers) });
  }

  const customInterests = form.interests.filter((i) => !INTERESTS.includes(i));

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-5 p-6">
        <Field label="Where to?">
          <input className="input" required minLength={2} placeholder="Lisbon, Portugal" value={form.destination}
            onChange={(e) => set({ destination: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date"><input className="input" type="date" required value={form.start_date}
            onChange={(e) => set({ start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} /></Field>
          <Field label="End date"><input className="input" type="date" required min={form.start_date} value={form.end_date}
            onChange={(e) => set({ end_date: e.target.value })} /></Field>
        </div>
        {dateProblem ? <p role="alert" className="-mt-2 text-sm text-red-600">{dateProblem}</p>
          : <p className="-mt-2 text-sm text-slate-400">{days} day{days !== 1 && "s"}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Total budget" hint="For the whole group">
            <input className="input" type="number" min="1" step="any" required value={form.budget} onChange={(e) => set({ budget: e.target.value })} />
          </Field>
          <Field label="Currency">
            <select className="input" value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Travelers">
            <input className="input" type="number" min="1" max="30" required value={form.travelers} onChange={(e) => set({ travelers: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-6 p-6">
        <div>
          <span className="label">Who's going?</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STYLES.map(({ id, label, icon: Icon }) => (
              <Choice key={id} selected={form.travel_style === id} onClick={() => set({ travel_style: id })}>
                <Icon className="mb-1 h-5 w-5" />{label}
              </Choice>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Pace</span>
          <div className="grid grid-cols-3 gap-3">
            {PACES.map((p) => <Choice key={p.id} selected={form.pace === p.id} hint={p.hint} onClick={() => set({ pace: p.id })}>{p.label}</Choice>)}
          </div>
        </div>
        <div>
          <span className="label">Where you'll stay</span>
          <div className="grid grid-cols-3 gap-3">
            {STAYS.map((s) => <Choice key={s.id} selected={form.accommodation === s.id} onClick={() => set({ accommodation: s.id })}>{s.label}</Choice>)}
          </div>
        </div>
        <div>
          <span className="label">Interests</span>
          <div className="flex flex-wrap gap-2">
            {[...INTERESTS, ...customInterests].map((name) => {
              const on = form.interests.includes(name);
              return (
                <button key={name} type="button" aria-pressed={on} onClick={() => toggleInterest(name)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium capitalize transition ${
                    on ? "border-brand-500 bg-brand-600 text-white" : "border-sand-200 bg-white text-slate-600 hover:bg-sand-100"}`}>
                  {name}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input max-w-xs" placeholder="Add your own (e.g. jazz)" value={custom} onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
            <Button type="button" variant="secondary" icon={Plus} onClick={addCustom} disabled={!custom.trim()}>Add</Button>
          </div>
        </div>
        <Field label="Anything else?" hint="Dietary needs, mobility, must-see places, things to avoid.">
          <textarea className="input min-h-[88px]" maxLength={1000} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </Card>

      <ErrorBanner>{error}</ErrorBanner>
      <div className="flex items-center justify-end gap-3">
        {busy && <span role="status" className="text-sm text-slate-500">{busyLabel || "Planning your trip. This can take up to a minute with AI…"}</span>}
        <Button type="submit" loading={busy} disabled={!!dateProblem || !form.destination.trim()} icon={Sparkles}>{submitLabel}</Button>
      </div>
    </form>
  );
}

export default function TripBuilder() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(prefs) {
    setBusy(true); setError("");
    try {
      const trip = await api.createTrip(prefs);
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Plan a new trip</h1>
        <p className="mt-1 text-slate-500">The more you tell us, the less you'll need to change.</p>
      </div>
      <PreferencesForm onSubmit={create} busy={busy} error={error} />
    </div>
  );
}
