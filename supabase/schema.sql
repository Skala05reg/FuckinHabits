create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  first_name text,
  tz_offset_minutes int2 not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  is_active boolean not null default true,
  position integer not null default 0
);

create index if not exists habits_user_id_idx on public.habits(user_id);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  rating_efficiency int2,
  rating_social int2,
  journal_text text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_logs_user_id_date_idx on public.daily_logs(user_id, date);

create table if not exists public.year_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  year int2 not null,
  title text not null,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists year_goals_user_id_year_idx on public.year_goals(user_id, year);

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  user_id uuid not null references public.users(id) on delete cascade,
  unique (user_id, habit_id, date)
);

create index if not exists habit_completions_user_id_date_idx on public.habit_completions(user_id, date);
