import { Link } from "react-router-dom";
import { useMyProfile } from "../../hooks/useMyProfile";

export default function NotFound() {
  const { session, profile, loading } = useMyProfile();

  if (loading) return null;

  let homePath = "/login";
  if (session) {
    if (!profile?.approved) homePath = "/pending";
    else if (profile?.role === "teacher") homePath = "/teacher";
    else homePath = "/student/calendar";
  }

  return (
    <div className="l-page" style={{ alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div
        className="u-panel"
        style={{
          padding: 24,
          textAlign: "center",
          maxWidth: 420,
          width: "100%",
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 900 }}>404</div>

        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "var(--text-muted)",
            fontWeight: 700,
          }}
        >
          존재하지 않는 페이지입니다.
        </div>

        <div style={{ marginTop: 18 }}>
          <Link
            to={homePath}
            className="c-ctl c-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              padding: "10px 16px",
            }}
          >
            메인으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
