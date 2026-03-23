alter table public.expenses
add column if not exists split_method text default 'even',
add column if not exists split_details jsonb;

update public.expenses
set split_method = case
  when split_type = 'custom' then 'custom'
  else 'even'
end
where split_method is null;

create table if not exists public.rotations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'as needed')),
  people jsonb not null,
  current_turn_index integer not null default 0,
  last_completed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rotation_history (
  id uuid primary key default gen_random_uuid(),
  rotation_id uuid not null references public.rotations(id) on delete cascade,
  completed_by uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  linked_expense_id uuid references public.expenses(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists rotations_group_id_idx on public.rotations(group_id);
create index if not exists rotation_history_rotation_id_idx on public.rotation_history(rotation_id);

alter table public.rotations enable row level security;
alter table public.rotation_history enable row level security;

drop policy if exists "rotations_select_authenticated" on public.rotations;
drop policy if exists "rotations_insert_authenticated" on public.rotations;
drop policy if exists "rotations_update_authenticated" on public.rotations;
drop policy if exists "rotations_delete_authenticated" on public.rotations;

create policy "rotations_select_authenticated"
on public.rotations
for select
to authenticated
using (true);

create policy "rotations_insert_authenticated"
on public.rotations
for insert
to authenticated
with check (true);

create policy "rotations_update_authenticated"
on public.rotations
for update
to authenticated
using (true)
with check (true);

create policy "rotations_delete_authenticated"
on public.rotations
for delete
to authenticated
using (true);

drop policy if exists "rotation_history_select_authenticated" on public.rotation_history;
drop policy if exists "rotation_history_insert_authenticated" on public.rotation_history;
drop policy if exists "rotation_history_update_authenticated" on public.rotation_history;
drop policy if exists "rotation_history_delete_authenticated" on public.rotation_history;

create policy "rotation_history_select_authenticated"
on public.rotation_history
for select
to authenticated
using (true);

create policy "rotation_history_insert_authenticated"
on public.rotation_history
for insert
to authenticated
with check (true);

create policy "rotation_history_update_authenticated"
on public.rotation_history
for update
to authenticated
using (true)
with check (true);

create policy "rotation_history_delete_authenticated"
on public.rotation_history
for delete
to authenticated
using (true);
