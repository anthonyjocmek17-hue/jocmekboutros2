"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark";

function shouldHide(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/login")
  );
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeToggle() {
  const pathname = usePathname() ?? "/";
  const hidden = useMemo(() => shouldHide(pathname), [pathname]);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  useEffect(() => {
    if (hidden) return;

    const domTheme: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(domTheme);

    const saved = window.localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark") {
      if (saved !== domTheme) {
        setTheme(saved);
        applyTheme(saved);
      }
    }
  }, [hidden]);

  if (hidden) return null;

  return (
    <button
      type="button"
      className="ui-btn rounded-full border-black/10 bg-white/70 px-2 py-2 hover:bg-white"
      onClick={() => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
        window.localStorage.setItem("theme", next);
        applyTheme(next);
      }}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to night mode"}
    >
      <span className="sr-only">{theme === "dark" ? "Switch to light mode" : "Switch to night mode"}</span>
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 13.2A7.8 7.8 0 0 1 10.8 3a7 7 0 1 0 10.2 10.2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

