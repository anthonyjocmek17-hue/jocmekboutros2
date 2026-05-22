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

export function ThemeSwitch() {
  const pathname = usePathname() ?? "/";
  const hidden = useMemo(() => shouldHide(pathname), [pathname]);

  // Pre-paint script in app/layout.tsx already set the `dark` class on <html>
  // from localStorage or the OS preference. Mirror that DOM state here so the
  // first client render of the toggle matches the actual theme (no icon flip).
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

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label="Theme"
      title={isDark ? "Switch to light mode" : "Switch to night mode"}
      onClick={() => {
        const next: Theme = isDark ? "light" : "dark";
        setTheme(next);
        window.localStorage.setItem("theme", next);
        applyTheme(next);
      }}
      className={[
        "relative inline-flex h-10 w-[92px] items-center rounded-full border border-black/10 bg-white/70 px-2 shadow-sm backdrop-blur transition",
        "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "active:translate-y-[1px]",
        "dark:border-white/15 dark:bg-slate-900/60 dark:hover:bg-slate-900/70"
      ].join(" ")}
    >
      <span className="flex w-full items-center justify-between">
        <span className={["inline-flex h-7 w-7 items-center justify-center", isDark ? "text-slate-400" : "text-amber-600"].join(" ")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
        </span>

        <span className={["inline-flex h-7 w-7 items-center justify-center", isDark ? "text-sky-300" : "text-slate-400"].join(" ")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21 13.2A7.8 7.8 0 0 1 10.8 3a7 7 0 1 0 10.2 10.2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>

      <span
        aria-hidden
        className={[
          "pointer-events-none absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full shadow-md ring-1 ring-black/5 transition-transform",
          "grid place-items-center",
          isDark
            ? "translate-x-[50px] bg-slate-900 text-sky-200 ring-white/10 shadow-[0_12px_30px_rgba(56,189,248,.28)]"
            : "translate-x-0 bg-white text-amber-600 shadow-[0_12px_30px_rgba(245,158,11,.28)]",
          "dark:ring-white/10"
        ].join(" ")}
      >
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21 13.2A7.8 7.8 0 0 1 10.8 3a7 7 0 1 0 10.2 10.2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
        )}
      </span>
    </button>
  );
}

