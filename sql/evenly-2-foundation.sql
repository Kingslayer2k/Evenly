alter table public.groups
add column if not exists group_type text,
add column if not exists start_date date,
add column if not exists end_date date,
add column if not exists starts_at date,
add column if not exists ends_at date;

update public.groups
set group_type = coalesce(group_type, type, 'group')
where group_type is null;
