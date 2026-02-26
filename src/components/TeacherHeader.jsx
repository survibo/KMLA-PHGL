import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMyProfile } from "../hooks/useMyProfile";
import { useTheme } from "../lib/useTheme";

function Tab({ to, label, matchPath }) {
  const location = useLocation(); // react-router-dom에서 import

  const isActive = matchPath
    ? location.pathname.startsWith(matchPath)
    : location.pathname === to;

  return (
    <NavLink
      to={to}
      className="c-ctl c-btn"
      style={{
        minHeight: 40,
        padding: "8px 10px",
        fontWeight: 900,
        background: isActive ? "var(--bg-2)" : "var(--bg-1)",
        borderColor: isActive ? "var(--border-focus)" : "var(--border-subtle)",
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
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
            {theme === "dark" ? "라이트" : "다크(테스트)"}
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
        <Tab
          to="/teacher/calendar/first"
          matchPath="/teacher/calendar"
          label="캘린더"
        />
        <Tab to="/teacher/absences" label="결석" />
        <Tab to="/teacher/weeklyaudit" label="주간 비교" />
        <Tab to="/teacher/profile" label="내 정보" />
        <Tab to="/teacher/teachers" label="선생님 목록" />
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 12,
          color: "var(--text-muted)",
          fontWeight: 500,
          paddingLeft: 4,
        }}
      >
        {" "}
        <a
          href="https://www.facebook.com/survibo"
          target="blank"
          rel="noopener noreferrer"
        >
          모든 기술적 문의는 <b>30기 김서혁</b>에게 해주시면 됩니다.{" "}
        </a>
      </div>
    </div>
  );
}
