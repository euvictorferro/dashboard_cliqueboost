// src/components/ContentBoard.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData, ContentList } from "@/lib/trello";
import { ContentCard } from "@/components/conteudos/ContentCard";
import { ContentCardModal } from "@/components/conteudos/ContentCardModal";

function AddCardForm({ listId, onAdd }: { listId: string; onAdd: (listId: string, name: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd(listId, name.trim());
      setName("");
      setAdding(false);
    } catch (err) {
      console.error("falha ao criar card", err);
    } finally {
      setSaving(false);
    }
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex w-full items-center gap-1.5 rounded-[var(--radius-card)] px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        + Adicionar card
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setAdding(false);
        }}
        placeholder="Nome do card..."
        rows={2}
        autoFocus
        className="w-full resize-none rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-brand-accent"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !name.trim()}
          className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Adicionar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setName("");
          }}
          className="text-xs font-medium text-muted-foreground hover:text-card-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function ContentBoard({
  lists: initialLists,
  clientId,
}: {
  lists: ContentList[];
  clientId: string;
}) {
  const [lists, setLists] = useState(initialLists);
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  async function addCard(listId: string, name: string) {
    const listName = lists.find((l) => l.id === listId)?.name ?? "";
    const res = await fetch(`/api/content/${clientId}/list/${listId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, listName }),
    });
    if (!res.ok) throw new Error();
    const data: { card: ContentCardData } = await res.json();
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, data.card] } : l)));
  }

  if (lists.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma lista encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 overflow-x-auto px-6 pb-4 sm:px-10">
      {lists.map((list) => (
        <div
          key={list.id}
          className="flex max-h-[calc(100vh-110px)] w-72 shrink-0 flex-col rounded-[var(--radius-card)] bg-muted/60 pb-3"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 rounded-t-[var(--radius-card)] bg-muted px-3 py-2.5">
            <p className="text-sm font-bold text-card-foreground">{list.name}</p>
            <span className="text-xs font-medium text-muted-foreground">{list.cards.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pt-3">
            {list.cards.map((card) => (
              <ContentCard
                key={card.id}
                card={card}
                clientId={clientId}
                onClick={() => setSelectedCard(card)}
              />
            ))}
          </div>
          <div className="shrink-0 px-3 pt-2">
            <AddCardForm listId={list.id} onAdd={addCard} />
          </div>
        </div>
      ))}
      {selectedCard && (
        <ContentCardModal
          card={selectedCard}
          clientId={clientId}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
