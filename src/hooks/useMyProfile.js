import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMyProfile() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 1) 세션 가져오기(로그인 여부)
      const { data: sessionData } = await supabase.auth.getSession();
      const s = sessionData?.session ?? null;
      setSession(s);

      // 로그인 안 된 상태면 profile은 null
      if (!s) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // 2) DB에서 내 profiles 가져오기
      const { data: p, error } = await supabase
        .from("profiles")
        .select("id, role, approved, name")
        .eq("id", s.user.id)
        .single();

      if (error) {
        console.error("profile fetch error:", error);
        setProfile(null);
      } else {
        setProfile(p);
      }

      setLoading(false);
    };

    load();
  }, []);

  return { loading, session, profile };
}
