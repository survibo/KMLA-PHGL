import { useState } from "react";

const KEY = "phgl_calendar_view_mode"; // "classic" | "todo"

function normalizeMode(value) {
  return value === "classic" ? "classic" : "todo";
}

function getInitialMode() {
  return normalizeMode(localStorage.getItem(KEY));
}

export function useCalendarView() {
  const [viewMode, setViewModeState] = useState(getInitialMode);

  function setViewMode(nextMode) {
    const normalized = normalizeMode(nextMode);
    localStorage.setItem(KEY, normalized);
    setViewModeState(normalized);
  }

  return { viewMode, setViewMode };
}
