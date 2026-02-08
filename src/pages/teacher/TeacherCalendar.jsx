import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  addDays,
  formatKoreanMD,
  formatWeekRange,
  startOfWeekMonday,
  toISODate,
} from "../../features/week";

const CATEGORIES = ["기초 역량 강화", "진로 탐색"];
const DOW = ["월", "화", "수", "목", "금", "토", "일"];

const ORDERS = {
  STUDENT_NO: "student_no", // 학번순: student_no만
  CLASS: "class", // 반순: class_no -> student_no
};

// 파일 상단 어디든
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

function minutesToHoursText(min) {
  const h = (min ?? 0) / 60;
  return Number.isInteger(h) ? `${h}시간` : `${h.toFixed(1)}시간`;
}

function compareNum(a, b) {
  const va = a ?? null;
  const vb = b ?? null;
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return va - vb;
}

export default function TeacherCalendar() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // 정렬 모드: query로 유지 (새로고침/공유 안정)
  const order = useMemo(() => {
    const q = searchParams.get("order");
    if (q === ORDERS.CLASS) return ORDERS.CLASS;
    return ORDERS.STUDENT_NO;
  }, [searchParams]);

  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");
  const [students, setStudents] = useState([]);

  const [weekBase, setWeekBase] = useState(() => startOfWeekMonday(new Date()));
  const monday = useMemo(() => startOfWeekMonday(weekBase), [weekBase]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    setSelectedIdx(0);
  }, [toISODate(monday)]);

  const selectedDate = weekDays[selectedIdx];
  const selectedISO = toISODate(selectedDate);
  const weekStartISO = toISODate(monday);
  const weekEndISO = toISODate(addDays(monday, 6));

  // 학생 목록 1회 로드 (전체학생 기준 순회)
  useEffect(() => {
    const loadStudents = async () => {
      setStudentsLoading(true);
      setStudentsError("");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, grade, class_no, student_no, approved, role")
        .eq("role", "student");

      if (error) {
        setStudentsError(error.message);
        setStudents([]);
      } else {
        setStudents(data ?? []);
      }

      setStudentsLoading(false);
    };

    loadStudents();
  }, []);

  const sortedStudents = useMemo(() => {
    const list = [...students];

    if (order === ORDERS.STUDENT_NO) {
      list.sort((a, b) => {
        const c = compareNum(a.student_no, b.student_no);
        if (c !== 0) return c;
        // fallback(거의 안 탐): class/name
        const c2 = compareNum(a.class_no, b.class_no);
        if (c2 !== 0) return c2;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });
      return list;
    }

    // 반순: class_no -> student_no
    list.sort((a, b) => {
      const c1 = compareNum(a.class_no, b.class_no);
      if (c1 !== 0) return c1;
      const c2 = compareNum(a.student_no, b.student_no);
      if (c2 !== 0) return c2;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
    return list;
  }, [students, order]);

  const currentIndex = useMemo(() => {
    if (!studentId) return -1;
    return sortedStudents.findIndex((s) => s.id === studentId);
  }, [sortedStudents, studentId]);

  const currentStudent = useMemo(() => {
    if (currentIndex < 0) return null;
    return sortedStudents[currentIndex];
  }, [sortedStudents, currentIndex]);

  // studentId가 없거나(이상 케이스) / 목록에 없으면 첫 학생으로 보내기
  useEffect(() => {
    if (studentsLoading) return;
    if (studentsError) return;
    if (!sortedStudents.length) return;

    if (!isUuid(studentId) || currentIndex < 0) {
      const first = sortedStudents[0];
      navigate(`/teacher/calendar/${first.id}?order=${order}`, {
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    studentsLoading,
    studentsError,
    sortedStudents.length,
    studentId,
    currentIndex,
    order,
  ]);

  function goPrevStudent() {
    if (currentIndex <= 0) return;
    const prev = sortedStudents[currentIndex - 1];
    navigate(`/teacher/calendar/${prev.id}?order=${order}`);
  }

  function goNextStudent() {
    if (currentIndex < 0) return;
    if (currentIndex >= sortedStudents.length - 1) return;
    const next = sortedStudents[currentIndex + 1];
    navigate(`/teacher/calendar/${next.id}?order=${order}`);
  }

  function setOrder(nextOrder) {
    // 현재 studentId 유지 + order만 교체
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("order", nextOrder);
      return p;
    });
  }

  // --- Events (read-only) ---
  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  async function fetchWeek(targetId) {
    if (!targetId) return;

    setFetching(true);
    setError("");

    const { data, error } = await supabase
      .from("events")
      .select(
        "id, owner_id, title, description, category, date, duration_min, created_at"
      )
      .eq("owner_id", targetId)
      .gte("date", weekStartISO)
      .lte("date", weekEndISO)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setEvents([]);
      setFetching(false);
      return;
    }

    setEvents(data ?? []);
    setFetching(false);
  }

  // 학생/주 변경 시 fetch
  useEffect(() => {
    if (!isUuid(studentId)) return;
    if (studentsLoading) return;
    if (studentsError) return;
    fetchWeek(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, weekStartISO, weekEndISO, studentsLoading, studentsError]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const d of weekDays) map.set(toISODate(d), []);
    for (const ev of events) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [events, weekDays]);

  const totals = useMemo(() => {
    const base = { "기초 역량 강화": 0, "진로 탐색": 0 };
    for (const ev of events) {
      if (base[ev.category] !== undefined)
        base[ev.category] += ev.duration_min || 0;
    }
    return base;
  }, [events]);

  const selectedList = useMemo(() => {
    return eventsByDate.get(selectedISO) ?? [];
  }, [eventsByDate, selectedISO]);

  // --- UI states ---
  if (studentsLoading) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          학생 목록 불러오는 중…
        </div>
      </div>
    );
  }

  if (studentsError) {
    return (
      <div className="l-page">
        <div className="u-alert u-alert--error">오류: {studentsError}</div>
      </div>
    );
  }

  if (!sortedStudents.length) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          학생이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="l-page">
      {/* Header: 학생 식별 + 좌우 네비 + 정렬 */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section" style={{ gap: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                학생 주간 학습 (읽기 전용)
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {currentStudent ? (
                  <>
                    <b style={{ color: "var(--text-1)" }}>
                      {currentStudent.name ?? "이름없음"}
                    </b>
                    {" · "}반 {currentStudent.class_no ?? "-"} / 번호{" "}
                    {currentStudent.student_no ?? "-"}
                    {" · "}
                    {currentIndex >= 0
                      ? `${currentIndex + 1} / ${sortedStudents.length}`
                      : `- / ${sortedStudents.length}`}
                  </>
                ) : (
                  "학생 정보를 찾는 중…"
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="c-ctl c-btn"
                onClick={goPrevStudent}
                disabled={currentIndex <= 0}
                title="이전 학생"
                style={{
                  fontWeight: 900,
                  opacity: currentIndex <= 0 ? 0.6 : 1,
                }}
              >
                ← 이전 학생
              </button>

              <button
                type="button"
                className="c-ctl c-btn"
                onClick={goNextStudent}
                disabled={
                  currentIndex < 0 || currentIndex >= sortedStudents.length - 1
                }
                title="다음 학생"
                style={{
                  fontWeight: 900,
                  opacity:
                    currentIndex < 0 ||
                    currentIndex >= sortedStudents.length - 1
                      ? 0.6
                      : 1,
                }}
              >
                다음 학생 →
              </button>
            </div>
          </div>

          <div className="r-split">
            <div className="f-field">
              <div className="f-label">정렬</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="c-ctl c-btn"
                  onClick={() => setOrder(ORDERS.STUDENT_NO)}
                  style={{
                    fontWeight: 900,
                    background:
                      order === ORDERS.STUDENT_NO
                        ? "var(--bg-2)"
                        : "var(--bg-1)",
                    borderColor:
                      order === ORDERS.STUDENT_NO
                        ? "var(--border-focus)"
                        : "var(--border-subtle)",
                  }}
                >
                  학번순
                </button>
                <button
                  type="button"
                  className="c-ctl c-btn"
                  onClick={() => setOrder(ORDERS.CLASS)}
                  style={{
                    fontWeight: 900,
                    background:
                      order === ORDERS.CLASS ? "var(--bg-2)" : "var(--bg-1)",
                    borderColor:
                      order === ORDERS.CLASS
                        ? "var(--border-focus)"
                        : "var(--border-subtle)",
                  }}
                >
                  반순
                </button>
              </div>
              <div className="f-hint">
                * 학번순: student_no / 반순: class_no → student_no
              </div>
            </div>

            <div className="f-field">
              <div className="f-label">주간 범위</div>
              <div style={{ fontSize: 13, fontWeight: 900 }}>
                {formatWeekRange(monday)}
              </div>
              <div className="f-hint">* 주 이동은 아래 버튼을 사용</div>
            </div>
          </div>
        </div>
      </div>

      {/* Week controls + summary */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section" style={{ gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>주간 학습</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {formatWeekRange(monday)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={() => setWeekBase(addDays(monday, -7))}
              >
                이전 주
              </button>
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={() => setWeekBase(startOfWeekMonday(new Date()))}
              >
                이번 주
              </button>
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={() => setWeekBase(addDays(monday, 7))}
              >
                다음 주
              </button>
            </div>
          </div>

          <div className="r-split" style={{ marginTop: 10 }}>
            <div
              className="u-panel"
              style={{ padding: 12, background: "var(--bg-2)" }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontWeight: 800,
                }}
              >
                기초 역량 강화
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
                {minutesToHoursText(totals["기초 역량 강화"])}
              </div>
            </div>

            <div
              className="u-panel"
              style={{ padding: 12, background: "var(--bg-2)" }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontWeight: 800,
                }}
              >
                진로 탐색
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
                {minutesToHoursText(totals["진로 탐색"])}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="u-alert u-alert--error">오류: {error}</div>
      ) : null}

      {/* Day tabs */}
      <div
        className="u-panel"
        style={{
          padding: 10,
          background: "var(--bg-1)",
          overflowX: "auto",
          display: "flex",
          gap: 8,
        }}
        role="tablist"
        aria-label="week days"
      >
        {weekDays.map((d, idx) => {
          const iso = toISODate(d);
          const count = (eventsByDate.get(iso) ?? []).length;
          const active = idx === selectedIdx;

          return (
            <button
              key={iso}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedIdx(idx)}
              className="c-ctl c-btn"
              style={{
                minWidth: 92,
                background: active ? "var(--bg-2)" : "var(--bg-1)",
                borderColor: active
                  ? "var(--border-focus)"
                  : "var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div style={{ fontWeight: 900 }}>{DOW[idx]}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {formatKoreanMD(d)}
                </div>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {count}건
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900 }}>
            {DOW[selectedIdx]}요일 · {formatKoreanMD(selectedDate)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 800,
            }}
          >
            읽기 전용
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {fetching ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              불러오는 중...
            </div>
          ) : selectedList.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              등록된 학습 없음
            </div>
          ) : (
            <div className="l-section">
              {selectedList.map((ev) => (
                <div
                  key={ev.id}
                  className="u-panel"
                  style={{
                    background: "var(--bg-2)",
                    padding: 12,
                    borderRadius: "var(--radius-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className="u-panel"
                          style={{
                            borderRadius: 999,
                            padding: "2px 8px",
                            fontSize: 12,
                            background: "var(--bg-1)",
                          }}
                        >
                          {ev.category}
                        </span>
                        <span
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                        >
                          {minutesToHoursText(ev.duration_min)}
                        </span>
                      </div>

                      <div style={{ marginTop: 6, fontWeight: 900 }}>
                        {ev.title}
                      </div>
                      {ev.description ? (
                        <div
                          style={{
                            marginTop: 6,
                            color: "var(--text-muted)",
                            fontSize: 13,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {ev.description}
                        </div>
                      ) : null}
                    </div>

                    {/* 읽기 전용: 액션 없음 */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
