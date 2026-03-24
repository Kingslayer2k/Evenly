-- Recurring expense templates
-- Run this in the Supabase SQL editor

create table if not exists public.expense_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  created_by_member_id uuid,
  title text not null,
  amount_cents integer default 0,
  paid_by uuid,
  participants jsonb default '[]',
  split_type text default 'equal',
  split_method text default 'even',
  shares jsonb,
  split_details jsonb,
  recurring_interval text default 'monthly',
  day_of_month integer default 1,
  next_occurrence date not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.expense_templates enable row level security;

create policy "Members can view templates in their groups"
  on public.expense_templates for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = expense_templates.group_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Members can insert templates in their groups"
  on public.expense_templates for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = expense_templates.group_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Members can update templates in their groups"
  on public.expense_templates for update
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = expense_templates.group_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Members can delete templates in their groups"
  on public.expense_templates for delete
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = expense_templates.group_id
      and gm.user_id = auth.uid()
    )
  );

-- Allow the service role (cron) to bypass RLS
create policy "Service role can manage all templates"
  on public.expense_templates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists expense_templates_group_id_idx on public.expense_templates(group_id);
create index if not exists expense_templates_next_occurrence_idx on public.expense_templates(next_occurrence) where is_active = true;
