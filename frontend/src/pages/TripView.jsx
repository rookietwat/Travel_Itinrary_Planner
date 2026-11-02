import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Copy, CopyPlus, Download, FileText, Link2, Link2Off, Printer, RefreshCw, Save, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { BudgetCard, DayPanel, DayTabs, LodgingCard, PlanNotice, Tips } from "../components/Itinerary";
import PrintView from "../components/PrintView";
import { Badge, Button, Card, ErrorBanner, Modal, Spinner } from "../components/ui";
import { api, cached } from "../lib/api";
import { downloadText, slug, tripToMarkdown } from "../lib/export";
import { dateRange } from "../lib/format";
import { PreferencesForm } from "./TripBuilder";

const shareUrl = (token) => `${window.location.origin}/shared/${token}`;

export default function TripView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const seed = cached.trip(id); // instant paint on revisit; refreshed below
  const [trip, setTrip] = useState(seed ?? null);
  const [title, setTitle] = useState(seed?.title ?? "");
  const [itin, setItin] = useState(seed?.itinerary ?? null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [editing, setEditing] = useState(false);

  const adopt = (t) => { setTrip(t); setTitle(t.title); setItin(t.itinerary); };

  useEffect(() => {
    let cancelled = false;
    api.getTrip(id).then((t) => !cancelled && adopt(t)).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  const dirty = !!trip && (title.trim() !== trip.title || JSON.stringify(itin) !== JSON.stringify(trip.itinerary));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function run(name, fn) {
    setBusy(name); setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
  }

  const saveLocal = () => api.updateTrip(id, { title: title.trim() || trip.title, itinerary: itin });
  const save = () => run("save", async () => adopt(await saveLocal()));

  const regenerateDay = (instruction) => run("day", async () => {
    // The server regenerates from the saved plan, so persist local edits first.
    if (dirty) await saveLocal();
    adopt(await api.regenerateDay(id, itin.days[selected].day, instruction));
  });

  const regenerateTrip = () => {
    if (!window.confirm("Replace the whole itinerary with a fresh plan? Your edits will be lost.")) return;
    run("trip", async () => { adopt(await api.regenerateTrip(id)); setSelected(0); });
  };

  const applyPreferences = (prefs) => run("prefs", async () => {
    adopt(await api.regenerateTrip(id, prefs));
    setSelected(0);
    setEditing(false);
  });
  const closeEditor = useCallback(() => setEditing(false), []);

  const duplicate = () => run("duplicate", async () => {
    const copy = await api.duplicateTrip(id);
    navigate(`/trips/${copy.id}`);
  });

  const remove = () => {
    if (!window.confirm(`Delete "${trip.title}"? This can't be undone.`)) return;
    run("delete", async () => { await api.deleteTrip(id); navigate("/"); });
  };

  const toggleShare = () => run("share", async () => {
    const next = trip.share_token ? await api.unshare(id) : await api.share(id);
    setTrip((t) => ({ ...t, share_token: next.share_token }));
  });

  async function copyText(what, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Couldn't copy automatically. Use the download instead.");
    }
  }

  if (!trip || !itin) return error ? <ErrorBanner>{error}</ErrorBanner> : <Spinner label="Loading trip…" />;

  const p = trip.preferences;
  const current = { title: title.trim() || trip.title, preferences: p, itinerary: itin };
  const day = itin.days[Math.min(selected, itin.days.length - 1)];
  const setDay = (next) => setItin((it) => ({ ...it, days: it.days.map((d) => (d.day === next.day ? next : d)) }));

  return (
    <>
      <PrintView {...current} />
      <div className="screen-only space-y-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All trips
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-full sm:min-w-0 sm:flex-1">
            <input aria-label="Trip title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-transparent text-2xl font-extrabold tracking-tight sm:text-3xl hover:bg-white focus:bg-white" />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{dateRange(p.start_date, p.end_date)}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{p.travelers} · {p.travel_style}</span>
              <Badge>{p.pace}</Badge>
              {itin.generated_by === "offline-template" && <Badge tone="amber">Template plan</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={Save} loading={busy === "save"} disabled={!dirty} onClick={save}>{dirty ? "Save changes" : "Saved"}</Button>
            <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setEditing(true)}>Edit preferences</Button>
            <Button variant="secondary" icon={RefreshCw} loading={busy === "trip"} onClick={regenerateTrip}>Regenerate</Button>
            <Button variant="secondary" icon={CopyPlus} loading={busy === "duplicate"} onClick={duplicate} aria-label="Duplicate trip" title="Duplicate trip" />
            <Button variant="danger" icon={Trash2} loading={busy === "delete"} onClick={remove} aria-label="Delete trip" title="Delete trip" />
          </div>
        </div>

        <ErrorBanner>{error}</ErrorBanner>
        <PlanNotice itinerary={itin} />
        {itin.summary && <p className="max-w-3xl text-slate-600">{itin.summary}</p>}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-5">
            <DayTabs days={itin.days} selected={selected} onSelect={setSelected} />
            <Card className="p-5 sm:p-6">
              <DayPanel key={`${day.day}-${trip.updated_at}`} day={day} currency={p.currency} destination={p.destination} onChange={setDay}
                onRegenerate={regenerateDay} regenerating={busy === "day"} />
            </Card>
          </div>

          <aside className="space-y-5">
            <BudgetCard itinerary={itin} budget={p.budget} currency={p.currency} travelers={p.travelers} />
            <LodgingCard lodging={itin.lodging} currency={p.currency} onChange={(lodging) => setItin((it) => ({ ...it, lodging }))} />
            <Tips tips={itin.tips} />
            <Card className="p-5">
              <h2 className="font-bold">Share with your group</h2>
              <p className="mt-1 text-sm text-slate-500">Anyone with the link can view this itinerary. They can't edit it.</p>
              {trip.share_token && (
                <div className="mt-3 flex gap-2">
                  <input readOnly aria-label="Share link" className="input text-xs" value={shareUrl(trip.share_token)} onFocus={(e) => e.target.select()} />
                  <Button variant="secondary" icon={Copy} onClick={() => copyText("link", shareUrl(trip.share_token))}>{copied === "link" ? "Copied" : "Copy"}</Button>
                </div>
              )}
              <Button className="mt-3 w-full" variant={trip.share_token ? "ghost" : "secondary"} loading={busy === "share"}
                icon={trip.share_token ? Link2Off : Link2} onClick={toggleShare}>
                {trip.share_token ? "Stop sharing" : "Create share link"}
              </Button>
            </Card>
            <Card className="p-5">
              <h2 className="font-bold">Take it with you</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
                <Button variant="secondary" icon={Download} onClick={() => downloadText(`${slug(current.title)}.md`, tripToMarkdown(current))}>.md</Button>
                <Button variant="secondary" icon={FileText} onClick={() => copyText("text", tripToMarkdown(current))}>{copied === "text" ? "Copied" : "Copy"}</Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">Print saves as PDF from the browser dialog.</p>
            </Card>
          </aside>
        </div>
      </div>

      <Modal open={editing} title="Edit trip preferences" onClose={closeEditor}>
        <p className="-mt-3 mb-5 text-sm text-slate-500">Saving builds a brand-new itinerary from these preferences; the current plan is replaced.</p>
        <PreferencesForm initial={p} onSubmit={applyPreferences} busy={busy === "prefs"} error={error}
          submitLabel="Rebuild itinerary" busyLabel="Rebuilding your plan…" />
      </Modal>
    </>
  );
}
