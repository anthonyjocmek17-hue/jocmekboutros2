"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AssistantResponse = {
  reply: string;
  matchedFiles: string[];
};

type ChatMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; matchedFiles?: string[] };

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Hi! Ask me anything about the menu (burgers, sandwiches, drinks, desserts, allergens, opening hours)."
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMatchedFilesRef = useRef<string[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  async function send() {
    const text = input.trim();
    if (!text || isSending) return;

    const lastMatchedFiles = lastMatchedFilesRef.current;

    setError(null);
    setIsSending(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const res = await fetch("/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context: { lastMatchedFiles } })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as AssistantResponse;
      lastMatchedFilesRef.current = Array.isArray(data.matchedFiles) ? data.matchedFiles : [];
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          matchedFiles: data.matchedFiles
        }
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to send message");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry — I couldn’t load the menu response right now. Please try again."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-sm font-semibold text-accent">Menu Assistant</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">
          This assistant answers strictly from the local Markdown menu files in <code>knowledge-base/</code>.
        </p>
      </div>

      <div className="ui-card-strong p-4">
        <div className="max-h-[60vh] space-y-3 overflow-auto rounded-xl bg-black/[0.02] p-4 dark:bg-white/5">
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-black/10 bg-white text-black dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100/90"
                ].join(" ")}
              >
                {m.text}
                {"matchedFiles" in m && m.matchedFiles && m.matchedFiles.length > 0 ? (
                  <div className="mt-2 text-[11px] text-black/50 dark:text-slate-200/60">
                    Matched: {m.matchedFiles.join(", ")}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error ? <div className="mt-3 text-xs font-medium text-red-700">{error}</div> : null}

        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask about burgers, chicken sandwiches, garlic, allergens, opening hours..."
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            disabled={isSending}
          />
          <button
            onClick={() => void send()}
            disabled={!canSend}
            className={[
              "rounded-xl px-4 py-3 text-sm font-semibold",
              canSend ? "bg-blue-600 text-white" : "bg-black/5 text-black/40 dark:bg-white/10 dark:text-slate-200/60"
            ].join(" ")}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

