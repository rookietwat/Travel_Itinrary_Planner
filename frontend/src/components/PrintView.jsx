import { longDate, money } from "../lib/format";

/** Full itinerary on one page; only shown when printing (see index.css). */
export default function PrintView({ title, preferences: p, itinerary: it }) {
  return (
    <article className="print-only">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="text-sm text-slate-600">
        {p.destination} · {p.start_date} to {p.end_date} · {p.travelers} traveler{p.travelers !== 1 && "s"} · budget {money(p.budget, p.currency)}
        · estimated {money(it.estimated_cost, p.currency)}
      </p>
      {it.summary && <p className="mt-2 text-sm">{it.summary}</p>}
      {it.days.map((day) => (
        <section key={day.day} className="mt-5 break-inside-avoid">
          <h2 className="text-lg font-bold">{day.title || `Day ${day.day}`}{day.date && <span className="ml-2 text-sm font-normal text-slate-500">{longDate(day.date)}</span>}</h2>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {day.activities.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="w-14 py-1 pr-2 font-semibold tabular-nums">{a.time}</td>
                  <td className="py-1 pr-2">
                    <div className="font-semibold">{a.title}</div>
                    {a.description && <div className="text-slate-600">{a.description}</div>}
                    {a.location && <div className="text-xs text-slate-500">{a.location}</div>}
                  </td>
                  <td className="w-20 py-1 text-right">{a.cost > 0 ? money(a.cost, p.currency) : "Free"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {it.lodging?.length > 0 && (
        <section className="mt-5">
          <h2 className="text-lg font-bold">Lodging</h2>
          <ul className="text-sm">
            {it.lodging.map((s, i) => <li key={i}>{s.name}{s.area && `, ${s.area}`}: {money(s.price_per_night, p.currency)} × {s.nights} night{s.nights !== 1 && "s"}</li>)}
          </ul>
        </section>
      )}
      {it.tips?.length > 0 && (
        <section className="mt-5">
          <h2 className="text-lg font-bold">Tips</h2>
          <ul className="list-disc pl-5 text-sm">{it.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      )}
    </article>
  );
}
