import { useState } from "react";

const KEY = "phgl_theme"; // "dark" | "light"

function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
}

function getInitialTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;

  // 저장값 없으면 항상 light
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const t = getInitialTheme();
    applyTheme(t);
    return t;
  });

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
