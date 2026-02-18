import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMyProfile } from "../../hooks/useMyProfile";
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
const WEEK_LIMIT = { prev: -7, next: 21 }; // 이전 1주 / 이후 3주

const DEFAULT_DRAFT = {
  category: CATEGORIES[0],
  title: "",
  description: "",
  minutes: "60",
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** 분 → "n시간 m분" 형식 (개별 항목용) */
function formatMinutesAsHM(totalMinutes) {
  const minutes = Number(totalMinutes) || 0;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours <= 0) return `${remainder}분`;
  if (remainder === 0) return `${hours}시간`;
  return `${hours}시간 ${remainder}분`;
}

/** 분 → 소수점 1자리 시간 형식, 불필요한 .0 제거 (주간 요약용) */
function formatMinutesAsDecimalHours(totalMinutes) {
  const hours = (Number(totalMinutes) || 0) / 60;
  return `${hours.toFixed(1).replace(/\.0$/, "")}시간`;
}

/** 분 문자열 검증 → 1 이상의 자연수만 허용, 아니면 null */
function parsePositiveInt(value) {
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

/** 오늘 기준 이번 주 요일 인덱스 계산 (0=월 ~ 6=일) */
function getTodayDowIndex() {
  const today = new Date();
  const monday = startOfWeekMonday(today);
  const diff = Math.floor((today - monday) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(6, diff));
}

// ─── Supabase API ─────────────────────────────────────────────────────────────

async function fetchWeekEvents({ uid, weekStartISO, weekEndISO }) {
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

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function insertEvent(payload) {
  const { error } = await supabase.from("events").insert(payload);
  if (error) throw new Error(error.message);
}

async function deleteEventById(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Local custom hook ────────────────────────────────────────────────────────

function useWeekEvents({ uid, weekStartISO, weekEndISO }) {
  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!uid) return;
    setFetching(true);
    setError("");
    try {
      const data = await fetchWeekEvents({ uid, weekStartISO, weekEndISO });
      setEvents(data);
    } catch (err) {
      setError(err.message);
      setEvents([]);
    } finally {
      setFetching(false);
    }
  }, [uid, weekStartISO, weekEndISO]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, fetching, error, reload: load };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function WeeklySummary({ totals }) {
  return (
    <div className="r-split" style={{ marginTop: 10 }}>
      {CATEGORIES.map((cat) => (
        <div
          key={cat}
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
            {cat}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
            {formatMinutesAsDecimalHours(totals[cat])}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventCard({ event, onDelete }) {
  return (
    <div
      className="u-panel"
      style={{
        background: "var(--bg-2)",
        padding: 12,
        borderRadius: "var(--radius-2)",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
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
              {event.category}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {formatMinutesAsHM(event.duration_min)}
            </span>
          </div>

          <div style={{ marginTop: 6, fontWeight: 900 }}>{event.title}</div>

          {event.description && (
            <div
              style={{
                marginTop: 6,
                color: "var(--text-muted)",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {event.description}
            </div>
          )}
        </div>

        <button
          className="c-ctl c-btn c-btn--danger"
          type="button"
          onClick={() => onDelete(event.id)}
          style={{ height: "fit-content" }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function AddEventForm({ draft, onChange, onSubmit, onCancel, saving, error }) {
  return (
    <div className="l-section">
      {error && <div className="u-alert u-alert--error">{error}</div>}

      <div className="f-field">
        <div className="f-label">카테고리</div>
        <select
          className="c-ctl c-input"
          value={draft.category}
          onChange={(e) => onChange("category", e.target.value)}
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
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="ex) 수학의 정석 1단원 연습문제"
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
          onChange={(e) => onChange("minutes", e.target.value)}
          placeholder="60"
        />
        <div className="f-hint">예시: 30, 60</div>
      </div>

      <div className="f-field">
        <div className="f-label">설명</div>
        <textarea
          className="c-ctl c-textarea"
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="ex) 수학의 정석 연습문제 1-1 ~ 1-10"
          rows={3}
        />
      </div>

      <div className="m-footer" style={{ padding: 0 }}>
        <button
          className="c-ctl c-btn"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          취소
        </button>
        <button
          className="c-ctl c-btn"
          type="button"
          onClick={onSubmit}
          disabled={saving}
        >
          {saving ? "저장중..." : "등록"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentCalendar() {
  const { session, loading } = useMyProfile();
  const uid = session?.user?.id;

  // ── 주 탐색 상태 ──
  const thisMonday = useMemo(() => startOfWeekMonday(new Date()), []);
  const minMonday = useMemo(
    () => addDays(thisMonday, WEEK_LIMIT.prev),
    [thisMonday]
  );
  const maxMonday = useMemo(
    () => addDays(thisMonday, WEEK_LIMIT.next),
    [thisMonday]
  );

  const [weekBase, setWeekBase] = useState(() => startOfWeekMonday(new Date()));
  const [selectedIdx, setSelectedIdx] = useState(getTodayDowIndex);

  const monday = useMemo(() => startOfWeekMonday(weekBase), [weekBase]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  const canPrev = monday.getTime() > minMonday.getTime();
  const canNext = monday.getTime() < maxMonday.getTime();
  const isThisWeek = toISODate(monday) === toISODate(thisMonday);

  const selectedDate = weekDays[selectedIdx];
  const selectedISO = toISODate(selectedDate);
  const weekStartISO = toISODate(monday);
  const weekEndISO = toISODate(addDays(monday, 6));

  // ── 이벤트 데이터 ──
  const {
    events,
    fetching,
    error: fetchError,
    reload,
  } = useWeekEvents({ uid: loading ? null : uid, weekStartISO, weekEndISO });

  const eventsByDate = useMemo(() => {
    const map = new Map(weekDays.map((d) => [toISODate(d), []]));
    for (const ev of events) {
      map.get(ev.date)?.push(ev);
    }
    return map;
  }, [events, weekDays]);

  const totals = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((cat) => [
          cat,
          events
            .filter((ev) => ev.category === cat)
            .reduce((sum, ev) => sum + (ev.duration_min || 0), 0),
        ])
      ),
    [events]
  );

  const selectedList = eventsByDate.get(selectedISO) ?? [];

  // ── 주 이동 ──
  const navigateWeek = (offset) => {
    setSelectedIdx(0);
    setWeekBase(addDays(monday, offset));
  };

  const goToThisWeek = () => {
    setSelectedIdx(getTodayDowIndex());
    setWeekBase(startOfWeekMonday(new Date()));
  };

  // ── 이벤트 추가 모달 상태 ──
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);

  const updateDraft = (field, value) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const openAddModal = () => {
    setFormError("");
    setDraft({ ...DEFAULT_DRAFT });
    setAddOpen(true);
  };

  // ── 이벤트 추가 ──
  const handleAddEvent = async () => {
    if (!uid) return;

    if (!draft.title.trim()) {
      setFormError("내용은 비워둘 수 없음");
      return;
    }
    if (!CATEGORIES.includes(draft.category)) {
      setFormError("카테고리가 올바르지 않음");
      return;
    }

    const minutes = parsePositiveInt(draft.minutes);
    if (!minutes) {
      setFormError("시간(분)은 1 이상의 자연수여야 함");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await insertEvent({
        owner_id: uid,
        date: selectedISO,
        category: draft.category,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        duration_min: minutes,
      });
      setAddOpen(false);
      await reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── 이벤트 삭제 ──
  const handleDeleteEvent = async (id) => {
    if (!window.confirm("이 항목을 삭제하겠습니까?")) return;

    try {
      await deleteEventById(id);
      await reload();
    } catch (err) {
      window.alert(err.message);
    }
  };

  // ── 렌더 ──
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
      {/* ── 헤더 ── */}
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
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isThisWeek ? 900 : 400,
                  color: isThisWeek ? "#166534" : "var(--text-muted)",
                  background: isThisWeek
                    ? "rgba(34, 197, 94, 0.12)"
                    : "transparent",
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
                onClick={() => navigateWeek(-7)}
                disabled={!canPrev}
              >
                이전 주
              </button>
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={goToThisWeek}
              >
                이번 주
              </button>
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={() => navigateWeek(7)}
                disabled={!canNext}
              >
                다음 주
              </button>
            </div>
          </div>

          <WeeklySummary totals={totals} />
        </div>
      </div>

      {/* ── 전역 에러 ── */}
      {fetchError && <div className="u-alert u-alert--error">{fetchError}</div>}

      {/* ── 요일 탭 ── */}
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
        {weekDays.map((day, idx) => {
          const iso = toISODate(day);
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
                  {formatKoreanMD(day)}
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

      {/* ── 선택된 날 패널 ── */}
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
          <button className="c-ctl c-btn" type="button" onClick={openAddModal}>
            일정 추가
          </button>
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
                <EventCard
                  key={ev.id}
                  event={ev}
                  onDelete={handleDeleteEvent}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 추가 모달 ── */}
      <Modal
        open={addOpen}
        title={`${DOW[selectedIdx]}요일 (${formatKoreanMD(
          selectedDate
        )}) 일정 추가`}
        onClose={() => setAddOpen(false)}
      >
        <AddEventForm
          draft={draft}
          onChange={updateDraft}
          onSubmit={handleAddEvent}
          onCancel={() => setAddOpen(false)}
          saving={saving}
          error={formError}
        />
      </Modal>
    </div>
  );
}
