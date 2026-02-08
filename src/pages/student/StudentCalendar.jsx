import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase"; // 네 경로로 맞춰
import { useMyProfile} from "../../hooks/useMyProfile";
import {
  addDays,
  formatKoreanMD,
  formatWeekRange,
  startOfWeekMonday,
  toISODate,
} from "../../features/week";

const CATEGORIES = ["기초 역량 강화", "진로 탐색"];
const DOW = ["월", "화", "수", "목", "금", "토", "일"];

function minutesToHoursText(min) {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}시간` : `${h.toFixed(1)}시간`;
}
function hoursToMinutes(hoursStr) {
  const n = Number(hoursStr);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 60);
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
      <button className="modal-overlay__backdrop" onClick={onClose} aria-label="close" />
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

  const [selectedIdx, setSelectedIdx] = useState(() => {
    const today = new Date();
    const wMon = startOfWeekMonday(today);
    return Math.max(0, Math.min(6, Math.floor((today - wMon) / (1000 * 60 * 60 * 24))));
  });

  // week 바뀌면 선택도 월요일로 리셋(원하면 0 고정)
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
    hours: "1",
  });

  const weekStartISO = toISODate(monday);
  const weekEndISO = toISODate(addDays(monday, 6));

  async function fetchWeek() {
    if (!uid) return;
    setFetching(true);
    setError("");

    const { data, error } = await supabase
      .from("events")
      .select("id, owner_id, title, description, category, date, duration_min, created_at")
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
      if (base[ev.category] !== undefined) base[ev.category] += ev.duration_min || 0;
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
      hours: "1",
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

    const minutes = hoursToMinutes(draft.hours);
    if (!minutes) {
      setError("시간(hours)은 0보다 큰 숫자여야 함");
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
    const ok = window.confirm("이 항목을 삭제할까?");
    if (!ok) return;

    setError("");
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    await fetchWeek();
  }

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container calendar-page">
      <div className="calendar-top">
        <div className="calendar-top__left">
          <h2 className="calendar-title">주간 학습</h2>
          <div className="calendar-subtitle">{formatWeekRange(monday)}</div>
        </div>

        <div className="calendar-top__right">
          <button className="button" onClick={() => setWeekBase(addDays(monday, -7))}>
            이전 주
          </button>
          <button className="button" onClick={() => setWeekBase(startOfWeekMonday(new Date()))}>
            이번 주
          </button>
          <button className="button" onClick={() => setWeekBase(addDays(monday, 7))}>
            다음 주
          </button>
        </div>
      </div>

      <div className="card calendar-summary">
        <div className="calendar-summary__row">
          <div className="calendar-summary__item">
            <div className="calendar-summary__label">기초 역량 강화</div>
            <div className="calendar-summary__value">
              {minutesToHoursText(totals["기초 역량 강화"])}
            </div>
          </div>
          <div className="calendar-summary__item">
            <div className="calendar-summary__label">진로 탐색</div>
            <div className="calendar-summary__value">{minutesToHoursText(totals["진로 탐색"])}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert--error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {/* 월~일 선택 탭 */}
      <div className="day-tabs" role="tablist" aria-label="week days">
        {weekDays.map((d, idx) => {
          const iso = toISODate(d);
          const count = (eventsByDate.get(iso) ?? []).length;
          const active = idx === selectedIdx;

          return (
            <button
              key={iso}
              className={`day-tab ${active ? "day-tab--active" : ""}`}
              onClick={() => setSelectedIdx(idx)}
              role="tab"
              aria-selected={active}
            >
              <div className="day-tab__top">
                <span className="day-tab__dow">{DOW[idx]}</span>
                <span className="day-tab__md">{formatKoreanMD(d)}</span>
              </div>
              <div className="day-tab__count">{count}건</div>
            </button>
          );
        })}
      </div>

      {/* 선택된 하루만 표시 */}
      <div className="card day-panel">
        <div className="day-panel__header">
          <div className="day-panel__title">
            {DOW[selectedIdx]}요일 · {formatKoreanMD(selectedDate)}
          </div>
          <button className="button" onClick={openAdd}>
            일정 추가
          </button>
        </div>

        <div className="day-panel__body">
          {fetching ? (
            <div className="day-panel__empty">불러오는 중...</div>
          ) : selectedList.length === 0 ? (
            <div className="day-panel__empty">등록된 학습 없음</div>
          ) : (
            <div className="day-panel__list">
              {selectedList.map((ev) => (
                <div key={ev.id} className="event-row">
                  <div className="event-row__main">
                    <div className="event-row__top">
                      <span className={`badge ${ev.category === "진로 탐색" ? "badge--alt" : ""}`}>
                        {ev.category}
                      </span>
                      <span className="event-row__time">{minutesToHoursText(ev.duration_min)}</span>
                    </div>
                    <div className="event-row__title">{ev.title}</div>
                    {ev.description ? <div className="event-row__desc">{ev.description}</div> : null}
                  </div>

                  <button className="button button--danger" onClick={() => deleteEvent(ev.id)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD MODAL */}
      <Modal
        open={addOpen}
        title={`${DOW[selectedIdx]}요일 (${formatKoreanMD(selectedDate)}) 일정 추가`}
        onClose={() => setAddOpen(false)}
      >
        <div className="field">
          <div className="label">카테고리</div>
          <select
            className="input"
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

        <div className="field" style={{ marginTop: 10 }}>
          <div className="label">내용</div>
          <input
            className="input"
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="학습 내용"
            autoFocus
          />
          <div className="hint">텍스트 자유 입력</div>
        </div>

        <div className="field" style={{ marginTop: 10 }}>
          <div className="label">시간(시간)</div>
          <input
            className="input"
            value={draft.hours}
            onChange={(e) => setDraft((p) => ({ ...p, hours: e.target.value }))}
            placeholder="1"
            inputMode="decimal"
          />
          <div className="hint">예: 1, 1.5</div>
        </div>

        <div className="field" style={{ marginTop: 10 }}>
          <div className="label">설명(선택)</div>
          <textarea
            className="input"
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder="자유 메모"
            rows={3}
          />
        </div>

        <div className="modal__footer">
          <button className="button" onClick={() => setAddOpen(false)} disabled={saving}>
            취소
          </button>
          <button className="button" onClick={addEvent} disabled={saving}>
            {saving ? "저장중..." : "등록"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
