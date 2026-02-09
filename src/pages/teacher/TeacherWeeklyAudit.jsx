import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { addDays, formatWeekRange, startOfWeekMonday, toISODate } from "../../features/week";

const CATEGORIES = ["기초 역량 강화", "진로 탐색"];

const SORTS = {
  CLASS_STUDENT: "class_student",
  NAME: "name",
  TOTAL: "total",
  BASIC: "basic",
  CAREER: "career",
};

function safeMin(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMin(min) {
  const m = safeMin(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}m`;
  return `${h}h${r ? `${pad2(r)}m` : ""}`; // 1h05m
}

export default function TeacherWeeklyAudit() {
  // ✅ 최초 진입 때만 쓰는 “진짜 로딩”
  const [booted, setBooted] = useState(false);

  // ✅ 이후 갱신은 화면 유지 + 작은 표시만
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [students, setStudents] = useState([]); // profiles 학생(1회 로드 후 유지)
  const [events, setEvents] = useState([]); // 주간 events

  const [sortKey, setSortKey] = useState(SORTS.TOTAL);
  const [asc, setAsc] = useState(true);

  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const weekStartISO = useMemo(() => toISODate(weekStart), [weekStart]);
  const weekEndISO = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);
  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  // =========================
  // ✅ 데이터 로더
  // - 최초: students + events 로드
  // - 이후 주 변경: events만 로드(학생 목록은 유지)
  // =========================
  async function load({ initial = false } = {}) {
    // initial이면 full 로딩, 아니면 background 갱신
    if (initial) {
      setError("");
    } else {
      setRefreshing(true);
      setError(""); // 오류는 갱신 중에도 표시할 수 있게 우선 비움
    }

    try {
      // 1) students는 최초 1회만 로드 (TeacherCalendar 스타일)
      if (!booted || students.length === 0) {
        const { data: ps, error: pErr } = await supabase
          .from("profiles")
          .select("id, name, grade, class_no, student_no, role")
          .eq("role", "student");

        if (pErr) throw pErr;
        setStudents(ps ?? []);
      }

      // 2) 해당 주 events 로드
      const { data: es, error: eErr } = await supabase
        .from("events")
        .select("owner_id, date, category, duration_min")
        .gte("date", weekStartISO)
        .lte("date", weekEndISO);

      if (eErr) throw eErr;
      setEvents(es ?? []);
    } catch (err) {
      // ✅ “화면을 지우지 않고” 오류만 띄우기
      setError(err?.message ?? String(err));
    } finally {
      if (!booted) setBooted(true);
      setRefreshing(false);
    }
  }

  // 최초 1회 로드
  useEffect(() => {
    load({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주 변경 시: 기존 화면 유지 + events만 갱신(하지만 students가 아직 없을 수 있으니 load가 알아서 처리)
  useEffect(() => {
    if (!booted) return; // 최초 부팅 전에는 위 initial 로드가 처리
    load({ initial: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO, weekEndISO]);

  const minutesByStudent = useMemo(() => {
    const map = new Map();
    for (const ev of events ?? []) {
      const id = ev.owner_id;
      if (!id) continue;

      const cur = map.get(id) ?? { total: 0, basic: 0, career: 0 };
      const min = safeMin(ev.duration_min);

      cur.total += min;
      if (ev.category === CATEGORIES[0]) cur.basic += min;
      if (ev.category === CATEGORIES[1]) cur.career += min;

      map.set(id, cur);
    }
    return map;
  }, [events]);

  const rows = useMemo(() => {
    let list = (students ?? [])
      .filter((s) => (s.role ?? "student") === "student")
      .map((s) => {
        const m = minutesByStudent.get(s.id) ?? { total: 0, basic: 0, career: 0 };
        return {
          id: s.id,
          name: s.name ?? "",
          class_no: s.class_no ?? 0,
          student_no: s.student_no ?? 0,
          total: m.total,
          basic: m.basic,
          career: m.career,
        };
      });

    list = [...list].sort((a, b) => {
      if (sortKey === SORTS.CLASS_STUDENT) {
        const ca = a.class_no ?? 9999;
        const cb = b.class_no ?? 9999;
        if (ca !== cb) return asc ? ca - cb : cb - ca;

        const sa = a.student_no ?? 9999;
        const sb = b.student_no ?? 9999;
        if (sa !== sb) return asc ? sa - sb : sb - sa;

        const na = String(a.name ?? "");
        const nb = String(b.name ?? "");
        return asc ? na.localeCompare(nb) : nb.localeCompare(na);
      }

      if (sortKey === SORTS.NAME) {
        const na = String(a.name ?? "");
        const nb = String(b.name ?? "");
        return asc ? na.localeCompare(nb) : nb.localeCompare(na);
      }

      if (sortKey === SORTS.TOTAL) {
        const d = safeMin(a.total) - safeMin(b.total);
        return asc ? d : -d;
      }

      if (sortKey === SORTS.BASIC) {
        const d = safeMin(a.basic) - safeMin(b.basic);
        return asc ? d : -d;
      }

      const d = safeMin(a.career) - safeMin(b.career);
      return asc ? d : -d;
    });

    return list;
  }, [students, minutesByStudent, sortKey, asc]);

  const goPrevWeek = () => setAnchorDate((d) => addDays(d, -7));
  const goNextWeek = () => setAnchorDate((d) => addDays(d, 7));

  const pickTimeSort = (k) => {
    setSortKey(k);
    setAsc(true);
  };

  // ✅ 최초 1회만 "불러오는 중…" 화면
  if (!booted) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          불러오는 중…
        </div>
      </div>
    );
  }

  return (
    <div className="l-page">
      {/* Header */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>주간 시간 집계</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
              {weekLabel}{" "}
              <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>
                ({weekStartISO} ~ {weekEndISO})
              </span>
              {refreshing ? (
                <span style={{ marginLeft: 8, fontWeight: 900, color: "var(--text-muted)" }}>
                  업데이트 중…
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="c-ctl c-btn" type="button" onClick={goPrevWeek} style={{ fontWeight: 900 }}>
              이전 주
            </button>
            <button className="c-ctl c-btn" type="button" onClick={goNextWeek} style={{ fontWeight: 900 }}>
              다음 주
            </button>
            <button
              className="c-ctl c-btn"
              type="button"
              onClick={() => load({ initial: false })}
              disabled={refreshing}
              style={{ fontWeight: 900, opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshing ? "새로고침..." : "새로고침"}
            </button>
          </div>
        </div>
      </div>

      {/* Error (화면 유지) */}
      {error ? (
        <div className="u-alert u-alert--error" style={{ marginBottom: 12 }}>
          오류: {error}
        </div>
      ) : null}

      {/* Controls */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section">
          <div className="f-field">
            <div className="f-label">시간 비교(버튼)</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="c-ctl c-btn"
                onClick={() => pickTimeSort(SORTS.TOTAL)}
                style={{
                  fontWeight: 900,
                  borderColor: sortKey === SORTS.TOTAL ? "var(--border-focus)" : "var(--border-subtle)",
                  background: sortKey === SORTS.TOTAL ? "var(--bg-2)" : "var(--bg-1)",
                }}
              >
                총 합
              </button>

              <button
                type="button"
                className="c-ctl c-btn"
                onClick={() => pickTimeSort(SORTS.BASIC)}
                style={{
                  fontWeight: 900,
                  borderColor: sortKey === SORTS.BASIC ? "var(--border-focus)" : "var(--border-subtle)",
                  background: sortKey === SORTS.BASIC ? "var(--bg-2)" : "var(--bg-1)",
                }}
              >
                {CATEGORIES[0]}
              </button>

              <button
                type="button"
                className="c-ctl c-btn"
                onClick={() => pickTimeSort(SORTS.CAREER)}
                style={{
                  fontWeight: 900,
                  borderColor: sortKey === SORTS.CAREER ? "var(--border-focus)" : "var(--border-subtle)",
                  background: sortKey === SORTS.CAREER ? "var(--bg-2)" : "var(--bg-1)",
                }}
              >
                {CATEGORIES[1]}
              </button>
            </div>
          </div>

          <div className="r-split">
            <div className="f-field">
              <div className="f-label">정렬</div>
              <select className="c-ctl c-input" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value={SORTS.TOTAL}>총 합(시간)</option>
                <option value={SORTS.BASIC}>{CATEGORIES[0]}(시간)</option>
                <option value={SORTS.CAREER}>{CATEGORIES[1]}(시간)</option>
                <option value={SORTS.CLASS_STUDENT}>학생(반/번호)</option>
                <option value={SORTS.NAME}>이름</option>
              </select>
            </div>

            <div className="f-field">
              <div className="f-label">정렬 방향</div>
              <button className="c-ctl c-btn" type="button" onClick={() => setAsc((v) => !v)} style={{ fontWeight: 900 }}>
                {asc ? "오름차순 ↑" : "내림차순 ↓"}
              </button>
            </div>
          </div>

          <div className="f-hint">
            * 최초 로드 이후엔 화면을 유지한 채로 백그라운드 갱신합니다(“업데이트 중…”만 표시).
          </div>
        </div>
      </div>

      {/* Table (스크롤 방지: fixed + colgroup + ellipsis) */}
      <div className="u-panel" style={{ overflowX: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
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
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid var(--border-subtle)` }}>
                <Td>
                  <div style={cellEllipsis()} title={String(r.class_no ?? "")}>
                    {r.class_no ?? "-"}
                  </div>
                </Td>

                <Td strong>
                  <div style={cellEllipsis()} title={r.name ?? ""}>
                    {r.name ?? "-"}
                  </div>
                </Td>

                <Td>
                  <div style={cellEllipsis()} title={String(r.student_no ?? "")}>
                    {r.student_no ?? "-"}
                  </div>
                </Td>

                <Td>
                  <div style={cellEllipsisRight()} title={String(r.total ?? 0)}>
                    {formatMin(r.total)}
                  </div>
                </Td>

                <Td>
                  <div style={cellEllipsisRight()} title={String(r.basic ?? 0)}>
                    {formatMin(r.basic)}
                  </div>
                </Td>

                <Td>
                  <div style={cellEllipsisRight()} title={String(r.career ?? 0)}>
                    {formatMin(r.career)}
                  </div>
                </Td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>
                  결과가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellEllipsis() {
  return { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}
function cellEllipsisRight() {
  return {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  };
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 13,
        fontWeight: 900,
        color: "var(--text-2)",
        padding: "12px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
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
        padding: "12px 14px",
        fontSize: 13,
        fontWeight: strong ? 900 : 700,
        verticalAlign: "top",
        overflow: "hidden",
      }}
    >
      {children}
    </td>
  );
}
