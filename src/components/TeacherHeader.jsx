import { NavLink } from "react-router-dom";
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

export default function TeacherHeader() {
  const { profile, loading } = useMyProfile();
  const { theme, toggleTheme } = useTheme();

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div
      style={{
        width: "100%",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-1)",
        padding: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900 }}>
          {loading ? "..." : profile?.name ?? "선생님"}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="c-ctl c-btn"
            style={{ minHeight: 40, padding: "8px 10px", fontWeight: 900 }}
            onClick={toggleTheme}
            title="테마 전환"
          >
            {theme === "dark" ? "라이트" : "다크"}
          </button>

          <button
            type="button"
            className="c-ctl c-btn c-btn--danger"
            style={{ minHeight: 40, padding: "8px 10px", fontWeight: 900 }}
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Tab to="/teacher/students" label="학생 관리" />
        <Tab to="/teacher/absences" label="결석" />
        <Tab to="/teacher/calendar/first" label="캘린더" />
        <Tab to="/teacher/profile" label="내 정보" />
                <Tab to="/teacher/teachers" label="선생님 목록" />

      </div>
    </div>
  );
}
