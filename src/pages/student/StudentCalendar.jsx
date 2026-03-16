import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMyProfile } from "../../hooks/useMyProfile";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useCalendarView } from "../../lib/useCalendarView";
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
const TITLE_MAX = 50;
const DESC_MAX = 200;

/**
 * 주 탐색 접근 정책 설정
 *
 * prevWeekAccess:
 *   - allowedUntil: 저번 주에 접근 가능한 마감 시점
 *     - dayOfWeek: 0=일 ~ 6=토 (JS 기본 요일)
 *     - hour / minute: 해당 시각 (로컬 시간 기준)
 *   - 예) 매주 월요일 08:30까지 저번 주 접근 허용
 *     → { dayOfWeek: 1, hour: 8, minute: 30 }
 *
 * nextWeekLimit:
 *   - maxWeeksAhead: 이번 주 기준 몇 주 앞까지 허용할지 (기본 2 → 이번 주 포함 총 3주)
 */
const WEEK_ACCESS_POLICY = {
  prevWeekAccess: {
    allowedUntil: { dayOfWeek: 1, hour: 8, minute: 30 },
  },
  nextWeekLimit: {
    maxWeeksAhead: 2,
  },
};

const DEFAULT_DRAFT = {
  category: CATEGORIES[0],
  title: "",
  description: "",
  minutes: "",
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

/** ISO 날짜/시간 → "yyyy-mm-dd hh:mm" */
function formatDateTimeKST(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/**
 * 저번 주 접근 가능 여부 판단
 *
 * 현재 시각이 policy.allowedUntil 이전이면 true를 반환한다.
 * 예) allowedUntil = { dayOfWeek: 1, hour: 8, minute: 30 }
 *   → 매주 월요일 08:30 이전에는 저번 주 접근 허용
 *
 * @param {{ dayOfWeek: number, hour: number, minute: number }} allowedUntil
 * @param {Date} [now]
 */
function isPrevWeekAccessible(allowedUntil, now = new Date()) {
  const { dayOfWeek, hour, minute } = allowedUntil;
  const nowDay = now.getDay(); // 0=일 ~ 6=토

  if (nowDay !== dayOfWeek) return nowDay < dayOfWeek;

  // 같은 요일이면 시:분 비교
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const limitMinutes = hour * 60 + minute;
  return nowMinutes < limitMinutes;
}

// ─── Supabase API ─────────────────────────────────────────────────────────────

async function fetchWeekEvents({ uid, weekStartISO, weekEndISO }) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, owner_id, title, description, category, date, duration_min, is_done, created_at"
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

async function updateEventDoneById({ id, isDone }) {
  const { error } = await supabase
    .from("events")
    .update({ is_done: isDone })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function fetchReflection({ uid, weekStartISO }) {
  const { data, error } = await supabase
    .from("weekly_reflections")
    .select("id, content, updated_at")
    .eq("owner_id", uid)
    .eq("week_start", weekStartISO)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

async function upsertReflection({ uid, weekStartISO, content }) {
  const { error } = await supabase
    .from("weekly_reflections")
    .upsert(
      { owner_id: uid, week_start: weekStartISO, content },
      { onConflict: "owner_id,week_start" }
    );
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

  return { events, setEvents, fetching, error, reload: load };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CharCount({ value, max }) {
  const len = (value ?? "").length;
  const over = len > max;

  return (
    <div
      className="f-hint"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        color: over ? "var(--accent-danger)" : "var(--text-muted)",
      }}
      aria-live="polite"
    >
      {len}/{max}
    </div>
  );
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
            <CategoryBadge>{event.category}</CategoryBadge>
            <DurationLabel minutes={event.duration_min} />
          </div>
          <div style={{ marginTop: 6, fontWeight: 900 }}>{event.title}</div>
          {event.description && (
            <EventDescription>{event.description}</EventDescription>
          )}
        </div>
        <DeleteButton onClick={() => onDelete(event.id)} />
      </div>
    </div>
  );
}

function TodoItem({ event, checked, onToggle, onDelete, disabled }) {
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
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
            flex: 1,
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(event.id, e.target.checked)}
            disabled={disabled}
            style={{ marginTop: 3 }}
          />
          <div style={{ color: "var(--text-1)" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <CategoryBadge>{event.category}</CategoryBadge>
              <DurationLabel minutes={event.duration_min} />
            </div>
            <div
              style={{
                marginTop: 6,
                fontWeight: 900,
                color: checked ? "var(--text-muted)" : "var(--text-1)",
                textDecoration: checked ? "line-through" : "none",
              }}
            >
              {event.title}
            </div>
            {event.description && (
              <EventDescription strikethrough={checked}>
                {event.description}
              </EventDescription>
            )}
          </div>
        </label>
        <DeleteButton onClick={() => onDelete(event.id)} />
      </div>
    </div>
  );
}

// ─── Shared atomic sub-components (중복 제거) ────────────────────────────────

function CategoryBadge({ children }) {
  return (
    <span
      className="u-panel"
      style={{
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        background: "var(--bg-1)",
        textDecoration: "none",
      }}
    >
      {children}
    </span>
  );
}

function DurationLabel({ minutes }) {
  return (
    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
      {formatMinutesAsHM(minutes)}
    </span>
  );
}

function EventDescription({ children, strikethrough = false }) {
  return (
    <div
      style={{
        marginTop: 6,
        color: "var(--text-muted)",
        fontSize: 13,
        whiteSpace: "pre-wrap",
        textDecoration: strikethrough ? "line-through" : "none",
      }}
    >
      {children}
    </div>
  );
}

function DeleteButton({ onClick }) {
  return (
    <button
      className="c-ctl c-btn c-btn--danger"
      type="button"
      onClick={onClick}
      style={{
        width: 60,
        height: 32,
        flex: "0 0 auto",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      삭제
    </button>
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
          placeholder="수학의 정석 1단원 연습문제"
          autoFocus
          maxLength={TITLE_MAX}
        />
        <CharCount value={draft.title} max={TITLE_MAX} />
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
          placeholder="수학의 정석 연습문제 1-1 ~ 1-10"
          rows={3}
          maxLength={DESC_MAX}
        />
        <CharCount value={draft.description} max={DESC_MAX} />
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
  const isOnline = useNetworkStatus();
  const { viewMode } = useCalendarView();

  // ── 주 탐색 경계 계산 ──
  const thisMonday = useMemo(() => startOfWeekMonday(new Date()), []);

  /**
   * 저번 주 접근 가능 여부를 실시간으로 판단
   * policy 기준: 매주 월요일 08:30 이전이면 저번 주 허용
   */
  const canAccessPrevWeek = useMemo(
    () => isPrevWeekAccessible(WEEK_ACCESS_POLICY.prevWeekAccess.allowedUntil),

    [] // 컴포넌트 마운트 시 한 번 계산 (주 이동 중 변하지 않음)
  );

  const minMonday = useMemo(
    () =>
      canAccessPrevWeek
        ? addDays(thisMonday, -7) // 저번 주 허용
        : thisMonday, // 이번 주가 최솟값
    [thisMonday, canAccessPrevWeek]
  );

  const maxMonday = useMemo(
    () =>
      addDays(thisMonday, WEEK_ACCESS_POLICY.nextWeekLimit.maxWeeksAhead * 7),
    [thisMonday]
  );

  // ── 주 탐색 상태 ──
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
    setEvents,
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

  const selectedList = useMemo(
    () => eventsByDate.get(selectedISO) ?? [],
    [eventsByDate, selectedISO]
  );

  const selectedDoneCount = useMemo(
    () => selectedList.filter((ev) => Boolean(ev.is_done)).length,
    [selectedList]
  );

  const [togglingMap, setTogglingMap] = useState({});

  // ── 주 이동 ──
  const navigateWeek = useCallback(
    (offsetDays) => {
      setSelectedIdx(0);
      setWeekBase(addDays(monday, offsetDays));
    },
    [monday]
  );

  const goToThisWeek = useCallback(() => {
    setSelectedIdx(getTodayDowIndex());
    setWeekBase(startOfWeekMonday(new Date()));
  }, []);

  // ── 완료 토글 ──
  const toggleChecked = useCallback(
    async (eventId, nextChecked) => {
      if (togglingMap[eventId]) return;

      setTogglingMap((prev) => ({ ...prev, [eventId]: true }));
      // Optimistic update
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, is_done: nextChecked } : ev
        )
      );

      try {
        await updateEventDoneById({ id: eventId, isDone: nextChecked });
      } catch (err) {
        // Rollback on failure
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === eventId ? { ...ev, is_done: !nextChecked } : ev
          )
        );
        window.alert(err.message);
      } finally {
        setTogglingMap((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
    },
    [togglingMap, setEvents]
  );

  // ── 이벤트 추가 모달 상태 ──
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);

  const updateDraft = useCallback((field, value) => {
    const v = value ?? "";
    const limited =
      field === "title"
        ? v.slice(0, TITLE_MAX)
        : field === "description"
        ? v.slice(0, DESC_MAX)
        : v;
    setDraft((prev) => ({ ...prev, [field]: limited }));
  }, []);

  const openAddModal = useCallback(() => {
    setFormError("");
    setDraft({ ...DEFAULT_DRAFT });
    setAddOpen(true);
  }, []);

  const closeAddModal = useCallback(() => setAddOpen(false), []);

  // ── 이벤트 추가 ──
  const handleAddEvent = useCallback(async () => {
    if (!uid) return;

    const trimmedTitle = draft.title.trim();
    const trimmedDesc = draft.description.trim();

    if (!trimmedTitle) {
      setFormError("내용은 비워둘 수 없음");
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setFormError(`내용은 ${TITLE_MAX}자 이하여야 함`);
      return;
    }
    if (trimmedDesc.length > DESC_MAX) {
      setFormError(`설명은 ${DESC_MAX}자 이하여야 함`);
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
        title: trimmedTitle,
        description: trimmedDesc || null,
        duration_min: minutes,
        is_done: false,
      });
      setAddOpen(false);
      await reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }, [uid, draft, selectedISO, reload]);

  // ── 이벤트 삭제 ──
  const handleDeleteEvent = useCallback(
    async (id) => {
      if (!window.confirm("이 항목을 삭제하겠습니까?")) return;
      try {
        await deleteEventById(id);
        await reload();
      } catch (err) {
        window.alert(err.message);
      }
    },
    [reload]
  );

  // ── 주간 성찰 ──
  const [reflection, setReflection] = useState(null);
  const [refDraft, setRefDraft] = useState("");
  const [refSaving, setRefSaving] = useState(false);
  const [refError, setRefError] = useState("");
  const [refEditing, setRefEditing] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setReflection(null);
    setRefDraft("");
    setRefEditing(false);
    setRefError("");

    fetchReflection({ uid, weekStartISO })
      .then((data) => {
        setReflection(data);
        setRefDraft(data?.content ?? "");
      })
      .catch((err) => setRefError(err.message));
  }, [uid, weekStartISO]);

  const handleSaveReflection = useCallback(async () => {
    if (!refDraft.trim()) return;
    setRefSaving(true);
    setRefError("");
    try {
      await upsertReflection({ uid, weekStartISO, content: refDraft.trim() });
      const updated = await fetchReflection({ uid, weekStartISO });
      setReflection(updated);
      setRefEditing(false);
    } catch (err) {
      setRefError(err.message);
    } finally {
      setRefSaving(false);
    }
  }, [uid, weekStartISO, refDraft]);

  const handleCancelReflection = useCallback(() => {
    setRefDraft(reflection?.content ?? "");
    setRefEditing(false);
  }, [reflection]);

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

      {/* ── 오프라인 배너 ── */}
      {!isOnline && (
        <div className="u-alert u-alert--error">
          인터넷 연결이 끊겼습니다. 와이파이를 확인해주세요.
        </div>
      )}

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
                  color: count > 0 ? "var(--text-1)" : "var(--text-muted)",
                  fontWeight: count > 0 ? "600" : "300",
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
            {viewMode === "todo"
              ? ` · 완료 ${selectedDoneCount}/${selectedList.length}`
              : ""}
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
              {viewMode === "todo"
                ? selectedList.map((ev) => (
                    <TodoItem
                      key={ev.id}
                      event={ev}
                      checked={Boolean(ev.is_done)}
                      onToggle={toggleChecked}
                      onDelete={handleDeleteEvent}
                      disabled={Boolean(togglingMap[ev.id])}
                    />
                  ))
                : selectedList.map((ev) => (
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

      {/* ── 주간 성찰 ── */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>주간 성찰</div>
          {reflection && !refEditing && (
            <button
              className="c-ctl c-btn"
              type="button"
              onClick={() => setRefEditing(true)}
            >
              수정
            </button>
          )}
        </div>

        {refError && (
          <div className="u-alert u-alert--error" style={{ marginBottom: 10 }}>
            {refError}
          </div>
        )}

        {reflection && !refEditing ? (
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.6,
              padding: "8px 12px",
              borderLeft: "3px solid var(--border-focus)",
            }}
          >
            {reflection.content}
          </div>
        ) : (
          <textarea
            className="c-ctl c-textarea"
            rows={5}
            value={refDraft}
            onChange={(e) => setRefDraft(e.target.value)}
            placeholder="이번 주를 돌아보며 느낀 점을 작성해주세요."
            autoFocus={refEditing}
          />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {reflection?.updated_at
              ? `마지막 저장: ${formatDateTimeKST(reflection.updated_at)}`
              : "아직 작성되지 않았습니다."}
          </div>

          {(!reflection || refEditing) && (
            <div style={{ display: "flex", gap: 8 }}>
              {refEditing && (
                <button
                  className="c-ctl c-btn"
                  type="button"
                  onClick={handleCancelReflection}
                  disabled={refSaving}
                >
                  취소
                </button>
              )}
              <button
                className="c-ctl c-btn"
                type="button"
                onClick={handleSaveReflection}
                disabled={
                  refSaving ||
                  !refDraft.trim() ||
                  refDraft.trim() === reflection?.content
                }
              >
                {refSaving ? "저장 중..." : "저장"}
              </button>
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
        onClose={closeAddModal}
      >
        <AddEventForm
          draft={draft}
          onChange={updateDraft}
          onSubmit={handleAddEvent}
          onCancel={closeAddModal}
          saving={saving}
          error={formError}
        />
      </Modal>
    </div>
  );
}
