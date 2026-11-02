/** In-memory cache so revisiting a page paints instantly while fresh data loads. */
const store = new Map();

export const cache = {
  get: (key) => store.get(key),
  set: (key, value) => { store.set(key, value); return value; },
  del: (key) => store.delete(key),
  clear: () => store.clear(),
};
