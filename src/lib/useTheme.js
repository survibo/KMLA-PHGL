import { useEffect, useState } from "react";

const KEY = "phgl_theme"; // "dark" | "light"

function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
}

function getInitialTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;

  // 저장값 없으면 시스템 설정 따라감
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      applyTheme(next);
      return next;
    });
  }

  return { theme, toggleTheme };
}
