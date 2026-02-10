import { useMemo, useRef, useState } from "react";
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

  // ===== 이스터에그 상태/레퍼런스 =====
  const [eggMsg, setEggMsg] = useState("");
  const eggTimerRef = useRef(null);

  const clicksRef = useRef([]); // 최근 클릭 타임스탬프 저장
  const cooldownUntilRef = useRef(0);

  const EGG_WINDOW_MS = 10000; // 연타 판단 시간창
  const EGG_THRESHOLD = 40; // 이 안에 몇 번 누르면 발동
  const EGG_SHOW_MS = 7000; // 메시지 노출 시간
  const EGG_COOLDOWN_MS = 0; // 발동 후 쿨다운

  const EGG_MESSAGES = [
    "눈 안 아프시나요…? ( •_•)",
    "\ 화려한 조명이 날 감싸네 /",
    "* 깜 빡 깜 빡 *",
    "30 과학기술부가 만든 웹페이지 입니다!",
    "꽝!",
    ":D",
  ];

  function pickRandomEggMessage() {
    return EGG_MESSAGES[Math.floor(Math.random() * EGG_MESSAGES.length)];
  }

  function showEgg(message) {
    setEggMsg(message);
    if (eggTimerRef.current) clearTimeout(eggTimerRef.current);
    eggTimerRef.current = setTimeout(() => setEggMsg(""), EGG_SHOW_MS);
  }

  function onToggleThemeWithEgg() {
    // 테마 토글은 항상 실행
    toggleTheme();

    const now = Date.now();
    if (now < cooldownUntilRef.current) return;

    // window 밖 클릭들 제거 + now 추가
    const arr = clicksRef.current;
    arr.push(now);
    const cutoff = now - EGG_WINDOW_MS;
    while (arr.length && arr[0] < cutoff) arr.shift();

    if (arr.length >= EGG_THRESHOLD) {
      // 발동
      cooldownUntilRef.current = now + EGG_COOLDOWN_MS;
      clicksRef.current = []; // 리셋(연속 발동 방지)

      // 메시지는 너 취향대로 변경
      showEgg(pickRandomEggMessage());
    }
  }

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
        position: "relative",
      }}
    >
      {/* 간단 토스트 (헤더 안에서만) */}
      {eggMsg ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            background: "var(--bg-2)",
            border: "1px solid var(--border-focus)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            maxWidth: 320,
          }}
        >
          {eggMsg}
        </div>
      ) : null}

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
              onClick={onToggleThemeWithEgg}
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
