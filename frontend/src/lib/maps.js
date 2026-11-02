const place = (a, destination) => `${a.title}, ${a.location || destination}`;

/** Google Maps search for one stop. */
export const mapsUrl = (activity, destination) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place(activity, destination))}`;

/** Google Maps directions through every stop of the day, in order; null with fewer than two stops. */
export function routeUrl(day, destination) {
  const stops = day.activities.filter((a) => a.type !== "accommodation").map((a) => place(a, destination));
  if (stops.length < 2) return null;
  const params = new URLSearchParams({ api: "1", origin: stops[0], destination: stops[stops.length - 1], travelmode: "walking" });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}
