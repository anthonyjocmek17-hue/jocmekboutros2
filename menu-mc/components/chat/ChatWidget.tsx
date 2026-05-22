"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/useCart";

type Msg = { role: "user" | "assistant"; text: string };

function shouldHide(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/login")
  );
}

export function ChatWidget() {
  const pathname = usePathname() ?? "/";
  const hidden = useMemo(() => shouldHide(pathname), [pathname]);
  const cart = useCart();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! Ask me about the menu (e.g. “What burgers do you have?”)." }
  ]);

  if (hidden) return null;

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    setPending(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          cart: cart.state.lines.map((l) => ({ name: l.name, quantity: l.quantity }))
        })
      });

      const raw = await res.text();
      let data: { reply?: string; error?: string } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        data = { error: raw ? raw.slice(0, 400) : `HTTP ${res.status}` };
      }

      const reply = res.ok
        ? String(data.reply ?? "")
        : String(data.error ?? `Request failed (${res.status}).`);
      setMessages((m) => [...m, { role: "assistant", text: reply || "Sorry—no reply." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Network error—please try again." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[340px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
            <div className="text-xs font-semibold tracking-wide text-black/70 dark:text-slate-100/85">Assistant</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ui-btn rounded-lg px-2 py-1 text-xs font-semibold dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
            >
              Close
            </button>
          </div>

          <div className="max-h-[380px] space-y-2 overflow-auto px-3 py-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={[
                  "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-black/5 text-black dark:bg-white/10 dark:text-slate-100/90"
                ].join(" ")}
              >
                {m.text}
              </div>
            ))}
            {pending ? <div className="text-xs text-black/50 dark:text-slate-200/60">Thinking…</div> : null}
          </div>

          <div className="flex gap-2 border-t border-black/10 px-3 py-3 dark:border-white/10">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={pending}
              placeholder="Ask about the menu…"
              className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || !input.trim()}
              className="ui-btn ui-btn-green rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-emerald-700 dark:shadow-[0_18px_40px_rgba(56,189,248,.18)]"
        >
          Chat
        </button>
      )}
    </div>
  );
}

