# Wayfare: Personalized Travel Itinerary Planner

An AI-assisted trip planner. You enter a destination, dates, budget, travel style and interests; it builds a
day-by-day itinerary (sights, meals, transport, lodging) with a running cost estimate that you can edit,
regenerate day by day, and share with a read-only link.

**Features:** smart trip builder · dashboard with search and upcoming/past filters · per-activity editing with
live budget breakdown · rework one day with an instruction · edit preferences and rebuild · duplicate a trip ·
Google Maps link per stop and a walking route for each day · print/PDF and Markdown export · public share links.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | FastAPI (Python), Pydantic v2 |
| Generative AI | Claude via the Anthropic API (structured output through tool use) |
| Data and auth | Supabase (Postgres + Auth), JWT verified in the API |

## Run it (no accounts needed)

With no keys configured the app runs in **demo mode**: no login, trips saved to `backend/data/trips.json`, and
plans come from a built-in template planner instead of the AI model.

One command does everything (creates the venv, installs, starts both servers):

```bash
./run.sh
```

Or by hand:

```bash
# terminal 1: API on :8001
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --port 8001 --reload
```

```bash
# terminal 2: web app on :5175 (proxies /api to :8001)
cd frontend
npm install
npm run dev
```

Open http://localhost:5175. Interactive API docs are at http://localhost:8001/docs.

## Turn on the real integrations

Each one is independent; set only what you need in `backend/.env`.

1. **AI plans.** Set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`. If a model call fails
   or returns a plan that doesn't fit the dates, the API falls back to the template planner and the trip shows a
   "Template plan" notice, so generation never hard-fails.
2. **Supabase storage and login.**
   - Run `supabase/schema.sql` in your project's SQL editor.
   - Backend `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (server only, never ship to the browser) and, for
     projects that still use the legacy shared secret, `SUPABASE_JWT_SECRET`. Projects on asymmetric signing keys
     are verified through the project's JWKS endpoint automatically.
   - Frontend `frontend/.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart `npm run dev`.
   - With a URL or JWT secret set, every `/api/trips*` route requires a valid bearer token and users can only
     see their own trips.

`GET /api/health` reports which integrations are live; the UI badge in the header reads from it.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/trips` | Generate and save a trip from preferences |
| GET | `/api/trips` | List your trips (summaries) |
| GET / PUT / DELETE | `/api/trips/{id}` | Read, save edits (title, itinerary), delete |
| POST | `/api/trips/{id}/regenerate` | Rebuild the whole itinerary; send new preferences in the body to change the brief |
| POST | `/api/trips/{id}/duplicate` | Copy a trip, plan included |
| POST | `/api/trips/{id}/days/{n}/regenerate` | Rebuild one day, optional `{"instruction": "more museums"}` |
| POST / DELETE | `/api/trips/{id}/share` | Create or revoke a public read-only link |
| GET | `/api/shared/{token}` | Public view of a shared trip |

Costs are estimates for the whole travelling party, in the trip's currency. Trips are capped at 14 days.

## Tests

```bash
cd backend && .venv/bin/python -m pytest
```

20 tests cover generation rules (dates, budget, pace, no repeats), editing, per-day and whole-trip
regeneration, duplication, sharing and revocation, store persistence across restarts, JWT rejection (bad
signature, expired, missing), per-user isolation, and the AI path against a stubbed Anthropic client
(normalisation, fallbacks, prompt contents).

## Performance notes

- Routes are code-split; the dashboard's first load is ~63 kB gzipped and supabase-js (~100 kB) is only
  downloaded when a project is configured.
- Trips and the trip list are cached in memory on the client, so going back to a page paints instantly while
  it refreshes in the background.
- The demo store keeps the JSON file in memory and writes through atomically; API responses are gzipped.
- The Anthropic system prompt is marked for prompt caching, calls time out at 90 s with one retry, and day
  rewrites use a smaller token budget than full plans.

## Project layout

```
backend/app/    main.py, routes.py, schemas.py, ai.py (model calls), planner.py (offline template),
                store.py (JSON file / Supabase), auth.py (JWT), config.py
backend/tests/
frontend/src/   pages/ (Dashboard, TripBuilder, TripView, SharedTrip, Login), components/, lib/
supabase/schema.sql
```

## Not covered here

- The Anthropic call and the Supabase store/auth were not run against live services in development (no keys);
  they are exercised through stubs and the local store. Try them with your keys and check `/api/health`.
- Trips are shared by link, not co-edited live. Group planning today means one person edits, others view.
- The planner does not look up live prices or opening hours; AI output is an estimate to verify before booking.
  Map and route links open Google Maps searches built from the stop names, so they are only as precise as the names.
