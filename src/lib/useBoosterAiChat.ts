"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/chatMessages";

export type UiMessage = { role: "user" | "assistant"; content: string };

// Lógica de mensagens do Booster AI compartilhada entre a página cheia (BoosterAiPageClient)
// e o widget flutuante (BoosterAiWidget) — os dois leem/escrevem o mesmo histórico no backend,
// então abrir o chat em qualquer um dos dois lugares mostra a mesma conversa.
export function useBoosterAiChat(clientId: string) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/booster-ai/${clientId}/messages`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { messages: ChatMessage[] };
      })
      .then((data) => {
        setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true));
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

  function retry(userText: string) {
    setMessages((prev) => prev.slice(0, -2));
    send(userText);
  }

  return { messages, sending, loadError, loaded, send, retry };
}
