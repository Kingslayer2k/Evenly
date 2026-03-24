-- Push notification subscriptions
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz default now(),
  unique(endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id);

-- Group member payment handles
alter table public.group_members
add column if not exists venmo_username text,
add column if not exists cash_app_tag text,
add column if not exists zelle_phone text,
add column if not exists phone text;

-- Groups columns
alter table public.groups
add column if not exists group_type text,
add column if not exists start_date date,
add column if not exists end_date date,
add column if not exists starts_at date,
add column if not exists ends_at date;

update public.groups
set group_type = coalesce(group_type, type, 'group')
where group_type is null;
