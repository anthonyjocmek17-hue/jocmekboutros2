"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Toast = {
  id: string;
  title: string;
  description?: string;
};

type ToastContextValue = {
  push: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(() => {
    return {
      push: (t) => {
        const id = crypto.randomUUID?.() ?? String(Math.random());
        setToasts((prev) => [...prev, { id, ...t }]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id));
        }, 1800);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 grid gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="w-[280px] rounded-2xl border border-black/10 bg-white/90 p-3 shadow-menu backdrop-blur"
          >
            <div className="text-sm font-semibold">{t.title}</div>
            {t.description ? <div className="mt-0.5 text-xs text-black/60">{t.description}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

