export function money(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0)}`;
  }
}

const parse = (iso) => new Date(`${iso}T00:00:00`);
const today = () => new Date(new Date().toDateString());

export function shortDate(iso) {
  return parse(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function longDate(iso) {
  return parse(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function dateRange(start, end) {
  return start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
}

/** "past", "ongoing" or "upcoming" relative to today. */
export function tripStatus(start, end) {
  const now = today();
  if (parse(end) < now) return "past";
  if (parse(start) <= now) return "ongoing";
  return "upcoming";
}

export const daysUntil = (iso) => Math.round((parse(iso) - today()) / 86400000);

export function toIso(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function dayCount(start, end) {
  return Math.round((parse(end) - parse(start)) / 86400000) + 1;
}

/** Stable hue from a string, used to give each destination its own banner colour. */
export function hueFor(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
