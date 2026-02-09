import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMyProfile } from "../../hooks/useMyProfile";
import {
  addDays,
  formatKoreanMD,
  formatWeekRange,
  startOfWeekMonday,
  toISODate,
} from "../../features/week";

const CATEGORIES = ["기초 역량 강화", "진로 탐색"];
const DOW = ["월", "화", "수", "목", "금", "토", "일"];

// 개별 항목 표시: 1시간 n분 (정확)
function minutesToHMText(min) {
  const m = Number(min) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;

  if (h <= 0) return `${r}분`;
  if (r === 0) return `${h}시간`;
  return `${h}시간 ${r}분`;
}

// 요약(최종 결과) 표시: 소수 1자리 시간 + 불필요한 .0 제거
function minutesToHoursDecimalText1(min) {
  const m = Number(min) || 0;
  const h = m / 60;
  const s = h.toFixed(1);
  return `${s.replace(/\.0$/, "")}시간`;
}

// 입력: 분 문자열 -> 자연수(1 이상의 정수)만 허용
function parseMinutes(minutesStr) {
  if (!/^[1-9]\d*$/.test(minutesStr)) return null;
  return Number(minutesStr);
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="m-overlay" role="dialog" aria-modal="true">
      <button className="m-backdrop" onClick={onClose} aria-label="close" />
      <div className="m-box">
        <div className="m-header">
          <div className="m-title">{title}</div>
          <button className="c-ctl c-btn" onClick={onClose} type="button">
            닫기
          </button>
        </div>
        <div className="m-body">{children}</div>
      </div>
    </div>
  );
}

export default function StudentCalendar() {
  const { session, loading } = useMyProfile();
  const uid = session?.user?.id;

  const [weekBase, setWeekBase] = useState(() => startOfWeekMonday(new Date()));
  const monday = useMemo(() => startOfWeekMonday(weekBase), [weekBase]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  // ===== 이동 제한: 오늘 기준 ±3주 =====
  const thisMonday = useMemo(() => startOfWeekMonday(new Date()), []);
  const minMonday = useMemo(() => addDays(thisMonday, -7), [thisMonday]); // -1주
  const maxMonday = useMemo(() => addDays(thisMonday, 21), [thisMonday]);  // +3주

  const canPrev = monday.getTime() > minMonday.getTime();
  const canNext = monday.getTime() < maxMonday.getTime();

  // "이번 주"인지 판단: 현재 monday가 오늘 기준 이번주 월요일과 같으면 true
  const isThisWeek = useMemo(() => {
    return toISODate(monday) === toISODate(thisMonday);
  }, [monday, thisMonday]);

  const [selectedIdx, setSelectedIdx] = useState(() => {
    const today = new Date();
    const wMon = startOfWeekMonday(today);
    return Math.max(
      0,
      Math.min(6, Math.floor((today - wMon) / (1000 * 60 * 60 * 24)))
    );
  });

  useEffect(() => {
    setSelectedIdx(0);
  }, [toISODate(monday)]);

  const selectedDate = weekDays[selectedIdx];
  const selectedISO = toISODate(selectedDate);

  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({
    category: CATEGORIES[0],
    title: "",
    description: "",
    minutes: "60",
  });

  const weekStartISO = toISODate(monday);
  const weekEndISO = toISODate(addDays(monday, 6));

  async function fetchWeek() {
    if (!uid) return;
    setFetching(true);
    setError("");

    const { data, error } = await supabase
      .from("events")
      .select(
        "id, owner_id, title, description, category, date, duration_min, created_at"
      )
      .eq("owner_id", uid)
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

  useEffect(() => {
    if (!loading && uid) fetchWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, uid, weekStartISO, weekEndISO]);

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

  function openAdd() {
    setError("");
    setDraft({
      category: CATEGORIES[0],
      title: "",
      description: "",
      minutes: "60",
    });
    setAddOpen(true);
  }

  async function addEvent() {
    if (!uid) return;

    if (!draft.title.trim()) {
      setError("내용(title)은 비워둘 수 없음");
      return;
    }
    if (!CATEGORIES.includes(draft.category)) {
      setError("카테고리가 올바르지 않음");
      return;
    }

    const minutes = parseMinutes(draft.minutes);
    if (!minutes) {
      setError("시간(분)은 1 이상의 자연수여야 함");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      owner_id: uid,
      date: selectedISO,
      category: draft.category,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      duration_min: minutes,
    };

    const { error } = await supabase.from("events").insert(payload);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setAddOpen(false);
    await fetchWeek();
  }

  async function deleteEvent(id) {
    const ok = window.confirm("이 항목을 삭제하겠습니까?");
    if (!ok) return;

    setError("");
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    await fetchWeek();
  }

  if (loading) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="l-page">
      {/* Header */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section" style={{ gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>주간 학습</div>

              {/* ✅ 이번 주면 연한 초록색 강조 */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isThisWeek ? 900 : 400,
                  color: isThisWeek ? "#166534" : "var(--text-muted)",
                  background: isThisWeek ? "rgba(34, 197, 94, 0.12)" : "transparent",
                  display: "inline-block",
                  padding: isThisWeek ? "2px 8px" : 0,
                  borderRadius: isThisWeek ? 999 : 0,
                }}
              >
                {formatWeekRange(monday)}
                {isThisWeek ? " (이번 주)" : ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={() => {
                  if (!canPrev) return;
                  setWeekBase(addDays(monday, -7));
                }}
                disabled={!canPrev}
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
                onClick={() => {
                  if (!canNext) return;
                  setWeekBase(addDays(monday, 7));
                }}
                disabled={!canNext}
              >
                다음 주
              </button>
            </div>
          </div>

          {/* Summary (최종 결과만 소수 1자리 시간) */}
          <div className="r-split" style={{ marginTop: 10 }}>
            <div className="u-panel" style={{ padding: 12, background: "var(--bg-2)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>
                기초 역량 강화
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
                {minutesToHoursDecimalText1(totals["기초 역량 강화"])}
              </div>
            </div>

            <div className="u-panel" style={{ padding: 12, background: "var(--bg-2)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>
                진로 탐색
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
                {minutesToHoursDecimalText1(totals["진로 탐색"])}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? <div className="u-alert u-alert--error">{error}</div> : null}

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
                borderColor: active ? "var(--border-focus)" : "var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%" }}>
                <div style={{ fontWeight: 900 }}>{DOW[idx]}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatKoreanMD(d)}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>{count}건</div>
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>
            {DOW[selectedIdx]}요일 · {formatKoreanMD(selectedDate)}
          </div>
          <button className="c-ctl c-btn" type="button" onClick={openAdd}>
            일정 추가
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {fetching ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>불러오는 중...</div>
          ) : selectedList.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>등록된 학습 없음</div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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

                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {minutesToHMText(ev.duration_min)}
                        </span>
                      </div>

                      <div style={{ marginTop: 6, fontWeight: 900 }}>{ev.title}</div>
                      {ev.description ? (
                        <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 13, whiteSpace: "pre-wrap" }}>
                          {ev.description}
                        </div>
                      ) : null}
                    </div>

                    <button
                      className="c-ctl c-btn c-btn--danger"
                      type="button"
                      onClick={() => deleteEvent(ev.id)}
                      style={{ height: "fit-content" }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      <Modal
        open={addOpen}
        title={`${DOW[selectedIdx]}요일 (${formatKoreanMD(selectedDate)}) 일정 추가`}
        onClose={() => setAddOpen(false)}
      >
        <div className="l-section">
          <div className="f-field">
            <div className="f-label">카테고리</div>
            <select
              className="c-ctl c-input"
              value={draft.category}
              onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="f-field">
            <div className="f-label">내용</div>
            <input
              className="c-ctl c-input"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="학습 내용"
              autoFocus
            />
          </div>

          <div className="f-field">
            <div className="f-label">시간(분)</div>
            <input
              className="c-ctl c-input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={draft.minutes}
              onChange={(e) => setDraft((p) => ({ ...p, minutes: e.target.value }))}
              placeholder="60"
            />
            <div className="f-hint">예시: 30, 60</div>
          </div>

          <div className="f-field">
            <div className="f-label">설명</div>
            <textarea
              className="c-ctl c-textarea"
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder="자유 메모"
              rows={3}
            />
          </div>

          <div className="m-footer" style={{ padding: 0 }}>
            <button className="c-ctl c-btn" type="button" onClick={() => setAddOpen(false)} disabled={saving}>
              취소
            </button>
            <button className="c-ctl c-btn" type="button" onClick={addEvent} disabled={saving}>
              {saving ? "저장중..." : "등록"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
