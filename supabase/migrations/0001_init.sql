-- Quran AI Tutor — initial Supabase schema
-- Run this in Supabase SQL Editor (or via supabase CLI `supabase db push`).
--
-- Tables:
--   profiles       — one row per auth.users user. Holds name/level preferences.
--   sessions       — a study session (Surah + Ayah focus) belonging to a user.
--   session_messages — chat messages within a session.
--
-- RLS is enabled on all three; users can only read/write their own rows.
-- The auth uuid (auth.users.id) is the canonical user identifier everywhere.

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  level      text not null default 'Beginner'
             check (level in ('Beginner','Intermediate','Advanced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Auto-create a profile row whenever a new Supabase auth user is created.
-- The client passes `name` and `level` in `raw_user_meta_data` at signup time;
-- we read them here.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, level)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'level', 'Beginner')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ─── sessions ────────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  surah_name  text not null default '',
  ayah_number int  not null default 1,
  summary     text not null default '',
  score       real,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sessions_user_id_created_at_idx
  on public.sessions (user_id, created_at desc);

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
before update on public.sessions
for each row execute function public.touch_updated_at();

-- ─── session_messages ────────────────────────────────────────────────────────
create table if not exists public.session_messages (
  id         uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role       text not null check (role in ('user','assistant','system')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists session_messages_session_id_created_at_idx
  on public.session_messages (session_id, created_at);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.sessions         enable row level security;
alter table public.session_messages enable row level security;

-- profiles: users can see/update their own profile. Insert happens via
-- handle_new_user() trigger so no insert policy needed from client code.
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- sessions: users manage their own rows.
drop policy if exists "sessions self select" on public.sessions;
create policy "sessions self select"
  on public.sessions for select
  using (auth.uid() = user_id);

drop policy if exists "sessions self insert" on public.sessions;
create policy "sessions self insert"
  on public.sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "sessions self update" on public.sessions;
create policy "sessions self update"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sessions self delete" on public.sessions;
create policy "sessions self delete"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- session_messages: access is gated by ownership of the parent session.
drop policy if exists "messages by session owner select" on public.session_messages;
create policy "messages by session owner select"
  on public.session_messages for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_messages.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "messages by session owner insert" on public.session_messages;
create policy "messages by session owner insert"
  on public.session_messages for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_messages.session_id
        and s.user_id = auth.uid()
    )
  );
