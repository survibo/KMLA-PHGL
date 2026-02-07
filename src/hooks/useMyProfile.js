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
        .select("id, role, approved, name, grade, class_no, student_no")
        .eq("id", s.user.id)
        .single();

      if (error || !p) {
        console.error("profile fetch error:", error);
        setProfile(null);
        setLoading(false);
        return;
      }

      // 3) ✅ 최초 로그인 초기값: grade가 비어있으면 현재년도 + 5로 채움
      if (p.grade == null) {
        const currentYear = new Date().getFullYear();
        const defaultGrade = currentYear + 5;

        const { data: updated, error: updateError } = await supabase
          .from("profiles")
          .update({ grade: defaultGrade })
          .eq("id", p.id)
          .select("id, role, approved, name, grade, class_no, student_no")
          .single();

        if (updateError) {
          // 실패해도 앱은 계속 진행 (사용자가 edit에서 수동 입력 가능)
          console.error("grade auto-set failed:", updateError);
          setProfile(p); // 원본 유지
        } else {
          setProfile(updated); // DB 결과로 동기화
        }
      } else {
        setProfile(p);
      }

      setLoading(false);
    };

    load();
  }, []);

  return { loading, session, profile };
}
