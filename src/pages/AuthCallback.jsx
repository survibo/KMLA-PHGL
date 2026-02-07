import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // supabase-js가 URL에 담긴 인증 결과를 처리하고 세션을 저장함.
    // 우리는 세션이 생겼는지만 확인하고 다음 페이지로 이동하면 됨.
    const run = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
        navigate("/login", { replace: true });
        return;
      }

      if (data.session) {
        // 지금은 role 분기 전이니까 임시로 학생 캘린더로 보냄
        navigate("/student/calendar", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [navigate]);

  return <div style={{ padding: 24 }}>Signing you in...</div>;
}
