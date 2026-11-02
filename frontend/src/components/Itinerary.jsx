import { useState } from "react";
import { Bed, Camera, Car, Check, Clock, ExternalLink, MapPin, Navigation, Pencil, Plus, Sparkles, Trash2, Utensils, X, Zap } from "lucide-react";
import { Button, Card, LinkButton } from "./ui";
import { longDate, money } from "../lib/format";
import { mapsUrl, routeUrl } from "../lib/maps";

export const TYPES = {
  attraction: { label: "Sights", icon: Camera, color: "text-sky-700 bg-sky-50" },
  activity: { label: "Activity", icon: Zap, color: "text-violet-700 bg-violet-50" },
  dining: { label: "Food", icon: Utensils, color: "text-orange-700 bg-orange-50" },
  transport: { label: "Transport", icon: Car, color: "text-slate-700 bg-slate-100" },
  accommodation: { label: "Stay", icon: Bed, color: "text-emerald-700 bg-emerald-50" },
};

export const newActivity = () => ({
  id: `new-${Math.random().toString(36).slice(2, 10)}`, time: "12:00", title: "New activity", type: "activity",
  description: "", location: "", duration_minutes: 60, cost: 0, transport_note: "",
});

const sumCosts = (acts) => acts.reduce((n, a) => n + (Number(a.cost) || 0), 0);

export function budgetBreakdown(itinerary) {
  const byType = {};
  for (const day of itinerary.days) {
    for (const a of day.activities) byType[a.type] = (byType[a.type] || 0) + (Number(a.cost) || 0);
  }
  const lodging = itinerary.lodging.reduce((n, s) => n + (Number(s.price_per_night) || 0) * (Number(s.nights) || 0), 0);
  const rows = [
    { key: "lodging", label: "Lodging", amount: lodging, bar: "bg-emerald-500" },
    { key: "dining", label: "Food", amount: byType.dining || 0, bar: "bg-orange-400" },
    { key: "attraction", label: "Sights", amount: byType.attraction || 0, bar: "bg-sky-500" },
    { key: "activity", label: "Activities", amount: byType.activity || 0, bar: "bg-violet-500" },
    { key: "transport", label: "Transport", amount: (byType.transport || 0) + (byType.accommodation || 0), bar: "bg-slate-400" },
  ];
  return { rows, total: rows.reduce((n, r) => n + r.amount, 0) };
}

export function BudgetCard({ itinerary, budget, currency, travelers }) {
  const { rows, total } = budgetBreakdown(itinerary);
  const over = total > budget;
  const pct = Math.min(100, (total / budget) * 100);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">Estimated cost</h2>
        <span className={`text-sm font-semibold ${over ? "text-red-600" : "text-brand-700"}`}>
          {over ? `${money(total - budget, currency)} over` : `${money(budget - total, currency)} left`}
        </span>
      </div>
      <div className="mt-2 text-3xl font-extrabold">{money(total, currency)}
        <span className="ml-2 text-sm font-medium text-slate-400">of {money(budget, currency)}</span>
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-sand-100" role="img" aria-label={`${Math.round(pct)}% of budget planned`}>
        {rows.map((r) => <div key={r.key} className={r.bar} style={{ width: `${Math.min(100, (r.amount / budget) * 100)}%` }} />)}
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${r.bar}`} />{r.label}</span>
            <span className="font-semibold">{money(r.amount, currency)}</span>
          </li>
        ))}
      </ul>
      {travelers > 1 && <p className="mt-3 border-t border-sand-100 pt-3 text-xs text-slate-500">About {money(total / travelers, currency)} per person</p>}
    </Card>
  );
}

export function LodgingCard({ lodging, currency, readOnly, onChange }) {
  if (!lodging.length) return null;
  const patch = (i, p) => onChange(lodging.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-bold">Where you'll stay</h2>
      <ul className="space-y-4">
        {lodging.map((s, i) => (
          <li key={i} className="text-sm">
            <div className="font-semibold">{s.name}</div>
            {s.area && <div className="text-slate-500">{s.area}</div>}
            {s.why && <p className="mt-1 text-slate-500">{s.why}</p>}
            {readOnly ? (
              <div className="mt-1 text-slate-600">{money(s.price_per_night, currency)} × {s.nights} night{s.nights !== 1 && "s"}</div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input aria-label="Price per night" className="input w-28" type="number" min="0" value={s.price_per_night}
                  onChange={(e) => patch(i, { price_per_night: Number(e.target.value) })} />
                <span className="text-slate-400">×</span>
                <input aria-label="Nights" className="input w-16" type="number" min="1" value={s.nights}
                  onChange={(e) => patch(i, { nights: Math.max(1, Number(e.target.value)) })} />
                <span className="text-slate-500">nights</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivityEditor({ activity, onSave, onCancel }) {
  const [a, setA] = useState(activity);
  const set = (p) => setA((x) => ({ ...x, ...p }));
  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_140px]">
        <input aria-label="Time" className="input" type="time" value={a.time} onChange={(e) => set({ time: e.target.value })} />
        <input aria-label="Title" className="input" value={a.title} onChange={(e) => set({ title: e.target.value })} />
        <select aria-label="Type" className="input" value={a.type} onChange={(e) => set({ type: e.target.value })}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <textarea aria-label="Description" className="input" rows={2} value={a.description} onChange={(e) => set({ description: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input aria-label="Location" className="input" placeholder="Location" value={a.location} onChange={(e) => set({ location: e.target.value })} />
        <input aria-label="Cost" className="input" type="number" min="0" step="any" value={a.cost} onChange={(e) => set({ cost: Number(e.target.value) })} />
        <input aria-label="Duration in minutes" className="input" type="number" min="0" max="1440" value={a.duration_minutes}
          onChange={(e) => set({ duration_minutes: Number(e.target.value) })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" icon={X} onClick={onCancel}>Cancel</Button>
        <Button icon={Check} disabled={!a.title.trim()} onClick={() => onSave({ ...a, title: a.title.trim() })}>Done</Button>
      </div>
    </div>
  );
}

function ActivityRow({ activity: a, currency, destination, readOnly, onChange, onDelete, startEditing }) {
  const [editing, setEditing] = useState(startEditing);
  const type = TYPES[a.type] || TYPES.activity;
  const Icon = type.icon;
  if (editing) return <ActivityEditor activity={a} onCancel={() => setEditing(false)} onSave={(next) => { onChange(next); setEditing(false); }} />;
  return (
    <div className="group flex gap-4">
      <div className="w-14 shrink-0 pt-1 text-right text-sm font-bold tabular-nums text-slate-700">{a.time}</div>
      <div className="relative flex-1 rounded-xl border border-sand-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${type.color}`}><Icon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-snug">{a.title}</div>
            {a.description && <p className="mt-0.5 text-sm text-slate-500">{a.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {a.duration_minutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.duration_minutes >= 60 ? `${Math.floor(a.duration_minutes / 60)}h${a.duration_minutes % 60 ? ` ${a.duration_minutes % 60}m` : ""}` : `${a.duration_minutes}m`}</span>}
              {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.location}</span>}
              <a href={mapsUrl(a, destination)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />Map
              </a>
              {a.transport_note && <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" />{a.transport_note}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">{a.cost > 0 ? money(a.cost, currency) : "Free"}</div>
            {!readOnly && (
              <div className="mt-1 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button aria-label={`Edit ${a.title}`} onClick={() => setEditing(true)} className="rounded-md p-1.5 text-slate-500 hover:bg-sand-100"><Pencil className="h-4 w-4" /></button>
                <button aria-label={`Delete ${a.title}`} onClick={onDelete} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayPanel({ day, currency, destination, readOnly, onChange, onRegenerate, regenerating }) {
  const route = routeUrl(day, destination);
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [freshId, setFreshId] = useState(null);
  const total = sumCosts(day.activities);

  const update = (id, next) => onChange({ ...day, activities: day.activities.map((a) => (a.id === id ? next : a)).sort((x, y) => x.time.localeCompare(y.time)) });
  const remove = (id) => onChange({ ...day, activities: day.activities.filter((a) => a.id !== id) });
  const add = () => {
    const a = newActivity();
    setFreshId(a.id);
    onChange({ ...day, activities: [...day.activities, a] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">{day.title || `Day ${day.day}`}</h2>
          <p className="text-sm text-slate-500">{day.date && longDate(day.date)} · {money(total, currency)} planned</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {route && <LinkButton href={route} target="_blank" rel="noreferrer" icon={Navigation} title="Open the day's stops as directions in Google Maps">Route</LinkButton>}
          {!readOnly && (
            <>
              <Button variant="secondary" icon={Sparkles} onClick={() => setAsking((v) => !v)} aria-expanded={asking}>Rework this day</Button>
              <Button variant="secondary" icon={Plus} onClick={add}>Add</Button>
            </>
          )}
        </div>
      </div>

      {asking && !readOnly && (
        <form
          className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3 sm:flex-row"
          onSubmit={async (e) => { e.preventDefault(); await onRegenerate(instruction); setAsking(false); setInstruction(""); }}
        >
          <input className="input" maxLength={300} placeholder="Optional: more museums, slower mornings, vegetarian dinner…"
            value={instruction} onChange={(e) => setInstruction(e.target.value)} aria-label="What should change?" />
          <Button type="submit" loading={regenerating} icon={Sparkles}>Regenerate</Button>
        </form>
      )}

      {day.activities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-200 py-10 text-center text-sm text-slate-400">Nothing planned for this day yet.</p>
      ) : (
        <div className="space-y-3">
          {day.activities.map((a) => (
            <ActivityRow key={a.id} activity={a} currency={currency} destination={destination} readOnly={readOnly} startEditing={a.id === freshId}
              onChange={(next) => update(a.id, next)} onDelete={() => remove(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DayTabs({ days, selected, onSelect }) {
  return (
    <div role="tablist" aria-label="Days" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {days.map((d, i) => (
        <button key={d.day} role="tab" aria-selected={i === selected} onClick={() => onSelect(i)}
          className={`shrink-0 rounded-xl border px-4 py-2 text-left transition ${
            i === selected ? "border-brand-600 bg-brand-600 text-white" : "border-sand-200 bg-white text-slate-600 hover:bg-sand-100"}`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Day {d.day}</div>
          <div className="text-sm font-bold">{d.date ? new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</div>
        </button>
      ))}
    </div>
  );
}

export function Tips({ tips }) {
  if (!tips?.length) return null;
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-bold">Good to know</h2>
      <ul className="space-y-2 text-sm text-slate-600">
        {tips.map((t, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{t}</li>)}
      </ul>
    </Card>
  );
}

export function PlanNotice({ itinerary }) {
  if (!itinerary.generation_note) return null;
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {itinerary.generation_note}
    </div>
  );
}

