-- =====================================================
-- RLS ENABLE
-- =====================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.absences enable row level security;

-- =====================================================
-- helper: 승인된 teacher인지 체크
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
-- PROFILES POLICIES
-- =====================================================

-- 조회:
-- - 본인 프로필
-- - 승인된 teacher는 전체 조회 가능
drop policy if exists "profiles_select_own_or_teacher" on public.profiles;
create policy "profiles_select_own_or_teacher"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_teacher()
);

-- 수정:
-- - 본인은 수정 가능
-- - 승인된 teacher는 전체 수정 가능
-- (단, role / approved는 트리거로 보호)
drop policy if exists "profiles_update_own_or_teacher" on public.profiles;
create policy "profiles_update_own_or_teacher"
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
-- PROFILES SAFETY TRIGGER
-- 학생이 role / approved 못 바꾸게 차단
-- =====================================================
create or replace function public.block_role_approved_changes()
returns trigger as $$
begin
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
-- EVENTS POLICIES
-- =====================================================

-- 조회:
-- - 학생: 본인 것만
-- - teacher: 전체 조회
drop policy if exists "events_select_own_or_teacher" on public.events;
create policy "events_select_own_or_teacher"
on public.events
for select
using (
  owner_id = auth.uid()
  or public.is_teacher()
);

-- 생성:
-- - 학생: 본인 것만 생성
drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
on public.events
for insert
with check (
  owner_id = auth.uid()
);

-- 수정:
-- - 학생: 본인 것만 수정
-- - teacher 수정은 차단 (읽기 전용)
drop policy if exists "events_update_own" on public.events;
create policy "events_update_own"
on public.events
for update
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);

-- 삭제:
-- - 학생: 본인 것만 삭제
drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own"
on public.events
for delete
using (
  owner_id = auth.uid()
);

-- =====================================================
-- ABSENCES POLICIES
-- =====================================================

-- 조회:
-- - 학생: 본인 것만
-- - teacher: 전체 조회
drop policy if exists "absences_select_own_or_teacher" on public.absences;
create policy "absences_select_own_or_teacher"
on public.absences
for select
using (
  student_id = auth.uid()
  or public.is_teacher()
);

-- 생성:
-- - 학생: 본인 것만
drop policy if exists "absences_insert_own" on public.absences;
create policy "absences_insert_own"
on public.absences
for insert
with check (
  student_id = auth.uid()
);

-- 수정:
-- - 학생: 본인 것만
drop policy if exists "absences_update_own" on public.absences;
create policy "absences_update_own"
on public.absences
for update
using (
  student_id = auth.uid()
)
with check (
  student_id = auth.uid()
);

-- 삭제:
-- - 학생: 본인 것만
drop policy if exists "absences_delete_own" on public.absences;
create policy "absences_delete_own"
on public.absences
for delete
using (
  student_id = auth.uid()
);
