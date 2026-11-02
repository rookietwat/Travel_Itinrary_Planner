import { longDate, money } from "./format";

/** Plain Markdown version of a trip for pasting into chats, notes or email. */
export function tripToMarkdown({ title, preferences: p, itinerary: it }) {
  const lines = [`# ${title}`, "", `${p.destination} · ${p.start_date} to ${p.end_date} · ${p.travelers} traveler(s) · budget ${money(p.budget, p.currency)}`];
  if (it.summary) lines.push("", it.summary);
  for (const day of it.days) {
    lines.push("", `## ${day.title || `Day ${day.day}`}${day.date ? ` (${longDate(day.date)})` : ""}`, "");
    for (const a of day.activities) {
      const cost = a.cost > 0 ? ` — ${money(a.cost, p.currency)}` : "";
      lines.push(`- **${a.time}** ${a.title}${a.location ? ` _(${a.location})_` : ""}${cost}`);
      if (a.description) lines.push(`  ${a.description}`);
    }
  }
  if (it.lodging?.length) {
    lines.push("", "## Lodging", "");
    for (const s of it.lodging) lines.push(`- ${s.name}${s.area ? `, ${s.area}` : ""}: ${money(s.price_per_night, p.currency)} × ${s.nights} night(s)`);
  }
  if (it.tips?.length) {
    lines.push("", "## Tips", "");
    for (const t of it.tips) lines.push(`- ${t}`);
  }
  lines.push("", `Estimated total: ${money(it.estimated_cost, p.currency)}`);
  return lines.join("\n");
}

export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "trip";
