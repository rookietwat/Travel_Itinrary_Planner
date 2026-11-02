import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Link2, MapPin, Plane, Plus, Search, Sparkles, Users } from "lucide-react";
import { Badge, Button, Card, ErrorBanner, Spinner } from "../components/ui";
import { api, cached } from "../lib/api";
import { dateRange, daysUntil, hueFor, money, tripStatus } from "../lib/format";

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
      <div>
        <div className="text-2xl font-extrabold leading-none">{value}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      </div>
    </Card>
  );
}

function StatusBadge({ trip }) {
  const status = tripStatus(trip.start_date, trip.end_date);
  if (status === "ongoing") return <Badge tone="brand">Happening now</Badge>;
  if (status === "past") return <Badge>Past</Badge>;
  const n = daysUntil(trip.start_date);
  return <Badge tone="brand">{n === 0 ? "Starts today" : n === 1 ? "Tomorrow" : `In ${n} days`}</Badge>;
}

function TripCard({ trip }) {
  const hue = hueFor(trip.destination);
  const used = Math.min(100, (trip.estimated_cost / trip.budget) * 100);
  const over = trip.estimated_cost > trip.budget;
  return (
    <Link to={`/trips/${trip.id}`} className="group block">
      <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div
          className="flex h-28 items-end p-4"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 38%), hsl(${(hue + 50) % 360} 60% 55%))` }}
        >
          <div className="flex items-center gap-1.5 text-white">
            <MapPin className="h-4 w-4" />
            <span className="text-lg font-bold drop-shadow-sm">{trip.destination}</span>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="font-semibold">{trip.title}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{dateRange(trip.start_date, trip.end_date)}</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{trip.travelers}</span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{money(trip.estimated_cost, trip.currency)} planned</span>
              <span>{money(trip.budget, trip.currency)} budget</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sand-100">
              <div className={`h-full rounded-full ${over ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${used}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge trip={trip} />
            {trip.generated_by === "offline-template" && <Badge tone="amber">Template plan</Badge>}
            {trip.shared && <Badge tone="brand" icon={Link2}>Shared</Badge>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

export default function Dashboard() {
  // Paint from the cache immediately, then refresh in the background.
  const [trips, setTrips] = useState(() => cached.trips() ?? null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    api.listTrips().then((t) => !cancelled && setTrips(t)).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (!trips) return [];
    const q = query.trim().toLowerCase();
    return trips.filter((t) => {
      const status = tripStatus(t.start_date, t.end_date);
      if (filter === "upcoming" && status === "past") return false;
      if (filter === "past" && status !== "past") return false;
      return !q || t.title.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q);
    });
  }, [trips, query, filter]);

  if (error && !trips) return <ErrorBanner>{error}</ErrorBanner>;
  if (!trips) return <Spinner label="Loading your trips…" />;

  const upcoming = trips.filter((t) => tripStatus(t.start_date, t.end_date) !== "past").length;
  const daysPlanned = trips.reduce((n, t) => n + t.num_days, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Your trips</h1>
        <p className="mt-1 text-slate-500">Generate, tweak and share day-by-day itineraries.</p>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Plane} label="Trips planned" value={trips.length} />
        <Stat icon={CalendarDays} label="Upcoming" value={upcoming} />
        <Stat icon={MapPin} label="Days mapped out" value={daysPlanned} />
        <Stat icon={Link2} label="Shared" value={trips.filter((t) => t.shared).length} />
      </div>

      {trips.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Sparkles className="h-7 w-7" /></span>
          <h2 className="mt-4 text-xl font-bold">No trips yet</h2>
          <p className="mt-1 max-w-sm text-slate-500">Tell us where, when and what you love. We'll build the plan, you refine it.</p>
          <Link to="/new" className="mt-6"><Button icon={Plus}>Plan your first trip</Button></Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Filter trips" className="flex gap-1 rounded-xl bg-sand-100 p-1">
              {FILTERS.map((f) => (
                <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${filter === f.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <label className="relative block sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" aria-label="Search trips" placeholder="Search destination or title" className="input pl-9"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-sand-200 py-10 text-center text-sm text-slate-400">No trips match.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((t) => <TripCard key={t.id} trip={t} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
