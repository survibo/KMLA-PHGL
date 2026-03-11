import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../lib/useTheme";
import { useCalendarView } from "../../lib/useCalendarView";

const EGG_WINDOW_MS = 10000;
const EGG_THRESHOLD = 40;
const EGG_SHOW_MS = 7000;
const EGG_COOLDOWN_MS = 0;
const EGG_MESSAGES = [
  "눈 안 아프시나요…? ( •_•)",
  "/ 화려한 조명이 날 감싸네 /",
  "* 깜 빡 깜 빡 *",
  "30 과학기술부가 만든 웹페이지 입니다!",
  "꽝!",
  ":D",
];

export default function StudentSettings() {
  const { theme, setTheme } = useTheme();
  const { viewMode, setViewMode } = useCalendarView();
  const [eggMsg, setEggMsg] = useState("");

  const eggTimerRef = useRef(null);
  const clicksRef = useRef([]);
  const cooldownUntilRef = useRef(0);

  const showEgg = (message) => {
    setEggMsg(message);
    if (eggTimerRef.current) clearTimeout(eggTimerRef.current);
    eggTimerRef.current = setTimeout(() => setEggMsg(""), EGG_SHOW_MS);
  };

  const pickRandomEggMessage = () =>
    EGG_MESSAGES[Math.floor(Math.random() * EGG_MESSAGES.length)];

  const onSetThemeWithEgg = (nextTheme) => {
    setTheme(nextTheme);

    const now = Date.now();
    if (now < cooldownUntilRef.current) return;

    const arr = clicksRef.current;
    arr.push(now);
    const cutoff = now - EGG_WINDOW_MS;
    while (arr.length && arr[0] < cutoff) arr.shift();

    if (arr.length >= EGG_THRESHOLD) {
      cooldownUntilRef.current = now + EGG_COOLDOWN_MS;
      clicksRef.current = [];
      showEgg(pickRandomEggMessage());
    }
  };

  useEffect(
    () => () => {
      if (eggTimerRef.current) clearTimeout(eggTimerRef.current);
    },
    [],
  );

  return (
    <div
      className="l-page l-section"
      style={{ marginTop: 12, position: "relative" }}
    >
      {eggMsg ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "sticky",
            top: 8,
            zIndex: 10,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            background: "var(--bg-2)",
            border: "1px solid var(--border-focus)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
          }}
        >
          {eggMsg}
        </div>
      ) : null}

      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>설정</div>
        <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 13 }}>
          테마와 캘린더 표시 방식을 선택할 수 있습니다.
        </div>
      </div>

      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900 }}>테마</div>
        <div
          style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="c-ctl c-btn"
            onClick={() => onSetThemeWithEgg("light")}
            style={{
              fontWeight: 900,
              borderColor:
                theme === "light"
                  ? "var(--border-focus)"
                  : "var(--border-subtle)",
              background: theme === "light" ? "var(--bg-2)" : "var(--bg-1)",
            }}
          >
            라이트 모드
          </button>
          <button
            type="button"
            className="c-ctl c-btn"
            onClick={() => onSetThemeWithEgg("dark")}
            style={{
              fontWeight: 900,
              borderColor:
                theme === "dark"
                  ? "var(--border-focus)"
                  : "var(--border-subtle)",
              background: theme === "dark" ? "var(--bg-2)" : "var(--bg-1)",
            }}
          >
            다크 모드
          </button>
        </div>
      </div>

      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900 }}>캘린더 표시 방식</div>
        <div
          style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="c-ctl c-btn"
            onClick={() => setViewMode("todo")}
            style={{
              fontWeight: 900,
              borderColor:
                viewMode === "todo"
                  ? "var(--border-focus)"
                  : "var(--border-subtle)",
              background: viewMode === "todo" ? "var(--bg-2)" : "var(--bg-1)",
            }}
          >
            기본형
          </button>
          <button
            type="button"
            className="c-ctl c-btn"
            onClick={() => setViewMode("classic")}
            style={{
              fontWeight: 900,
              borderColor:
                viewMode === "classic"
                  ? "var(--border-focus)"
                  : "var(--border-subtle)",
              background:
                viewMode === "classic" ? "var(--bg-2)" : "var(--bg-1)",
            }}
          >
            카드형
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          기본형: 체크리스트 방식 / 카드형: 기존 카드 방식
        </div>
      </div>
    </div>
  );
}
