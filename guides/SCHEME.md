-- =====================================================
-- SCHEMA
현재 스키마에 반영 안되어 있는것 들
- title 50자 제한, description 200자 제한
- is_hidden profile.collumn
- with check 추가
-- =====================================================

-- 초기화
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.absences CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_teacher() CASCADE;
DROP FUNCTION IF EXISTS public.handle_profile_update() CASCADE;
DROP FUNCTION IF EXISTS public.handle_absence_write() CASCADE;
DROP FUNCTION IF EXISTS public.update_events_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.handle_audit_log() CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.absence_status CASCADE;
DROP TYPE IF EXISTS public.event_category CASCADE;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.user_role AS ENUM ('student', 'teacher');
CREATE TYPE public.absence_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.event_category AS ENUM ('기초 역량 강화', '진로 탐색');

-- =====================================================
-- PROFILES
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

-- =====================================================
-- HELPER FUNCTIONS
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

-- =====================================================
-- PROFILES 트리거
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

CREATE INDEX idx_absences_student_date ON public.absences(student_id, date);

CREATE FUNCTION public.handle_absence_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    new.status := 'pending';
    new.updated_at := now();
    RETURN new;
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    new.status_updated_by := auth.uid();
    new.status_updated_at := now();
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
-- AUDIT LOGS
-- =====================================================
CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  table_name   TEXT        NOT NULL,
  operation    TEXT        NOT NULL, -- INSERT / UPDATE / DELETE
  old_data     JSONB,
  new_data     JSONB,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_table    ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);

-- =====================================================
-- AUDIT 트리거 함수 (events, absences 공용)
-- =====================================================
CREATE FUNCTION public.handle_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (changed_by, table_name, operation, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(old) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(new) END
  );
  RETURN COALESCE(new, old);
END;
$$;

-- events에 audit 트리거 등록
CREATE TRIGGER trg_events_audit
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_audit_log();

-- absences에 audit 트리거 등록
CREATE TRIGGER trg_absences_audit
AFTER INSERT OR UPDATE OR DELETE ON public.absences
FOR EACH ROW
EXECUTE FUNCTION public.handle_audit_log();

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
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

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
USING (public.is_teacher());

-- =====================================================
-- AUDIT LOGS RLS
--   선생만 조회 가능, 직접 INSERT/UPDATE/DELETE 불가 (트리거만 가능)
-- =====================================================
CREATE POLICY audit_logs_teacher_select
ON public.audit_logs FOR SELECT
USING (public.is_teacher());