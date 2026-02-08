import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMyProfile() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // 중복 fetch 방지/레이스 방지용
  const fetchingRef = useRef(false);

  const fetchSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("session fetch error:", error);
      return null;
    }
    return data?.session ?? null;
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, approved, name, grade, class_no, student_no")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("profile fetch error:", error);
      return null;
    }
    return data ?? null;
  }, []);

  const refresh = useCallback(
    async (opts = { showLoading: false }) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        if (opts.showLoading) setLoading(true);

        const s = await fetchSession();
        setSession(s);

        if (!s) {
          setProfile(null);
          return;
        }

        const p = await fetchProfile(s.user.id);
        setProfile(p);
      } finally {
        fetchingRef.current = false;
        setLoading(false);
      }
    },
    [fetchSession, fetchProfile]
  );

  // 1) 최초 로드
  useEffect(() => {
    refresh({ showLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 로그인/로그아웃 등 auth 변화 감지
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // 세션 변경 발생 시 프로필 재조회
      refresh({ showLoading: true });
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  // 3) PWA/모바일에서 "다시 앱으로 돌아왔을 때" 승인 상태 재검증
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // 화면 복귀 시에는 로딩 스피너 없이 조용히 갱신
        refresh({ showLoading: false });
      }
    };

    const onFocus = () => {
      refresh({ showLoading: false });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return {
    loading,
    session,
    profile,
    refreshProfile: () => refresh({ showLoading: true }),
    refreshProfileSilent: () => refresh({ showLoading: false }),
  };
}
