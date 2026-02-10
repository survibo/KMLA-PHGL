-- =====================================================
-- FULL RESET + CREATE
-- (ABSENCES STATUS CONTROL + ROLE REVOKE AUDIT)
-- + ✅ GLOBAL AUDIT LOG (INSERT/UPDATE/DELETE 전부 기록)
-- + ✅ "사고 대비용": 앱(학생/선생)에서 audit_log 조회/수정 불가
-- + ✅ Security Advisor: Function Search Path Mutable 해결 (모든 함수 set search_path = public)
-- 실행: 이 블록 전체를 SQL Editor에 그대로 붙여넣고 실행
-- =====================================================

-- 0) auth.users 쪽 트리거 먼저 제거 (profiles 자동생성 트리거)
drop trigger if exists on_auth_user_created on auth.users;

-- 1) 테이블 제거 (audit_log 포함)
drop table if exists public.audit_log cascade;
drop table if exists public.absences cascade;
drop table if exists public.events cascade;
drop table if exists public.profiles cascade;

-- 2) 함수 제거
drop function if exists public.handle_new_user() cascade;
drop function if exists public.block_role_approved_changes() cascade;
drop function if exists public.is_teacher() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.block_absence_illegal_updates() cascade;
drop function if exists public.audit_profile_role() cascade;

-- audit log functions
drop function if exists public.audit_row_change() cascade;
drop function if exists public.attach_audit_triggers(text, text[]) cascade;

-- 3) 타입 제거
drop type if exists public.user_role cascade;
drop type if exists public.absence_status cascade;

-- 4) UUID 생성용
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
-- =====================================================
do $$ begin
  create type public.absence_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- A) AUDIT LOG (GLOBAL)
-- - 목적: 사고/감사 대비용 (전용 페이지 없음)
-- - 원칙: 앱(anon/authenticated)에서는 읽기/쓰기 전부 불가
-- - 기록은 트리거가 SECURITY DEFINER로 수행 → RLS/권한에 막히지 않게
-- =====================================================

create table if not exists public.audit_log (
  id bigserial primary key,

  table_schema text not null,
  table_name   text not null,
  action       text not null, -- INSERT / UPDATE / DELETE

  row_pk text,                -- PK값 문자열(타입 상관없이)

  old_data jsonb,
  new_data jsonb,

  actor_id uuid,              -- auth.uid()
  changed_at timestamptz not null default now()
);

create index if not exists idx_audit_log_tbl_time
on public.audit_log(table_name, changed_at desc);

create index if not exists idx_audit_log_actor_time
on public.audit_log(actor_id, changed_at desc);

create index if not exists idx_audit_log_rowpk
on public.audit_log(table_name, row_pk);

-- ✅ audit trigger function (SECURITY DEFINER)
-- - 트리거 args[0] = pk column name (보통 'id')
-- - audit_log 자체는 대상 테이블에서 제외 (attach 함수에서만 제어)
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pk_col text := null;
  pk_val text := null;
  actor  uuid := null;
begin
  if TG_NARGS >= 1 then
    pk_col := TG_ARGV[0];
  end if;

  actor := auth.uid();

  if pk_col is not null then
    if TG_OP = 'DELETE' then
      pk_val := to_jsonb(OLD)->>pk_col;
    else
      pk_val := to_jsonb(NEW)->>pk_col;
    end if;
  end if;

  if TG_OP = 'INSERT' then
    insert into public.audit_log(
      table_schema, table_name, action, row_pk,
      old_data, new_data, actor_id
    )
    values (
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk_val,
      null, to_jsonb(NEW), actor
    );
    return NEW;

  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log(
      table_schema, table_name, action, row_pk,
      old_data, new_data, actor_id
    )
    values (
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk_val,
      to_jsonb(OLD), to_jsonb(NEW), actor
    );
    return NEW;

  elsif TG_OP = 'DELETE' then
    insert into public.audit_log(
      table_schema, table_name, action, row_pk,
      old_data, new_data, actor_id
    )
    values (
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk_val,
      to_jsonb(OLD), null, actor
    );
    return OLD;
  end if;

  return null;
end;
$$;

-- ✅ 여러 테이블에 audit 트리거를 일괄 부착
create or replace function public.attach_audit_triggers(
  pk_column text,
  table_names text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  trg_name text;
begin
  foreach t in array table_names loop
    -- audit_log 같은건 애초에 넣지 마라
    trg_name := format('trg_audit_%s', t);

    execute format('drop trigger if exists %I on public.%I', trg_name, t);

    execute format(
      'create trigger %I
       after insert or update or delete on public.%I
       for each row execute function public.audit_row_change(%L)',
      trg_name, t, pk_column
    );
  end loop;
end;
$$;

-- ✅ audit_log는 앱에서 접근 불가 (권한 + RLS)
alter table public.audit_log enable row level security;

-- 정책을 "명시적 deny"로 박아둠 (select/insert/update/delete 모두 차단)
drop policy if exists audit_log_deny_all on public.audit_log;
create policy audit_log_deny_all
on public.audit_log
for all
using (false)
with check (false);

-- 권한도 전부 회수(추가 안전장치)
revoke all on table public.audit_log from anon;
revoke all on table public.audit_log from authenticated;
revoke all on table public.audit_log from public;

-- =====================================================
-- 1) 공통 함수: updated_at 자동 갱신
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================
-- 2) profiles
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  role public.user_role not null default 'student',
  approved boolean not null default false,

  name text,
  grade int,
  class_no int,
  student_no int,

  -- role 변경 추적 (권한 박탈: teacher -> student 포함)
  role_updated_by uuid references public.profiles(id),
  role_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role_updated_by
on public.profiles(role_updated_by);

create index if not exists idx_profiles_role_updated_at
on public.profiles(role_updated_at);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- role 변경 자동 기록
create or replace function public.audit_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role then
    new.role_updated_by := auth.uid();
    new.role_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_profile_role on public.profiles;
create trigger trg_audit_profile_role
before update on public.profiles
for each row
execute function public.audit_profile_role();

-- =====================================================
-- 3) events
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
-- 4) absences
-- =====================================================
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,

  date date not null,
  reason text not null,
  status public.absence_status not null default 'pending',

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
-- 5) auth.users → profiles 자동 생성
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================
-- 6) RLS ENABLE (profiles/events/absences)
-- =====================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.absences enable row level security;

-- =====================================================
-- 7) helper: 승인된 teacher 여부
-- =====================================================
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
      and p.approved = true
  );
$$;

-- =====================================================
-- 8) PROFILES POLICIES
-- =====================================================
drop policy if exists profiles_select_own_or_teacher on public.profiles;
create policy profiles_select_own_or_teacher
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_teacher()
);

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
-- 9) PROFILES SAFETY TRIGGER (학생이 role/approved 변경 못함)
-- =====================================================
create or replace function public.block_role_approved_changes()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

drop trigger if exists trg_block_role_approved_changes on public.profiles;
create trigger trg_block_role_approved_changes
before update on public.profiles
for each row
execute function public.block_role_approved_changes();

-- =====================================================
-- 10) EVENTS POLICIES
-- =====================================================
drop policy if exists events_select_own_or_teacher on public.events;
create policy events_select_own_or_teacher
on public.events
for select
using (
  owner_id = auth.uid()
  or public.is_teacher()
);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own
on public.events
for insert
with check (
  owner_id = auth.uid()
);

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

drop policy if exists events_delete_own on public.events;
create policy events_delete_own
on public.events
for delete
using (
  owner_id = auth.uid()
);

-- =====================================================
-- 11) ABSENCES POLICIES
-- =====================================================
drop policy if exists absences_select_own_or_teacher on public.absences;
create policy absences_select_own_or_teacher
on public.absences
for select
using (
  student_id = auth.uid()
  or public.is_teacher()
);

drop policy if exists absences_insert_own on public.absences;
create policy absences_insert_own
on public.absences
for insert
with check (
  student_id = auth.uid()
);

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

drop policy if exists absences_delete_own on public.absences;
create policy absences_delete_own
on public.absences
for delete
using (
  student_id = auth.uid()
);

-- =====================================================
-- 11-b) ABSENCES SAFETY TRIGGER
-- teacher: status만 변경 가능 + status 변경자/시간 자동 기록
-- student: status 변경 금지 (date/reason 수정은 허용)
-- =====================================================
create or replace function public.block_absence_illegal_updates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from old.status then
    new.status_updated_by := auth.uid();
    new.status_updated_at := now();
  end if;

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

  if new.status is distinct from old.status then
    raise exception 'student cannot change status';
  end if;

  if new.student_id is distinct from old.student_id then
    raise exception 'student cannot change student_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_absence_illegal_updates on public.absences;
create trigger trg_block_absence_illegal_updates
before update on public.absences
for each row
execute function public.block_absence_illegal_updates();

-- =====================================================
-- 12) ATTACH AUDIT TRIGGERS
-- - profiles/events/absences의 INSERT/UPDATE/DELETE 전부 audit_log에 남김
-- =====================================================
select public.attach_audit_triggers('id', array['profiles','events','absences']);
