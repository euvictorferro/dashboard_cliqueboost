"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/lib/chatMessages";
import { CLIENTS } from "@/lib/clients";
import { getInitials, colorFromName } from "@/lib/avatar";

function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  // ponytail: sunburst estilizado (sem hotlink de logo externo), representa a marca do modelo
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const x1 = 12 + Math.cos(angle) * 3.2;
        const y1 = 12 + Math.sin(angle) * 3.2;
        const x2 = 12 + Math.cos(angle) * 10;
        const y2 = 12 + Math.sin(angle) * 10;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 9.5V2.5A1 1 0 0 1 3.5 1.5H9.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M12 7A5 5 0 1 1 10.6 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 2.5V5.5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type UiMessage = { role: "user" | "assistant"; content: string };

export function BoosterAiPageClient({ clientId }: { clientId: string;  }) {
  const client = CLIENTS.find((c) => c.id === clientId);
  const userInitials = getInitials(client?.name ?? clientId);
  const userColor = colorFromName(client?.name ?? clientId);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expanded = focused || input.trim() !== "";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input, expanded]);

  useEffect(() => {
    fetch(`/api/booster-ai/${clientId}/messages`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { messages: ChatMessage[] };
      })
      .then((data) => {
        setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => setLoadError(true));
  }, [clientId]);

  async function send(text: string) {
    if (!text || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/booster-ai/${clientId}/chat`, {
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
    if (!text) return;
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

  const reversedMessages = [...messages].reverse();
  const hasStarted = messages.length > 0;

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const composerFields = (
    <>
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
        disabled={sending}
        placeholder="Pergunte sobre seus números, conteúdos, tasks ou atas..."
        className="max-h-40 min-h-6 w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          <ClaudeIcon className="h-2.5 w-2.5" />
          Claude Haiku
        </span>
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Enviar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <ArrowUpIcon />
        </button>
      </div>
    </>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-52px)] w-full max-w-[1600px] flex-col px-6 pt-6 pb-6 sm:px-10">
      {loadError && (
        <p className="mb-4 rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar o histórico agora.
        </p>
      )}

      {!hasStarted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-white">
            <ClaudeIcon className="h-7 w-7" />
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Booster pronto para te ajudar</h1>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Pergunte sobre sua conta, conteúdos, métricas, tasks ou atas — sei de tudo sobre nossa parceria.
            </p>
          </div>
          <form onSubmit={submitForm} className="w-full max-w-xl rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            {composerFields}
          </form>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col-reverse gap-5 overflow-y-auto">
            {reversedMessages.map((m, ri) => {
              const i = messages.length - 1 - ri;
              return (
                <div key={i} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  {m.role === "assistant" ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                      <ClaudeIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: userColor }}
                    >
                      {userInitials}
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
                          aria-label="Copiar"
                          title="Copiar"
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
                        >
                          <CopyIcon />
                        </button>
                        {messages[i - 1]?.role === "user" && (
                          <button
                            type="button"
                            onClick={() => retry(messages[i - 1].content)}
                            aria-label="Reenviar"
                            title="Reenviar"
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
                          >
                            <RetryIcon />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={submitForm}
            onClick={() => textareaRef.current?.focus()}
            className={`mt-4 w-full border border-border bg-card shadow-[var(--shadow-soft)] transition-[border-radius] focus-within:border-brand-primary/40 ${
              expanded ? "cursor-text rounded-3xl px-4 pb-2.5 pt-3" : "cursor-text rounded-full px-4 py-2.5"
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={sending}
              placeholder="Pergunte sobre seus números, conteúdos, tasks ou atas..."
              className="max-h-40 min-h-6 w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <div className={`flex items-center justify-between overflow-hidden transition-[height,opacity] ${expanded ? "mt-1.5 h-7 opacity-100" : "h-0 opacity-0"}`}>
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                <ClaudeIcon className="h-2.5 w-2.5" />
                Claude Haiku
              </span>
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Enviar"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <ArrowUpIcon />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
