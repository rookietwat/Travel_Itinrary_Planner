-- Run once in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  preferences   jsonb not null,
  itinerary     jsonb not null,
  share_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists trips_owner_updated_idx on public.trips (owner_id, updated_at desc);

alter table public.trips enable row level security;

-- The FastAPI backend connects with the service key (which bypasses RLS) and filters
-- by owner_id itself. These policies protect the table if it is ever queried straight
-- from the browser with the anon key.
create policy "owners read their trips"   on public.trips for select using (auth.uid() = owner_id);
create policy "owners insert their trips" on public.trips for insert with check (auth.uid() = owner_id);
create policy "owners update their trips" on public.trips for update using (auth.uid() = owner_id);
create policy "owners delete their trips" on public.trips for delete using (auth.uid() = owner_id);
