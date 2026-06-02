create or replace function public.get_table_columns_info(_tables text[])
returns table (
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  is_primary_key boolean,
  ordinal_position integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
       and kcu.table_name = tc.table_name
      where tc.table_schema = 'public'
        and tc.table_name = c.table_name
        and tc.constraint_type = 'PRIMARY KEY'
        and kcu.column_name = c.column_name
    ) as is_primary_key,
    c.ordinal_position::integer
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = any(_tables)
  order by c.table_name, c.ordinal_position;
$$;

revoke all on function public.get_table_columns_info(text[]) from public;
grant execute on function public.get_table_columns_info(text[]) to authenticated, service_role;

create or replace function public.get_table_policies_info(_tables text[])
returns table (
  table_name text,
  policy_name text,
  cmd text,
  roles text,
  qual text,
  with_check text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    array_to_string(p.roles, ',')::text,
    coalesce(p.qual::text, ''),
    coalesce(p.with_check::text, '')
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = any(_tables)
  order by p.tablename, p.policyname;
$$;

revoke all on function public.get_table_policies_info(text[]) from public;
grant execute on function public.get_table_policies_info(text[]) to authenticated, service_role;