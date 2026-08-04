"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chatMessages";

type UiMessage = { role: "user" | "assistant"; content: string };

export function BoosterAiPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/booster-ai/${clientId}/messages?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { messages: ChatMessage[] };
      })
      .then((data) => {
        if (data.messages.length === 0) {
          setMessages([
            {
              role: "assistant",
              content:
                "Oi! Sou o Booster AI. Posso te ajudar com suas métricas, conteúdos, tasks e atas — pergunta o que quiser sobre a sua conta.",
            },
          ]);
        } else {
          setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
        }
      })
      .catch(() => setLoadError(true));
  }, [clientId, accessKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/booster-ai/${clientId}/chat?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.status === 429) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "Limite diário de mensagens atingido, volta amanhã." };
          return next;
        });
        return;
      }
      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: snapshot };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Não foi possível responder agora, tenta de novo." };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function sendMessage() {
    const text = input.trim();
    setInput("");
    send(text);
  }

  function retry(userText: string) {
    setMessages((prev) => prev.slice(0, -2));
    send(userText);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Booster AI</h1>
      {loadError && (
        <p className="mb-4 rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar o histórico agora.
        </p>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[10px] font-semibold text-white">
                AI
              </span>
            )}
            <div className="flex max-w-[80%] flex-col gap-1.5">
              <div
                className={`rounded-[var(--radius-card)] p-3 text-sm shadow-[var(--shadow-soft)] ${
                  m.role === "user" ? "bg-brand-primary text-white" : "bg-card text-card-foreground"
                }`}
              >
                {m.content || (m.role === "assistant" && sending ? "..." : "")}
              </div>
              {m.role === "assistant" && m.content && !sending && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => copy(m.content)}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-card-foreground"
                  >
                    Copiar
                  </button>
                  {messages[i - 1]?.role === "user" && (
                    <button
                      type="button"
                      onClick={() => retry(messages[i - 1].content)}
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-card-foreground"
                    >
                      Reenviar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Pergunte sobre seus números, conteúdos, tasks ou atas..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
