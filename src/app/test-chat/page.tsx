"use client";

import { useRef, useState } from "react";

import type { Lead } from "@/lib/receptionist";

/**
 * THROWAWAY INTERNAL WORKBENCH — not customer-facing.
 *
 * A bare chat box for testing the receptionist brain in a browser: type, send,
 * see the reply, and watch the captured lead land. It posts the FULL running
 * history to the EXISTING POST /api/chat on every turn (the brain is stateless
 * per call), exactly as SMS/voice transports will. Nothing here touches the
 * brain, Prisma, the dashboard, or auth — it only calls the endpoint.
 */

type Msg = { role: "user" | "assistant"; content: string; isError?: boolean };

type ChatResponse = {
  ok: boolean;
  reply?: string;
  lead?: Lead | null;
  error?: string;
};

export default function TestChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    // Append the user's message, then post the FULL history (including it).
    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    // The API only accepts {role, content} — strip our UI-only `isError` flag,
    // and never send an error bubble back to the brain as a real turn.
    const history = nextMessages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, channel: "web" }),
      });

      const data = (await res.json()) as ChatResponse;

      if (!res.ok || !data.ok) {
        const detail = data.error ?? `HTTP ${res.status}`;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ Error: ${detail}`, isError: true },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "(empty reply)" },
      ]);
      if (data.lead) setLead(data.lead);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Request failed: ${detail}`,
          isError: true,
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
    setLead(null);
    setBusy(false);
    inputRef.current?.focus();
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>Receptionist test chat</h1>
        <button onClick={reset} disabled={busy}>
          Reset
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
        Internal workbench — posts full history to /api/chat each turn.
      </p>

      {/* Conversation */}
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: 12,
          minHeight: 240,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "#fafafa",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#999", fontSize: 14 }}>
            No messages yet. Say hello to the receptionist.
          </p>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "80%",
                padding: "8px 12px",
                borderRadius: 12,
                whiteSpace: "pre-wrap",
                background: m.isError
                  ? "#fdecea"
                  : isUser
                    ? "#2563eb"
                    : "#e5e7eb",
                color: m.isError ? "#b71c1c" : isUser ? "#fff" : "#111",
              }}
            >
              {m.content}
            </div>
          );
        })}
        {busy && (
          <div style={{ alignSelf: "flex-start", color: "#999", fontSize: 14 }}>
            …thinking
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={busy}
          placeholder="Type a message and press Enter…"
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
        <button onClick={() => void send()} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>

      {/* Captured lead */}
      {lead && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 14, margin: "0 0 4px" }}>Captured lead</h2>
          <pre
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 12,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(lead, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
