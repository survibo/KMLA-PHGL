import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// ─── Supabase API helpers ──────────────────────────────────────────────────────

async function fetchSessionFromSupabase() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("session fetch error:", error);
    return null;
  }
  return data?.session ?? null;
}

async function fetchProfileFromSupabase(userId) {
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
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMyProfile() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const isFetchingRef = useRef(false);

  const refresh = useCallback(async ({ showLoading = false } = {}) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (showLoading) setLoading(true);

      const nextSession = await fetchSessionFromSupabase();
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        return;
      }

      const nextProfile = await fetchProfileFromSupabase(nextSession.user.id);
      setProfile(nextProfile);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  // 1) 최초 로드
  useEffect(() => {
    refresh({ showLoading: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) 로그인·로그아웃 등 auth 상태 변화 감지
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      refresh({ showLoading: true });
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  // 3) PWA·모바일 복귀 시 승인 상태 조용히 재검증
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh({ showLoading: false });
      }
    };
    const handleFocus = () => refresh({ showLoading: false });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
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
