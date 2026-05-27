import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "phgl_teacher_year_filter";
export const ALL_TEACHER_YEARS = "all";

export function getCreatedYear(row) {
  const d = new Date(row?.created_at ?? "");
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

export function matchesTeacherYear(row, selectedYear) {
  if (!selectedYear || selectedYear === ALL_TEACHER_YEARS) return true;
  return getCreatedYear(row) === selectedYear;
}

function readStoredYear() {
  if (typeof window === "undefined") return ALL_TEACHER_YEARS;
  return window.localStorage.getItem(STORAGE_KEY) || ALL_TEACHER_YEARS;
}

export function useTeacherYearFilter() {
  const [year, setYearState] = useState(readStoredYear);

  const setYear = useCallback((nextYear) => {
    const normalized = nextYear || ALL_TEACHER_YEARS;
    setYearState(normalized);
    window.localStorage.setItem(STORAGE_KEY, normalized);
    window.dispatchEvent(
      new CustomEvent("phgl-teacher-year-filter-change", {
        detail: normalized,
      })
    );
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        setYearState(event.newValue || ALL_TEACHER_YEARS);
      }
    };

    const onLocalChange = (event) => {
      setYearState(event.detail || ALL_TEACHER_YEARS);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("phgl-teacher-year-filter-change", onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "phgl-teacher-year-filter-change",
        onLocalChange
      );
    };
  }, []);

  return useMemo(() => ({ year, setYear }), [year, setYear]);
}
