-- =====================================================
-- REDESIGNED SCHEMA - CLEAN & SECURE
-- =====================================================

-- 초기화
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.absences CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_teacher() CASCADE;
DROP FUNCTION IF EXISTS public.assert_teacher(text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_profile_update() CASCADE;
DROP FUNCTION IF EXISTS public.handle_absence_write() CASCADE;
DROP FUNCTION IF EXISTS public.audit_row_change() CASCADE;
DROP FUNCTION IF EXISTS public.attach_audit_triggers(text, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.update_events_timestamp() CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.absence_status CASCADE;
DROP TYPE IF EXISTS public.event_category CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.user_role AS ENUM ('student', 'teacher');
CREATE TYPE public.absence_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.event_category AS ENUM ('기초 역량 강화', '진로 탐색');

-- =====================================================
-- AUDIT LOG
-- =====================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_schema TEXT NOT NULL,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  row_pk TEXT,
  old_data JSONB,
  new_data JSONB,
  actor_id UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tbl_time   ON public.audit_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_log_actor_time ON public.audit_log(actor_id, changed_at DESC);
CREATE INDEX idx_audit_log_rowpk      ON public.audit_log(table_name, row_pk);

CREATE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pk_col TEXT := NULL;
  pk_val TEXT := NULL;
  actor  UUID := NULL;
BEGIN
  IF TG_NARGS >= 1 THEN
    pk_col := TG_ARGV[0];
  END IF;

  actor := auth.uid();

  IF pk_col IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      pk_val := to_jsonb(OLD)->>pk_col;
    ELSE
      pk_val := to_jsonb(NEW)->>pk_col;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(table_schema, table_name, action, row_pk, old_data, new_data, actor_id)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk_val, NULL, to_jsonb(NEW), actor);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(table_schema, table_name, action, row_pk, old_data, new_data, actor_id)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk_val, to_jsonb(OLD), to_jsonb(NEW), actor);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(table_schema, table_name, action, row_pk, old_data, new_data, actor_id)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk_val, to_jsonb(OLD), NULL, actor);
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.attach_audit_triggers(pk_column TEXT, table_names TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t        TEXT;
  trg_name TEXT;
BEGIN
  FOREACH t IN ARRAY table_names LOOP
    trg_name := format('trg_audit_%s', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg_name, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(%L)',
      trg_name, t, pk_column
    );
  END LOOP;
END;
$$;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_deny_all ON public.audit_log FOR ALL USING (false);
REVOKE ALL ON public.audit_log FROM anon, authenticated, public;

-- =====================================================
-- PROFILES (테이블 먼저 생성)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  role     public.user_role NOT NULL DEFAULT 'student',
  approved BOOLEAN          NOT NULL DEFAULT false,

  name       TEXT,
  grade      INT,
  class_no   INT,
  student_no INT,

  role_updated_by UUID REFERENCES public.profiles(id),
  role_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role_updated ON public.profiles(role_updated_by, role_updated_at);

-- =====================================================
-- HELPER FUNCTIONS (profiles 테이블 생성 후)
-- =====================================================
CREATE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher' AND approved = true
  );
$$;

CREATE FUNCTION public.assert_teacher(msg TEXT DEFAULT 'teacher permission required')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION '%', msg;
  END IF;
END;
$$;

-- =====================================================
-- PROFILES 트리거 (is_teacher 함수 생성 후)
-- =====================================================
CREATE FUNCTION public.handle_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    IF new.role IS DISTINCT FROM old.role THEN
      RAISE EXCEPTION 'role cannot be changed by non-teacher';
    END IF;
    IF new.approved IS DISTINCT FROM old.approved THEN
      RAISE EXCEPTION 'approved cannot be changed by non-teacher';
    END IF;
    IF new.role_updated_by IS DISTINCT FROM old.role_updated_by
       OR new.role_updated_at IS DISTINCT FROM old.role_updated_at THEN
      RAISE EXCEPTION 'cannot forge role audit fields';
    END IF;
  END IF;

  IF new.role IS DISTINCT FROM old.role THEN
    new.role_updated_by := auth.uid();
    new.role_updated_at := now();
  END IF;

  new.updated_at := now();
  RETURN new;
END;
$$;

CREATE TRIGGER trg_profiles_before_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_update();

-- =====================================================
-- EVENTS
-- =====================================================
CREATE TABLE public.events (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL
    DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  title        TEXT                  NOT NULL,
  description  TEXT,
  category     public.event_category NOT NULL,
  date         DATE                  NOT NULL,
  duration_min INT                   NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_owner_date ON public.events(owner_id, date);

CREATE FUNCTION public.update_events_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

CREATE TRIGGER trg_events_before_update
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_events_timestamp();

-- =====================================================
-- ABSENCES
-- =====================================================
CREATE TABLE public.absences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL
    DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  date   DATE NOT NULL,
  reason TEXT NOT NULL,
  status public.absence_status NOT NULL DEFAULT 'pending',

  status_updated_by UUID REFERENCES public.profiles(id),
  status_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_absences_student_date   ON public.absences(student_id, date);
CREATE INDEX idx_absences_status_updated ON public.absences(status_updated_by, status_updated_at);

CREATE FUNCTION public.handle_absence_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    new.status            := 'pending';
    new.student_id        := auth.uid();
    new.status_updated_by := NULL;
    new.status_updated_at := NULL;
    new.updated_at        := now();
    RETURN new;
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    new.status_updated_by := auth.uid();
    new.status_updated_at := now();
  ELSE
    IF new.status_updated_by IS DISTINCT FROM old.status_updated_by
       OR new.status_updated_at IS DISTINCT FROM old.status_updated_at THEN
      RAISE EXCEPTION 'cannot forge status audit fields';
    END IF;
  END IF;

  IF public.is_teacher() THEN
    IF new.student_id IS DISTINCT FROM old.student_id THEN
      RAISE EXCEPTION 'teacher cannot change student_id';
    END IF;
    IF new.date IS DISTINCT FROM old.date THEN
      RAISE EXCEPTION 'teacher cannot change date';
    END IF;
    IF new.reason IS DISTINCT FROM old.reason THEN
      RAISE EXCEPTION 'teacher cannot change reason';
    END IF;
  ELSE
    IF new.status IS DISTINCT FROM old.status THEN
      RAISE EXCEPTION 'student cannot change status';
    END IF;
    IF new.student_id IS DISTINCT FROM old.student_id THEN
      RAISE EXCEPTION 'student cannot change student_id';
    END IF;
  END IF;

  new.updated_at := now();
  RETURN new;
END;
$$;

CREATE TRIGGER trg_absences_before_write
BEFORE INSERT OR UPDATE ON public.absences
FOR EACH ROW
EXECUTE FUNCTION public.handle_absence_write();

-- =====================================================
-- AUTH 연동
-- =====================================================
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RLS 활성화
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES RLS
-- =====================================================
CREATE POLICY profiles_select
ON public.profiles FOR SELECT
USING (id = auth.uid() OR public.is_teacher());

CREATE POLICY profiles_update
ON public.profiles FOR UPDATE
USING (id = auth.uid() OR public.is_teacher());

-- =====================================================
-- EVENTS RLS
-- =====================================================
CREATE POLICY events_own_all
ON public.events FOR ALL
USING (owner_id = auth.uid());

CREATE POLICY events_teacher_select
ON public.events FOR SELECT
USING (public.is_teacher());

-- =====================================================
-- ABSENCES RLS
-- =====================================================
CREATE POLICY absences_select
ON public.absences FOR SELECT
USING (student_id = auth.uid() OR public.is_teacher());

CREATE POLICY absences_insert
ON public.absences FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY absences_update
ON public.absences FOR UPDATE
USING (student_id = auth.uid() OR public.is_teacher());

-- =====================================================
-- AUDIT LOG 트리거 부착
-- =====================================================
SELECT public.attach_audit_triggers('id', ARRAY['profiles', 'events', 'absences']);