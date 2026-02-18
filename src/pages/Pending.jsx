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

  useEffect(() => {
    checkApproval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="l-page"
      style={{
        minHeight: "100vh",
        justifyContent: "center",
      }}
    >
      <div
        className="u-panel u-panel--raised"
        style={{
          padding: 20,
          maxWidth: 520,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <div className="l-section" style={{ gap: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>승인 대기</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
              선생님 승인 후 이용 가능합니다.
            </div>
          </div>

          {err ? <div className="u-alert u-alert--error">{err}</div> : null}

          <div className="l-section" style={{ gap: 10 }}>
            <button
              type="button"
              className="c-ctl c-btn"
              onClick={checkApproval}
              disabled={checking}
              style={{ width: "100%", fontWeight: 800 }}
            >
              {checking ? "확인 중..." : "승인 상태 새로고침"}
            </button>

            <button
              type="button"
              className="c-ctl c-btn c-btn--danger"
              onClick={logout}
              disabled={checking}
              style={{ width: "100%", fontWeight: 800 }}
            >
              로그아웃
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
            승인 처리 후에도 바로 반영되지 않으면,
            <br />
            “승인 상태 새로고침”을 눌러주세요.
          </div>
        </div>
      </div>
    </div>
  );
}
