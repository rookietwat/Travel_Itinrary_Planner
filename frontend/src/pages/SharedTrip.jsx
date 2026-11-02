import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Printer, Users } from "lucide-react";
import { Brand } from "../components/Layout";
import { BudgetCard, DayPanel, DayTabs, LodgingCard, PlanNotice, Tips } from "../components/Itinerary";
import PrintView from "../components/PrintView";
import { Button, Card, ErrorBanner, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { dateRange } from "../lib/format";

export default function SharedTrip() {
  const { token } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    api.getShared(token).then(setTrip).catch((e) => setError(e.message));
  }, [token]);

  const p = trip?.preferences;
  const itin = trip?.itinerary;

  return (
    <div className="min-h-screen">
      {trip && <PrintView {...trip} />}
      <header className="screen-only border-b border-sand-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <div className="flex gap-2">
            {trip && <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>}
            <Link to="/"><Button variant="secondary">Plan your own trip</Button></Link>
          </div>
        </div>
      </header>
      <main className="screen-only mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {!trip && !error && <Spinner label="Loading itinerary…" />}
        {trip && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Shared itinerary · view only</p>
              <h1 className="mt-1 text-3xl font-extrabold">{trip.title}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{dateRange(p.start_date, p.end_date)}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{p.travelers} traveler{p.travelers !== 1 && "s"}</span>
              </div>
              {itin.summary && <p className="mt-3 max-w-3xl text-slate-600">{itin.summary}</p>}
            </div>
            <PlanNotice itinerary={itin} />
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="min-w-0 space-y-5">
                <DayTabs days={itin.days} selected={selected} onSelect={setSelected} />
                <Card className="p-5 sm:p-6">
                  <DayPanel key={selected} day={itin.days[selected]} currency={p.currency} destination={p.destination} readOnly onChange={() => {}} />
                </Card>
              </div>
              <aside className="space-y-5">
                <BudgetCard itinerary={itin} budget={p.budget} currency={p.currency} travelers={p.travelers} />
                <LodgingCard lodging={itin.lodging} currency={p.currency} readOnly />
                <Tips tips={itin.tips} />
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
