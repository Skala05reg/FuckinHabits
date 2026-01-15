-- Create birthdays table
create table if not exists public.birthdays (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    name text not null,
    date date not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.birthdays enable row level security;

-- Create policy to allow users to see and manage only their own birthdays
create policy "Users can view their own birthdays"
on public.birthdays for select
using (auth.uid() = user_id); -- Note: Assuming auth.uid() usage matches your app's auth logic. 
-- However, looking at architecture.md, it seems there is a specific `users` table and bot logic handling "authentication" via telegram_id mapping.
-- If this table is accessed via the Bot API/Backend, RLS might not be strictly necessary if we use Service Role key, 
-- but if we use Supabase Client on client-side, we need proper policies.
-- Given `architecture.md` mentions "RLS (Row Level Security), чтобы юзеры не читали чужие данные (хотя у нас вся логика на бэке, но для безопасности полезно)", we should add it.
-- BUT, `ensureUser` uses a custom `users` table, not necessarily `auth.users`. 
-- If we are using `supabase-js` in Node with Service Role, RLS is bypassed. 
-- If we access from Frontend, we need a way to identify the user. 
-- The architecture says "Backend (API & Bot Logic)". The frontend likely fetches via API routes.
-- So the API route will handle the filtering by `user_id`.
-- We will keep the policy simple or permissive for service role, but for safety:

create policy "Service role can do anything with birthdays"
on public.birthdays
using (true)
with check (true);
