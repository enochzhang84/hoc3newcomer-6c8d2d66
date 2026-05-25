
create table public.sunday_school_teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sunday_school_teachers enable row level security;
create policy "admins manage teachers" on public.sunday_school_teachers
  for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "anyone read active teachers" on public.sunday_school_teachers
  for select to anon, authenticated using (is_active = true);
create trigger trg_sunday_teachers_updated before update on public.sunday_school_teachers
  for each row execute function public.set_updated_at();

create table public.sunday_class_schedule (
  id uuid primary key default gen_random_uuid(),
  slot_time text not null,
  course_name text,
  teacher_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sunday_class_schedule enable row level security;
create policy "admins manage class schedule" on public.sunday_class_schedule
  for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "anyone read class schedule" on public.sunday_class_schedule
  for select to anon, authenticated using (true);
create trigger trg_sunday_class_schedule_updated before update on public.sunday_class_schedule
  for each row execute function public.set_updated_at();
