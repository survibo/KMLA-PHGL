import { supabase } from "../lib/supabase";

export default function Login() {
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      alert("로그인 중 오류가 발생했습니다.");
    }
  };

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
          maxWidth: 420,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <div className="l-section" style={{ alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>로그인</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
              Google 계정으로 로그인하세요
            </div>
          </div>

          <button
            type="button"
            className="c-ctl c-btn"
            style={{
              width: "100%",
              fontWeight: 700,
            }}
            onClick={loginWithGoogle}
          >
            Google로 로그인
          </button>

          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            로그인 후 승인 상태에 따라
            <br />
            학생 또는 선생님 페이지로 이동합니다.
          </div>

          {/* ✅ 제작 주체 표기 */}
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
              opacity: 0.8,
            }}
          >
            KMLA 과학기술부에서 제작한 PHGL 웹사이트입니다.
          </div>
        </div>
      </div>
    </div>
  );
}
