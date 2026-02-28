import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  addDays,
  formatKoreanMD,
  formatWeekRange,
  startOfWeekMonday,
  toISODate,
} from "../../features/week";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["기초 역량 강화", "진로 탐색"];
const DOW = ["월", "화", "수", "목", "금", "토", "일"];

const ORDER = {
  STUDENT_NO: "student_no",
  CLASS: "class",
};

const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  ERROR: "error",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Design tokens ────────────────────────────────────────────────────────────

const S = {
  heading: {
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: "-0.2px",
    color: "var(--text-1)",
    lineHeight: 1.35,
  },
  subtext: {
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.55,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
  card: { padding: "14px 16px" },
  cardInner: {
    padding: "12px 13px",
    background: "var(--bg-2)",
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
  },
  thisWeekBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 800,
    color: "#166534",
    background: "rgba(34,197,94,0.13)",
    border: "1px solid rgba(34,197,94,0.28)",
    padding: "2px 9px",
    borderRadius: 999,
  },
  notThisWeek: {
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  row: { display: "flex", alignItems: "center", gap: 8 },
  rowSpread: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  btnGroup: { display: "flex", gap: 6, flexWrap: "wrap" },
  divider: { height: 1, background: "var(--border-subtle)", margin: "2px 0" },
  sectionBox: {
    padding: "12px 0",
    borderTop: "1px solid var(--border-subtle)",
    borderBottom: "1px solid var(--border-subtle)",
  },
};

const FADE = { transition: "opacity 150ms ease" };

const dimWhen = (active) => ({
  ...FADE,
  opacity: active ? 0.42 : 1,
  pointerEvents: active ? "none" : "auto",
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const parseWeekParam = (raw) => {
  if (!raw) return toISODate(startOfWeekMonday(new Date()));
  const d = new Date(raw);
  return isNaN(d)
    ? toISODate(startOfWeekMonday(new Date()))
    : toISODate(startOfWeekMonday(d));
};

const parseDayParam = (raw, max = 6) => {
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : clamp(n, 0, max);
};

const formatMinutesAsDecimalHours = (totalMinutes) => {
  const h = (totalMinutes ?? 0) / 60;
  return Number.isInteger(h) ? `${h}시간` : `${h.toFixed(1)}시간`;
};

const formatMinutesAsHoursAndMinutes = (totalMinutes) => {
  const total = totalMinutes ?? 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
};

const compareNullableNum = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
};

const compareByName = (a, b) =>
  String(a.name ?? "").localeCompare(String(b.name ?? ""));

// ─── Sort strategies ──────────────────────────────────────────────────────────

const sortByStudentNo = (a, b) =>
  compareNullableNum(a.student_no, b.student_no) ||
  compareNullableNum(a.class_no, b.class_no) ||
  compareByName(a, b);

const sortByClass = (a, b) =>
  compareNullableNum(a.class_no, b.class_no) ||
  compareNullableNum(a.student_no, b.student_no) ||
  compareByName(a, b);

const SORT_FN = {
  [ORDER.STUDENT_NO]: sortByStudentNo,
  [ORDER.CLASS]: sortByClass,
};

// ─── Supabase API ─────────────────────────────────────────────────────────────

async function fetchStudents() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, grade, class_no, student_no, approved, role")
    .eq("role", "student");

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchWeekEvents({ studentId, weekStartISO, weekEndISO }) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, owner_id, title, description, category, date, duration_min, created_at"
    )
    .eq("owner_id", studentId)
    .gte("date", weekStartISO)
    .lte("date", weekEndISO)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Reducers ─────────────────────────────────────────────────────────────────

const studentsInitial = { status: STATUS.LOADING, data: [], error: "" };

function studentsReducer(state, action) {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: STATUS.LOADING, error: "" };
    case "SUCCESS":
      return { status: STATUS.IDLE, data: action.payload, error: "" };
    case "ERROR":
      return { status: STATUS.ERROR, data: [], error: action.payload };
    default:
      return state;
  }
}

const eventsInitial = { status: STATUS.IDLE, live: [], stale: [] };

function eventsReducer(state, action) {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: STATUS.LOADING };
    case "SUCCESS":
      return {
        status: STATUS.IDLE,
        live: action.payload,
        stale: action.payload,
      };
    case "ERROR":
      return { ...state, status: STATUS.ERROR };
    case "RESET":
      return eventsInitial;
    default:
      return state;
  }
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────

function useStudents() {
  const [state, dispatch] = useReducer(studentsReducer, studentsInitial);

  useEffect(() => {
    let cancelled = false;

    dispatch({ type: "LOADING" });

    fetchStudents()
      .then((data) => {
        if (!cancelled) dispatch({ type: "SUCCESS", payload: data });
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: "ERROR", payload: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function useWeekEvents({ studentId, weekStartISO, weekEndISO, enabled }) {
  const [state, dispatch] = useReducer(eventsReducer, eventsInitial);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !isUuid(studentId)) {
      dispatch({ type: "RESET" });
      return;
    }

    cancelRef.current?.();

    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };

    dispatch({ type: "LOADING" });

    fetchWeekEvents({ studentId, weekStartISO, weekEndISO })
      .then((data) => {
        if (!cancelled) dispatch({ type: "SUCCESS", payload: data });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "ERROR" });
      });

    return () => {
      cancelRef.current?.();
    };
  }, [studentId, weekStartISO, weekEndISO, enabled]);

  return state;
}

function useTeacherCalendarState({ studentId, students, order }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const weekStart = parseWeekParam(searchParams.get("week"));
  const selectedIdx = parseDayParam(searchParams.get("day"));

  const monday = useMemo(
    () => startOfWeekMonday(new Date(weekStart)),
    [weekStart]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  const isThisWeek = useMemo(
    () => weekStart === toISODate(startOfWeekMonday(new Date())),
    [weekStart]
  );

  const sortedStudents = useMemo(
    () => [...students].sort(SORT_FN[order] ?? sortByClass),
    [students, order]
  );

  const currentIndex = useMemo(
    () => sortedStudents.findIndex((s) => s.id === studentId),
    [sortedStudents, studentId]
  );

  const setParam = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set(key, String(value));
        return p;
      });
    },
    [setSearchParams]
  );

  const setWeekAndResetDay = useCallback(
    (isoDate) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set("week", isoDate);
        p.set("day", "0");
        return p;
      });
    },
    [setSearchParams]
  );

  const navigateToStudent = useCallback(
    (idx) => {
      navigate(`/teacher/calendar/${sortedStudents[idx].id}?week=${weekStart}&day=0`);
    },
    [navigate, sortedStudents, weekStart]
  );

  const goToStudentById = useCallback(
    (targetId) => {
      if (!isUuid(targetId)) return;

      const exists = sortedStudents.some((s) => s.id === targetId);
      if (!exists) return;

      navigate(`/teacher/calendar/${targetId}?week=${weekStart}&day=0`);
    },
    [navigate, sortedStudents, weekStart]
  );

  useEffect(() => {
    if (!sortedStudents.length) return;

    if (!isUuid(studentId) || currentIndex < 0) {
      navigate(
        `/teacher/calendar/${sortedStudents[0].id}?week=${weekStart}&day=0`,
        { replace: true }
      );
    }
  }, [sortedStudents, studentId, currentIndex, weekStart, navigate]);

  return {
    monday,
    weekStart,
    weekDays,
    isThisWeek,
    selectedIdx,
    sortedStudents,
    currentIndex,
    currentStudent: sortedStudents[currentIndex] ?? null,
    setSelectedIdx: (i) => setParam("day", i),
    goPrevWeek: () => setWeekAndResetDay(toISODate(addDays(monday, -7))),
    goNextWeek: () => setWeekAndResetDay(toISODate(addDays(monday, 7))),
    goToCurrentWeek: () =>
      setWeekAndResetDay(toISODate(startOfWeekMonday(new Date()))),
    goPrevStudent: () => {
      if (currentIndex > 0) navigateToStudent(currentIndex - 1);
    },
    goNextStudent: () => {
      if (currentIndex >= 0 && currentIndex < sortedStudents.length - 1) {
        navigateToStudent(currentIndex + 1);
      }
    },
    goToStudentById,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeeklySummary({ events, status }) {
  const totals = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((cat) => [
          cat,
          events
            .filter((ev) => ev.category === cat)
            .reduce((sum, ev) => sum + (ev.duration_min ?? 0), 0),
        ])
      ),
    [events]
  );

  return (
    <div
      className="r-split"
      style={{ marginTop: 4, ...dimWhen(status === STATUS.LOADING) }}
    >
      {CATEGORIES.map((cat) => {
        const minutes = totals[cat] ?? 0;
        const isEmpty = minutes === 0;

        return (
          <div
            key={cat}
            style={{
              ...S.cardInner,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              opacity: isEmpty ? 0.6 : 1,
            }}
          >
            <span style={{ ...S.label, fontSize: 10 }}>{cat}</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "-0.3px",
                color: isEmpty ? "var(--text-muted)" : "var(--text-1)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.2,
              }}
            >
              {formatMinutesAsDecimalHours(minutes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderToggle({ order, onChange }) {
  const OPTIONS = [
    { label: "학번순", value: ORDER.STUDENT_NO },
    { label: "반순", value: ORDER.CLASS },
  ];

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {OPTIONS.map(({ label, value }) => {
        const active = order === value;

        return (
          <button
            key={value}
            type="button"
            className="c-ctl c-btn"
            onClick={() => onChange(value)}
            style={{
              fontWeight: 700,
              fontSize: 13,
              background: active ? "var(--bg-2)" : "var(--bg-1)",
              borderColor: active
                ? "var(--border-focus)"
                : "var(--border-subtle)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StudentSearch({ students, currentStudentId, onSelect }) {
  const [keyword, setKeyword] = useState("");

  const trimmedKeyword = keyword.trim();

  const filtered = useMemo(() => {
    const q = trimmedKeyword.toLowerCase();
    if (!q) return [];

    return students
      .filter((s) => {
        const name = String(s.name ?? "").toLowerCase();
        const cls = String(s.class_no ?? "");
        const no = String(s.student_no ?? "");
        const full = `${cls}-${no}`;

        return (
          name.includes(q) ||
          cls.includes(q) ||
          no.includes(q) ||
          full.includes(q)
        );
      })
      .slice(0, 8);
  }, [students, trimmedKeyword]);

  return (
    <div className="f-field">
      <div className="f-label">학생 검색</div>

      <input
        className="c-ctl"
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="이름 / 반 / 번호 검색"
        style={{
          width: "100%",
          minHeight: 40,
          padding: "10px 12px",
          fontSize: 14,
        }}
      />

      {!!trimmedKeyword && (
        <>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {filtered.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                검색 결과가 없습니다
              </span>
            ) : (
              filtered.map((s) => {
                const active = s.id === currentStudentId;

                return (
                  <button
                    key={s.id}
                    type="button"
                    className="c-ctl c-btn"
                    onClick={() => onSelect(s.id)}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      background: active ? "var(--bg-2)" : "var(--bg-1)",
                      borderColor: active
                        ? "var(--border-focus)"
                        : "var(--border-subtle)",
                    }}
                  >
                    {s.name ?? "이름없음"} ({s.class_no ?? "-"}반{" "}
                    {s.student_no ?? "-"}번)
                  </button>
                );
              })
            )}
          </div>

          <div className="f-hint">클릭하면 해당 학생으로 바로 이동합니다</div>
        </>
      )}
    </div>
  );
}

function CategoryBadge({ category }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.2px",
        padding: "3px 9px",
        borderRadius: 999,
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-2)",
        lineHeight: 1.25,
      }}
    >
      {category}
    </span>
  );
}

function EventCard({ event }) {
  return (
    <div
      style={{
        ...S.cardInner,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <CategoryBadge category={event.category} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.25,
          }}
        >
          {formatMinutesAsHoursAndMinutes(event.duration_min)}
        </span>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-1)",
          lineHeight: 1.5,
          wordBreak: "keep-all",
        }}
      >
        {event.title}
      </div>

      {event.description && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 10,
            wordBreak: "break-word",
          }}
        >
          {event.description}
        </div>
      )}
    </div>
  );
}

function StudentHeader({ student, index, total, onPrev, onNext }) {
  return (
    <div style={S.rowSpread}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {student ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--text-1)",
                }}
              >
                {student.name ?? "이름없음"}
              </span>

              <span style={{ color: "var(--border-subtle)" }}>·</span>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-2)",
                }}
              >
                {student.class_no ?? "-"}반 {student.student_no ?? "-"}번
              </span>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              {index >= 0 ? `${index + 1} / ${total}명` : `- / ${total}명`}
            </div>
          </>
        ) : (
          <span style={S.subtext}>학생 정보를 찾는 중…</span>
        )}
      </div>

      <div style={S.btnGroup}>
        <button
          type="button"
          className="c-ctl c-btn"
          onClick={onPrev}
          disabled={index <= 0}
          style={{ fontSize: 13, fontWeight: 700 }}
        >
          ← 이전
        </button>
        <button
          type="button"
          className="c-ctl c-btn"
          onClick={onNext}
          disabled={index < 0 || index >= total - 1}
          style={{ fontSize: 13, fontWeight: 700 }}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

function WeekNavBar({
  monday,
  isThisWeek,
  order,
  onChangeOrder,
  onPrev,
  onCurrent,
  onNext,
}) {
  return (
    <div style={S.rowSpread}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={S.heading}>주간 학습</div>

        {isThisWeek ? (
          <div style={S.thisWeekBadge}>
            <span style={{ fontSize: 10 }}>●</span>
            {formatWeekRange(monday)} · 이번 주
          </div>
        ) : (
          <div style={S.notThisWeek}>{formatWeekRange(monday)}</div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <OrderToggle order={order} onChange={onChangeOrder} />

        <div style={{ ...S.btnGroup, marginLeft: 4 }}>
          <button
            className="c-ctl c-btn"
            type="button"
            onClick={onPrev}
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            이전 주
          </button>
          <button
            className="c-ctl c-btn"
            type="button"
            onClick={onCurrent}
            disabled={isThisWeek}
            style={{
              fontSize: 13,
              fontWeight: 700,
              opacity: isThisWeek ? 0.45 : 1,
            }}
          >
            이번 주
          </button>
          <button
            className="c-ctl c-btn"
            type="button"
            onClick={onNext}
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            다음 주
          </button>
        </div>
      </div>
    </div>
  );
}

function DayTab({ day, dow, count, active, onClick }) {
  const hasEvents = count > 0;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="c-ctl c-btn"
      style={{
        minWidth: 80,
        flexShrink: 0,
        background: active ? "var(--bg-2)" : "var(--bg-1)",
        borderColor: active ? "var(--border-focus)" : "var(--border-subtle)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        position: "relative",
        opacity: active ? 1 : 0.92,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: active ? "var(--text-1)" : "var(--text-2)",
          lineHeight: 1.25,
        }}
      >
        {dow}
      </span>

      <span
        style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.25 }}
      >
        {formatKoreanMD(day)}
      </span>

      <span
        style={{
          marginTop: 2,
          fontSize: 11,
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: 999,
          minWidth: 28,
          textAlign: "center",
          background: hasEvents
            ? active
              ? "var(--text-1)"
              : "var(--bg-3)"
            : "transparent",
          color: hasEvents
            ? active
              ? "var(--bg-1)"
              : "var(--text-2)"
            : "var(--text-muted)",
          border: hasEvents ? "none" : "1px dashed var(--border-subtle)",
          lineHeight: 1.35,
        }}
      >
        {hasEvents ? `${count}건` : "없음"}
      </span>
    </button>
  );
}

function StatusBadge({ status }) {
  if (status === STATUS.IDLE) return null;

  const isError = status === STATUS.ERROR;

  return (
    <span
      style={{
        marginLeft: "auto",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1px",
        padding: "2px 8px",
        borderRadius: 999,
        color: isError ? "var(--accent-danger)" : "var(--text-muted)",
        background: isError ? "var(--accent-danger-bg)" : "transparent",
        border: isError ? "1px solid var(--accent-danger)" : "none",
        ...FADE,
      }}
    >
      {isError ? "⚠ 갱신 실패 · 이전 데이터" : "업데이트 중…"}
    </span>
  );
}

function DayPanel({ dow, date, events, status }) {
  return (
    <div className="u-panel" style={S.card}>
      <div
        style={{
          ...S.row,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>
          {dow}요일
        </span>
        <span style={{ color: "var(--border-subtle)" }}>·</span>
        <span style={S.subtext}>{formatKoreanMD(date)}</span>
        <StatusBadge status={status} />
      </div>

      <div style={dimWhen(status === STATUS.LOADING)}>
        {events.length === 0 ? (
          <div
            style={{
              minHeight: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              lineHeight: 1.5,
              borderRadius: 10,
              background: "var(--bg-2)",
              border: "1px dashed var(--border-subtle)",
            }}
          >
            이 날에는 등록된 학습이 없습니다
          </div>
        ) : (
          <div className="l-section" style={{ gap: 10 }}>
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading / Error / Empty screens ─────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="l-page">
      <div
        className="u-panel"
        style={{ ...S.card, color: "var(--text-muted)", fontSize: 13 }}
      >
        학생 목록 불러오는 중…
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="l-page">
      <div className="u-alert u-alert--error">오류: {message}</div>
    </div>
  );
}

function EmptyScreen() {
  return (
    <div className="l-page">
      <div
        className="u-panel"
        style={{ ...S.card, color: "var(--text-muted)", fontSize: 13 }}
      >
        등록된 학생이 없습니다.
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({ studentId, students, order, setOrder }) {
  const {
    monday,
    weekStart,
    weekDays,
    isThisWeek,
    selectedIdx,
    sortedStudents,
    currentIndex,
    currentStudent,
    setSelectedIdx,
    goPrevWeek,
    goNextWeek,
    goToCurrentWeek,
    goPrevStudent,
    goNextStudent,
    goToStudentById,
  } = useTeacherCalendarState({ studentId, students, order });

  const weekEndISO = toISODate(addDays(monday, 6));

  const { stale: events, status: eventsStatus } = useWeekEvents({
    studentId,
    weekStartISO: weekStart,
    weekEndISO,
    enabled: isUuid(studentId),
  });

  const eventsByDate = useMemo(() => {
    const map = new Map(weekDays.map((d) => [toISODate(d), []]));
    for (const ev of events) {
      map.get(ev.date)?.push(ev);
    }
    return map;
  }, [events, weekDays]);

  const selectedDate = weekDays[selectedIdx];
  const selectedEvents = eventsByDate.get(toISODate(selectedDate)) ?? [];

  return (
    <div className="l-page">
      <div className="u-panel" style={S.card}>
        <div className="l-section" style={{ gap: 16 }}>
          <StudentSearch
            students={sortedStudents}
            currentStudentId={studentId}
            onSelect={goToStudentById}
          />

          <div
            style={{
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            <StudentHeader
              student={currentStudent}
              index={currentIndex}
              total={sortedStudents.length}
              onPrev={goPrevStudent}
              onNext={goNextStudent}
            />
          </div>
        </div>
      </div>

      <div className="u-panel" style={S.card}>
        <div className="l-section" style={{ gap: 10 }}>
          <WeekNavBar
            monday={monday}
            isThisWeek={isThisWeek}
            order={order}
            onChangeOrder={setOrder}
            onPrev={goPrevWeek}
            onCurrent={goToCurrentWeek}
            onNext={goNextWeek}
          />

          <WeeklySummary events={events} status={eventsStatus} />
        </div>
      </div>

      <div
        className="u-panel"
        style={{ padding: 10, overflowX: "auto", display: "flex", gap: 6 }}
        role="tablist"
        aria-label="week days"
      >
        {weekDays.map((day, idx) => (
          <DayTab
            key={toISODate(day)}
            day={day}
            dow={DOW[idx]}
            count={(eventsByDate.get(toISODate(day)) ?? []).length}
            active={idx === selectedIdx}
            onClick={() => setSelectedIdx(idx)}
          />
        ))}
      </div>

      <DayPanel
        dow={DOW[selectedIdx]}
        date={selectedDate}
        events={selectedEvents}
        status={eventsStatus}
      />
    </div>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default function TeacherCalendar() {
  const { studentId } = useParams();
  const { status, data: students, error } = useStudents();
  const [order, setOrder] = useState(ORDER.CLASS);

  if (status === STATUS.LOADING) return <LoadingScreen />;
  if (status === STATUS.ERROR) return <ErrorScreen message={error} />;
  if (!students.length) return <EmptyScreen />;

  return (
    <CalendarView
      studentId={studentId}
      students={students}
      order={order}
      setOrder={setOrder}
    />
  );
}