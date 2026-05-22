"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

function shouldHide(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/login")
  );
}

export function InteractiveBackground() {
  const pathname = usePathname() ?? "/";
  const hidden = useMemo(() => shouldHide(pathname), [pathname]);

  useEffect(() => {
    if (hidden) return;

    const root = document.documentElement;
    const set = (x: number, y: number) => {
      root.style.setProperty("--bg-mx", `${Math.round(x)}px`);
      root.style.setProperty("--bg-my", `${Math.round(y)}px`);
    };

    const onMove = (e: PointerEvent) => set(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) set(t.clientX, t.clientY);
    };

    // start centered-ish
    set(window.innerWidth * 0.55, window.innerHeight * 0.25);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [hidden]);

  if (hidden) return null;

  return <div aria-hidden className="interactive-bg" />;
}

