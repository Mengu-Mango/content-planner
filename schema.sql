-- Menu Letters Content Studio
-- 1) In Supabase SQL Editor ausführen
-- 2) Danach Storage Bucket "menu-letters-moodboards" als PRIVATE anlegen

create extension if not exists "uuid-ossp";

create table if not exists public.ml_todos (
  id text primary key default uuid_generate_v4()::text,
  user_id uuid not null default auth.uid(),
  title text not null,
  due_date date,
  priority text default 'normal' check (priority in ('low', 'normal', 'high')),
  status text default 'open' check (status in ('open', 'done')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ml_events (
  id text primary key default uuid_generate_v4()::text,
  user_id uuid not null default auth.uid(),
  title text not null,
  date date not null,
  type text default 'content' check (type in ('content', 'business', 'shipping', 'recipe')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ml_content_ideas (
  id text primary key default uuid_generate_v4()::text,
  user_id uuid not null default auth.uid(),
  title text not null,
  platform text,
  effort text,
  goal text,
  theme text,
  hook text,
  scenes jsonb default '[]'::jsonb,
  voiceover text,
  script text,
  caption text,
  hashtags text,
  status text default 'idea',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ml_moodboards (
  id text primary key default uuid_generate_v4()::text,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  title text,
  theme text default '',
  recipe text default '',
  notes text default '',
  cover_path text default '',
  cover_url text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month_key)
);

create table if not exists public.ml_moodboard_assets (
  id text primary key default uuid_generate_v4()::text,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  storage_path text not null,
  x numeric default 100,
  y numeric default 100,
  width numeric default 180,
  rotation numeric default 0,
  z numeric default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ml_todos enable row level security;
alter table public.ml_events enable row level security;
alter table public.ml_content_ideas enable row level security;
alter table public.ml_moodboards enable row level security;
alter table public.ml_moodboard_assets enable row level security;

-- Drop old policies if you re-run this file
drop policy if exists "ml_todos_select_own" on public.ml_todos;
drop policy if exists "ml_todos_insert_own" on public.ml_todos;
drop policy if exists "ml_todos_update_own" on public.ml_todos;
drop policy if exists "ml_todos_delete_own" on public.ml_todos;

drop policy if exists "ml_events_select_own" on public.ml_events;
drop policy if exists "ml_events_insert_own" on public.ml_events;
drop policy if exists "ml_events_update_own" on public.ml_events;
drop policy if exists "ml_events_delete_own" on public.ml_events;

drop policy if exists "ml_ideas_select_own" on public.ml_content_ideas;
drop policy if exists "ml_ideas_insert_own" on public.ml_content_ideas;
drop policy if exists "ml_ideas_update_own" on public.ml_content_ideas;
drop policy if exists "ml_ideas_delete_own" on public.ml_content_ideas;

drop policy if exists "ml_moodboards_select_own" on public.ml_moodboards;
drop policy if exists "ml_moodboards_insert_own" on public.ml_moodboards;
drop policy if exists "ml_moodboards_update_own" on public.ml_moodboards;
drop policy if exists "ml_moodboards_delete_own" on public.ml_moodboards;

drop policy if exists "ml_assets_select_own" on public.ml_moodboard_assets;
drop policy if exists "ml_assets_insert_own" on public.ml_moodboard_assets;
drop policy if exists "ml_assets_update_own" on public.ml_moodboard_assets;
drop policy if exists "ml_assets_delete_own" on public.ml_moodboard_assets;

create policy "ml_todos_select_own" on public.ml_todos for select using (auth.uid() = user_id);
create policy "ml_todos_insert_own" on public.ml_todos for insert with check (auth.uid() = user_id);
create policy "ml_todos_update_own" on public.ml_todos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ml_todos_delete_own" on public.ml_todos for delete using (auth.uid() = user_id);

create policy "ml_events_select_own" on public.ml_events for select using (auth.uid() = user_id);
create policy "ml_events_insert_own" on public.ml_events for insert with check (auth.uid() = user_id);
create policy "ml_events_update_own" on public.ml_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ml_events_delete_own" on public.ml_events for delete using (auth.uid() = user_id);

create policy "ml_ideas_select_own" on public.ml_content_ideas for select using (auth.uid() = user_id);
create policy "ml_ideas_insert_own" on public.ml_content_ideas for insert with check (auth.uid() = user_id);
create policy "ml_ideas_update_own" on public.ml_content_ideas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ml_ideas_delete_own" on public.ml_content_ideas for delete using (auth.uid() = user_id);

create policy "ml_moodboards_select_own" on public.ml_moodboards for select using (auth.uid() = user_id);
create policy "ml_moodboards_insert_own" on public.ml_moodboards for insert with check (auth.uid() = user_id);
create policy "ml_moodboards_update_own" on public.ml_moodboards for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ml_moodboards_delete_own" on public.ml_moodboards for delete using (auth.uid() = user_id);

create policy "ml_assets_select_own" on public.ml_moodboard_assets for select using (auth.uid() = user_id);
create policy "ml_assets_insert_own" on public.ml_moodboard_assets for insert with check (auth.uid() = user_id);
create policy "ml_assets_update_own" on public.ml_moodboard_assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ml_assets_delete_own" on public.ml_moodboard_assets for delete using (auth.uid() = user_id);

-- Private Storage policies for bucket: menu-letters-moodboards
-- Pfadstruktur der App: <user-id>/<month>/photos/<file>
insert into storage.buckets (id, name, public)
values ('menu-letters-moodboards', 'menu-letters-moodboards', false)
on conflict (id) do update set public = false;

drop policy if exists "ml_storage_select_own" on storage.objects;
drop policy if exists "ml_storage_insert_own" on storage.objects;
drop policy if exists "ml_storage_update_own" on storage.objects;
drop policy if exists "ml_storage_delete_own" on storage.objects;

create policy "ml_storage_select_own"
on storage.objects for select
using (
  bucket_id = 'menu-letters-moodboards'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "ml_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'menu-letters-moodboards'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "ml_storage_update_own"
on storage.objects for update
using (
  bucket_id = 'menu-letters-moodboards'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'menu-letters-moodboards'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "ml_storage_delete_own"
on storage.objects for delete
using (
  bucket_id = 'menu-letters-moodboards'
  and (storage.foldername(name))[1] = auth.uid()::text
);
