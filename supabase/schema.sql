-- Knowunity Content OS — shared team storage
-- Run this once in your Supabase project: SQL editor -> New query -> paste -> Run.
--
-- One table holds every record the app creates (settings, members, drops,
-- videos, day overrides). Each row is a small JSON document, so the app can
-- grow without schema changes.

create table if not exists public.items (
  id          text primary key,
  kind        text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists items_kind_idx on public.items (kind);
create index if not exists items_updated_idx on public.items (updated_at);

-- Row Level Security must be on for the public API. The policies below let
-- anyone who has the app's URL + anon key read and write the board, which is
-- the right trade-off for a small trusted team tool (the links inside are
-- protected by Google Drive's own sharing settings). If you ever want per-user
-- logins, switch these policies to `to authenticated` and enable Supabase Auth.
alter table public.items enable row level security;

drop policy if exists "team can read"   on public.items;
drop policy if exists "team can insert" on public.items;
drop policy if exists "team can update" on public.items;
drop policy if exists "team can delete" on public.items;

create policy "team can read"   on public.items for select to anon, authenticated using (true);
create policy "team can insert" on public.items for insert to anon, authenticated with check (true);
create policy "team can update" on public.items for update to anon, authenticated using (true) with check (true);
create policy "team can delete" on public.items for delete to anon, authenticated using (true);
