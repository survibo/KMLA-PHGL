-- =====================================================
-- FULL RESET + CREATE (ABSENCES STATUS CONTROL + WHO UPDATED INCLUDED)
-- 실행: 이 블록 전체를 SQL Editor에 그대로 붙여넣고 실행
-- =====================================================

-- 0) auth.users 쪽 트리거 먼저 제거 (profiles 자동생성 트리거)
drop trigger if exists on_auth_user_created on auth.users;

-- 1) 테이블 제거
drop table if exists public.absences cascade;
drop table if exists public.events cascade;
drop table if exists public.profiles cascade;

-- 2) 함수 제거
drop function if exists public.handle_new_user() cascade;
drop function if exists public.block_role_approved_changes() cascade;
drop function if exists public.is_teacher() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.block_absence_illegal_updates() cascade;

-- 3) 타입 제거
drop type if exists public.user_role cascade;
drop type if exists public.absence_status cascade;

-- 4) (선택) UUID 생성용
create extension if not exists pgcrypto;

-- =====================================================
-- 0. ENUM: user_role
-- =====================================================
do $$ begin
  create type public.user_role as enum ('student', 'teacher');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- 0-b. ENUM: absence_status
-- pending: 제출됨(대기)
-- approved : 승인
-- rejected : 반려
-- =====================================================
do $$ begin
  create type public.absence_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- 1. 공통 함수: updated_at 자동 갱신
-- =====================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================
-- 2. profiles
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  role public.user_role not null default 'student',
  approved boolean not null default false,

  name text,
  grade int,
  class_no int,
  student_no int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- =====================================================
-- 3. events
-- =====================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,

  title text not null,
  description text,
  category text not null,
  date date not null,
  duration_min int not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create index if not exists idx_events_owner_date
on public.events(owner_id, date);

-- =====================================================
-- 4. absences (status: ENUM)
-- + "누가/언제 status를 마지막으로 바꿨는지" 기록 컬럼 추가
-- =====================================================
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,

  date date not null,
  reason text not null,
  status public.absence_status not null default 'pending',

  -- ✅ status 변경 기록
  status_updated_by uuid references public.profiles(id),
  status_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_absences_updated_at on public.absences;
create trigger trg_absences_updated_at
before update on public.absences
for each row execute function public.set_updated_at();

create index if not exists idx_absences_student_date
on public.absences(student_id, date);

create index if not exists idx_absences_status_updated_by
on public.absences(status_updated_by);

create index if not exists idx_absences_status_updated_at
on public.absences(status_updated_at);

-- =====================================================
-- 5. auth.users → profiles 자동 생성
-- =====================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================
-- 6. RLS ENABLE
-- =====================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.absences enable row level security;

-- =====================================================
-- 7. helper: 승인된 teacher 여부
-- =====================================================
create or replace function public.is_teacher()
returns boolean as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
      and p.approved = true
  );
$$ language sql stable security definer;

-- =====================================================
-- 8. PROFILES POLICIES
-- =====================================================

-- select
drop policy if exists profiles_select_own_or_teacher on public.profiles;
create policy profiles_select_own_or_teacher
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_teacher()
);

-- update
drop policy if exists profiles_update_own_or_teacher on public.profiles;
create policy profiles_update_own_or_teacher
on public.profiles
for update
using (
  id = auth.uid()
  or public.is_teacher()
)
with check (
  id = auth.uid()
  or public.is_teacher()
);

-- =====================================================
-- 9. PROFILES SAFETY TRIGGER
-- role / approved 변경 차단 (학생)
-- =====================================================
create or replace function public.block_role_approved_changes()
returns trigger as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_teacher() then
    if new.role is distinct from old.role then
      raise exception 'role cannot be changed';
    end if;

    if new.approved is distinct from old.approved then
      raise exception 'approved cannot be changed';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_block_role_approved_changes on public.profiles;
create trigger trg_block_role_approved_changes
before update on public.profiles
for each row
execute function public.block_role_approved_changes();

-- =====================================================
-- 10. EVENTS POLICIES
-- =====================================================

-- select
drop policy if exists events_select_own_or_teacher on public.events;
create policy events_select_own_or_teacher
on public.events
for select
using (
  owner_id = auth.uid()
  or public.is_teacher()
);

-- insert
drop policy if exists events_insert_own on public.events;
create policy events_insert_own
on public.events
for insert
with check (
  owner_id = auth.uid()
);

-- update
drop policy if exists events_update_own on public.events;
create policy events_update_own
on public.events
for update
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);

-- delete
drop policy if exists events_delete_own on public.events;
create policy events_delete_own
on public.events
for delete
using (
  owner_id = auth.uid()
);

-- =====================================================
-- 11. ABSENCES POLICIES
-- =====================================================

-- select
drop policy if exists absences_select_own_or_teacher on public.absences;
create policy absences_select_own_or_teacher
on public.absences
for select
using (
  student_id = auth.uid()
  or public.is_teacher()
);

-- insert (학생만)
drop policy if exists absences_insert_own on public.absences;
create policy absences_insert_own
on public.absences
for insert
with check (
  student_id = auth.uid()
);

-- update (학생 or 승인된 teacher)
drop policy if exists absences_update_own on public.absences;
drop policy if exists absences_update_own_or_teacher on public.absences;

create policy absences_update_own_or_teacher
on public.absences
for update
using (
  student_id = auth.uid()
  or public.is_teacher()
)
with check (
  student_id = auth.uid()
  or public.is_teacher()
);

-- delete (학생만)
drop policy if exists absences_delete_own on public.absences;
create policy absences_delete_own
on public.absences
for delete
using (
  student_id = auth.uid()
);

-- =====================================================
-- 11-b. ABSENCES SAFETY TRIGGER
-- teacher: status만 변경 가능 + status 변경자/시간은 자동 기록(추가 컬럼)
-- student: status 변경 금지 (date/reason 수정은 허용)
-- =====================================================
create or replace function public.block_absence_illegal_updates()
returns trigger as $$
begin
  -- SQL Editor / 관리자 컨텍스트 허용
  if auth.uid() is null then
    return new;
  end if;

  -- ✅ status가 바뀌면 "누가/언제" 기록 (approved/rejected/pending 모두 포함)
  if new.status is distinct from old.status then
    new.status_updated_by := auth.uid();
    new.status_updated_at := now();
  end if;

  -- 승인된 teacher: status(+자동 기록 컬럼)만 변경 가능
  if public.is_teacher() then
    if new.student_id is distinct from old.student_id then
      raise exception 'teacher cannot change student_id';
    end if;

    if new.date is distinct from old.date then
      raise exception 'teacher cannot change date';
    end if;

    if new.reason is distinct from old.reason then
      raise exception 'teacher cannot change reason';
    end if;

    return new;
  end if;

  -- 학생: status 변경 금지 + student_id 변경 금지
  if new.status is distinct from old.status then
    raise exception 'student cannot change status';
  end if;

  if new.student_id is distinct from old.student_id then
    raise exception 'student cannot change student_id';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_block_absence_illegal_updates on public.absences;
create trigger trg_block_absence_illegal_updates
before update on public.absences
for each row
execute function public.block_absence_illegal_updates();
