import { cache } from "./cache";

let tokenGetter = async () => null;
export const setTokenGetter = (fn) => { tokenGetter = fn; };

function describe(detail) {
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`.replace(/^: /, "")).join("; ");
  }
  return typeof detail === "string" ? detail : "Something went wrong";
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = await tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach the planner API. Is the backend running?");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(describe(data.detail));
    err.status = res.status;
    throw err;
  }
  return data;
}

// Any change to a trip invalidates the list; the trip itself is kept for instant revisits.
const remember = (trip) => { cache.set(`trip:${trip.id}`, trip); cache.del("trips"); return trip; };
const forget = (id) => { cache.del(`trip:${id}`); cache.del("trips"); };

export const cached = {
  trips: () => cache.get("trips"),
  trip: (id) => cache.get(`trip:${id}`),
  clear: () => cache.clear(),
};

export const api = {
  health: () => request("/health"),
  listTrips: async () => cache.set("trips", await request("/trips")),
  getTrip: async (id) => remember(await request(`/trips/${id}`)),
  createTrip: async (prefs) => remember(await request("/trips", { method: "POST", body: prefs })),
  updateTrip: async (id, patch) => remember(await request(`/trips/${id}`, { method: "PUT", body: patch })),
  deleteTrip: async (id) => { await request(`/trips/${id}`, { method: "DELETE" }); forget(id); },
  duplicateTrip: async (id) => remember(await request(`/trips/${id}/duplicate`, { method: "POST" })),
  regenerateTrip: async (id, prefs) => remember(await request(`/trips/${id}/regenerate`, { method: "POST", body: prefs })),
  regenerateDay: async (id, day, instruction) =>
    remember(await request(`/trips/${id}/days/${day}/regenerate`, { method: "POST", body: { instruction } })),
  share: async (id) => remember(await request(`/trips/${id}/share`, { method: "POST" })),
  unshare: async (id) => remember(await request(`/trips/${id}/share`, { method: "DELETE" })),
  getShared: (token) => request(`/shared/${token}`),
};
