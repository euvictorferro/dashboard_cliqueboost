"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBoosterAiChat } from "@/lib/useBoosterAiChat";
import { renderMarkdown } from "@/components/ui/markdown";

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.2-3.6A7.96 7.96 0 0 1 4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Botão flutuante disponível em qualquer página do cliente — abre a mesma conversa (e
// histórico) da página Booster AI, num painel compacto. Some na própria página Booster AI
// (o chat em tela cheia já está ali).
export function BoosterAiWidget({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const { messages, sending, send } = useBoosterAiChat(clientId);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    send(text);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-card-foreground">Booster AI</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-card-foreground"
            >
              <CloseIcon />
            </button>
          </div>

          <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="m-auto max-w-[85%] text-center text-sm text-muted-foreground">
                Pergunte sobre seus números, conteúdos, tasks ou atas.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-[var(--radius-card)] p-2.5 text-sm shadow-[var(--shadow-soft)] ${
                    m.role === "user" ? "self-end bg-brand-primary text-white" : "self-start bg-muted text-card-foreground"
                  }`}
                >
                  {m.content ? (m.role === "assistant" ? renderMarkdown(m.content) : m.content) : m.role === "assistant" && sending ? "..." : ""}
                </div>
              ))
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              placeholder="Escreva sua pergunta..."
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Enviar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <ArrowUpIcon />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar chat" : "Abrir chat com o Booster AI"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  );
}
