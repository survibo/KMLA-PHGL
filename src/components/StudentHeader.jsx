import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMyProfile } from "../hooks/useMyProfile";
import { useTheme } from "../lib/useTheme";

function Tab({ to, label }) {
  return (
    <NavLink
      to={to}
      className="c-ctl c-btn"
      style={({ isActive }) => ({
        minHeight: 40,
        padding: "8px 10px",
        fontWeight: 900,
        background: isActive ? "var(--bg-2)" : "var(--bg-1)",
        borderColor: isActive ? "var(--border-focus)" : "var(--border-subtle)",
        textAlign: "center",
        whiteSpace: "nowrap",
      })}
    >
      {label}
    </NavLink>
  );
}

export default function StudentHeader() {
  const navigate = useNavigate();
  const { profile, loading } = useMyProfile();
  const { theme, toggleTheme } = useTheme();

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header
      style={{
        width: "100%",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-1)",
      }}
    >
      {/* 내부만 max-width */}
      <div
        className="l-page"
        style={{
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900 }}>
            {loading ? "..." : profile?.name ?? "학생"}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="c-ctl c-btn"
              type="button"
              onClick={toggleTheme}
              title="테마 전환"
              style={{ fontWeight: 900 }}
            >
              {theme === "dark" ? "라이트" : "다크(테스트)"}
            </button>

            <button
              className="c-ctl c-btn c-btn--danger"
              type="button"
              onClick={logout}
            >
              로그아웃
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          <Tab to="/student/calendar" label="캘린더" />
          <Tab to="/student/absence" label="결석" />
          <Tab to="/student/profile" label="내 정보" />
        </div>
      </div>
    </header>
  );
}
