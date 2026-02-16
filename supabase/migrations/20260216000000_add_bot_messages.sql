create table if not exists public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message_kind text not null,
  message_id bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, message_kind, message_id)
);

create index if not exists bot_messages_user_kind_created_idx
  on public.bot_messages(user_id, message_kind, created_at desc);
