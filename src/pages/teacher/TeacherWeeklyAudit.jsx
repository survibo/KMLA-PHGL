import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { addDays, formatWeekRange, startOfWeekMonday, toISODate } from "../../features/week";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["기초 역량 강화", "진로 탐색"];

const SORTS = {
  CLASS_STUDENT: "class_student",
  NAME:          "name",
  TOTAL:         "total",
  BASIC:         "basic",
  CAREER:        "career",
};

const SORT_OPTIONS = [
  { value: SORTS.TOTAL,         label: "총 합(시간)" },
  { value: SORTS.BASIC,         label: `${CATEGORIES[0]}(시간)` },
  { value: SORTS.CAREER,        label: `${CATEGORIES[1]}(시간)` },
  { value: SORTS.CLASS_STUDENT, label: "학생(반/번호)" },
  { value: SORTS.NAME,          label: "이름" },
];

const TIME_SORT_BUTTONS = [
  { value: SORTS.TOTAL,  label: "총 합" },
  { value: SORTS.BASIC,  label: CATEGORIES[0] },
  { value: SORTS.CAREER, label: CATEGORIES[1] },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const safeMin = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatMin = (min) => {
  const m = safeMin(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}분`;
  return `${h}시간 ${r ? `${String(r).padStart(2, "0")}분` : ""}`;
};

// ─── Sort ─────────────────────────────────────────────────────────────────────

function buildSorter(sortKey, asc) {
  const dir = (v) => (asc ? v : -v);

  return (a, b) => {
    switch (sortKey) {
      case SORTS.CLASS_STUDENT: {
        const classDiff = (a.class_no ?? 9999) - (b.class_no ?? 9999);
        if (classDiff !== 0) return dir(classDiff);
        const noDiff = (a.student_no ?? 9999) - (b.student_no ?? 9999);
        if (noDiff !== 0) return dir(noDiff);
        return dir(String(a.name).localeCompare(String(b.name)));
      }
      case SORTS.NAME:
        return dir(String(a.name).localeCompare(String(b.name)));
      case SORTS.BASIC:
        return dir(safeMin(a.basic) - safeMin(b.basic));
      case SORTS.CAREER:
        return dir(safeMin(a.career) - safeMin(b.career));
      case SORTS.TOTAL:
      default:
        return dir(safeMin(a.total) - safeMin(b.total));
    }
  };
}

// ─── Supabase API ─────────────────────────────────────────────────────────────

async function fetchStudents() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, grade, class_no, student_no, role")
    .eq("role", "student");
  if (error) throw error;
  return data ?? [];
}

async function fetchWeekEvents(weekStartISO, weekEndISO) {
  const { data, error } = await supabase
    .from("events")
    .select("owner_id, date, category, duration_min")
    .gte("date", weekStartISO)
    .lte("date", weekEndISO);
  if (error) throw error;
  return data ?? [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeekHeader({ weekStart, weekStartISO, weekEndISO, refreshing, isThisWeek, onPrev, onThisWeek, onNext }) {
  return (
    <div className="u-panel" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>주간 시간 집계</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 이번 주 강조 배지 */}
            <span
              style={{
                fontWeight:   isThisWeek ? 900 : 400,
                color:        isThisWeek ? "#166534" : "var(--text-muted)",
                background:   isThisWeek ? "rgba(34, 197, 94, 0.12)" : "transparent",
                display:      "inline-block",
                padding:      isThisWeek ? "2px 8px" : 0,
                borderRadius: isThisWeek ? 999 : 0,
                transition:   "all 0.15s",
              }}
            >
              {formatWeekRange(weekStart)}
              {isThisWeek && " (이번 주)"}
            </span>

            <span style={{ fontWeight: 800 }}>
              ({weekStartISO} ~ {weekEndISO})
            </span>

            {refreshing && (
              <span style={{ fontWeight: 900, color: "var(--text-muted)" }}>
                업데이트 중…
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="c-ctl c-btn" type="button" onClick={onPrev} style={{ fontWeight: 900 }}>
            이전 주
          </button>
          <button
            className="c-ctl c-btn"
            type="button"
            onClick={onThisWeek}
            disabled={isThisWeek}
            style={{ fontWeight: 900, opacity: isThisWeek ? 0.45 : 1 }}
          >
            이번 주
          </button>
          <button className="c-ctl c-btn" type="button" onClick={onNext} style={{ fontWeight: 900 }}>
            다음 주
          </button>
        </div>
      </div>
    </div>
  );
}

function SortControls({ sortKey, asc, onTimeSortPick, onSortKeyChange, onAscToggle }) {
  return (
    <div className="u-panel" style={{ padding: 14 }}>
      <div className="l-section">
        {/* 시간 비교 빠른 버튼 */}
        <div className="f-field">
          <div className="f-label">시간 비교(버튼)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIME_SORT_BUTTONS.map(({ value, label }) => {
              const active = sortKey === value;
              return (
                <button
                  key={value}
                  type="button"
                  className="c-ctl c-btn"
                  onClick={() => onTimeSortPick(value)}
                  style={{
                    fontWeight:  900,
                    borderColor: active ? "var(--border-focus)"  : "var(--border-subtle)",
                    background:  active ? "var(--bg-2)"          : "var(--bg-1)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="r-split">
          {/* 정렬 기준 select */}
          <div className="f-field">
            <div className="f-label">정렬</div>
            <select
              className="c-ctl c-input"
              value={sortKey}
              onChange={(e) => onSortKeyChange(e.target.value)}
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* 오름/내림차순 */}
          <div className="f-field">
            <div className="f-label">정렬 방향</div>
            <button
              className="c-ctl c-btn"
              type="button"
              onClick={onAscToggle}
              style={{ fontWeight: 900 }}
            >
              {asc ? "오름차순 ↑" : "내림차순 ↓"}
            </button>
          </div>
        </div>

        <div className="f-hint">
          * 주 이동 시 화면을 유지한 채로 백그라운드 갱신합니다.
        </div>
      </div>
    </div>
  );
}

const cellBase    = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const cellNumeric = { ...cellBase, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Th({ children }) {
  return (
    <th
      style={{
        textAlign:    "left",
        fontSize:     13,
        fontWeight:   900,
        color:        "var(--text-2)",
        padding:      "12px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace:   "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, strong = false }) {
  return (
    <td
      style={{
        padding:       "12px 14px",
        fontSize:      13,
        fontWeight:    strong ? 900 : 700,
        verticalAlign: "top",
        overflow:      "hidden",
      }}
    >
      {children}
    </td>
  );
}

function AuditTable({ rows }) {
  return (
    <div className="u-panel" style={{ overflowX: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "12%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "18%" }} />
        </colgroup>

        <thead>
          <tr style={{ background: "var(--bg-2)" }}>
            <Th>반</Th>
            <Th>이름</Th>
            <Th>번호</Th>
            <Th>총 합</Th>
            <Th>{CATEGORIES[0]}</Th>
            <Th>{CATEGORIES[1]}</Th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>
                결과가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <Td><div style={cellBase}    title={String(r.class_no   ?? "")}>{r.class_no   ?? "-"}</div></Td>
                <Td strong><div style={cellBase} title={r.name ?? ""}>{r.name ?? "-"}</div></Td>
                <Td><div style={cellBase}    title={String(r.student_no ?? "")}>{r.student_no ?? "-"}</div></Td>
                <Td><div style={cellNumeric} title={String(r.total)}>{formatMin(r.total)}</div></Td>
                <Td><div style={cellNumeric} title={String(r.basic)}>{formatMin(r.basic)}</div></Td>
                <Td><div style={cellNumeric} title={String(r.career)}>{formatMin(r.career)}</div></Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeacherWeeklyAudit() {
  const [booted,     setBooted]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");
  const [students,   setStudents]   = useState([]);
  const [events,     setEvents]     = useState([]);
  const [sortKey,    setSortKey]    = useState(SORTS.TOTAL);
  const [asc,        setAsc]        = useState(true);
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  // ── 주(week) 파생값 ──
  const weekStart    = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const weekStartISO = useMemo(() => toISODate(weekStart), [weekStart]);
  const weekEndISO   = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);

  const isThisWeek = useMemo(
    () => weekStartISO === toISODate(startOfWeekMonday(new Date())),
    [weekStartISO]
  );

  // ── 데이터 로더 ──
  const load = async ({ initial = false } = {}) => {
    setError("");
    if (!initial) setRefreshing(true);

    try {
      // 학생 목록은 최초 1회만 로드
      if (!booted || students.length === 0) {
        const ps = await fetchStudents();
        setStudents(ps);
      }
      const es = await fetchWeekEvents(weekStartISO, weekEndISO);
      setEvents(es);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      if (!booted) setBooted(true);
      setRefreshing(false);
    }
  };

  // 최초 1회
  useEffect(() => {
    load({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주 변경 시 events 갱신
  useEffect(() => {
    if (!booted) return;
    load({ initial: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO, weekEndISO]);

  // ── 학생별 분단위 집계 ──
  const minutesByStudent = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const id  = ev.owner_id;
      if (!id) continue;
      const cur = map.get(id) ?? { total: 0, basic: 0, career: 0 };
      const min = safeMin(ev.duration_min);
      cur.total  += min;
      if (ev.category === CATEGORIES[0]) cur.basic  += min;
      if (ev.category === CATEGORIES[1]) cur.career += min;
      map.set(id, cur);
    }
    return map;
  }, [events]);

  // ── 정렬된 행 ──
  const rows = useMemo(() => {
    const sorter = buildSorter(sortKey, asc);
    return students
      .filter((s) => (s.role ?? "student") === "student")
      .map((s) => {
        const m = minutesByStudent.get(s.id) ?? { total: 0, basic: 0, career: 0 };
        return {
          id:         s.id,
          name:       s.name       ?? "",
          class_no:   s.class_no   ?? 0,
          student_no: s.student_no ?? 0,
          ...m,
        };
      })
      .sort(sorter);
  }, [students, minutesByStudent, sortKey, asc]);

  // ── 핸들러 ──
  const goPrevWeek    = () => setAnchorDate((d) => addDays(d, -7));
  const goNextWeek    = () => setAnchorDate((d) => addDays(d,  7));
  const goThisWeek    = () => setAnchorDate(new Date());
  const pickTimeSort  = (k) => { setSortKey(k); setAsc(true); };

  // ── Early return ──
  if (!booted) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="l-page">
      <WeekHeader
        weekStart={weekStart}
        weekStartISO={weekStartISO}
        weekEndISO={weekEndISO}
        refreshing={refreshing}
        isThisWeek={isThisWeek}
        onPrev={goPrevWeek}
        onThisWeek={goThisWeek}
        onNext={goNextWeek}
      />

      {error && (
        <div className="u-alert u-alert--error" style={{ marginBottom: 12 }}>
          오류: {error}
        </div>
      )}

      <SortControls
        sortKey={sortKey}
        asc={asc}
        onTimeSortPick={pickTimeSort}
        onSortKeyChange={setSortKey}
        onAscToggle={() => setAsc((v) => !v)}
      />

      <AuditTable rows={rows} />
    </div>
  );
}