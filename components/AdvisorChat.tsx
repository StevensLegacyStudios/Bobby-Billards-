"use client";

import { useState } from "react";
import type { Profile } from "@/lib/profile";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Should I buy new or used in my situation?",
  "How do I avoid getting ripped off at the dealer?",
  "What should my down payment be?",
];

export function AdvisorChat({ profile, context }: { profile: Profile; context?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, question, context }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer ?? "Something went wrong." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Network error — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Ask CarMan</h2>
      <p className="mt-1 text-sm text-slate-500">
        Your AI advisor knows your numbers. Ask anything about buying or financing.
      </p>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-brand hover:text-brand-dark"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-8 bg-brand text-white"
                : "mr-8 bg-slate-100 text-slate-800"
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="mr-8 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">CarMan is thinking…</div>}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
