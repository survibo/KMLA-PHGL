import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Pending() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState("");

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const checkApproval = async () => {
    setErr("");
    setChecking(true);

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const session = sessionData?.session;
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      const userId = session.user.id;

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, approved")
        .eq("id", userId)
        .single();

      if (profileErr) throw profileErr;

      if (profile?.approved) {
        if (profile.role === "student") navigate("/student/calendar", { replace: true });
        else if (profile.role === "teacher") navigate("/teacher", { replace: true });
        return;
      }
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setChecking(false);
    }
  };

  // 페이지 진입 시 1회 확인
  useEffect(() => {
    checkApproval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>승인 대기</h1>
      <p>선생님 승인 후 이용 가능합니다.</p>

      {err && <div style={{ color: "red", marginBottom: 12 }}>{err}</div>}

      <button onClick={checkApproval} disabled={checking}>
        {checking ? "확인 중..." : "승인 상태 새로고침"}
      </button>

      <button onClick={logout} style={{ marginLeft: 8 }}>
        로그아웃
      </button>
    </div>
  );
}
