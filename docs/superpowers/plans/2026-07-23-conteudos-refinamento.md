# Refinamento Conteúdos (pop-up de card + visual estilo Trello) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicar num card da página Conteúdos abre um pop-up com os detalhes completos (nome, labels, descrição, data, responsável, anexos), e o board fica visualmente mais próximo de um board real do Trello (cabeçalho de coluna mais definido, cards compactos, metadados vazios escondidos).

**Architecture:** Um novo componente `ContentCardModal.tsx` (mesmo padrão de `TaskDetailModal.tsx` já existente — sem chamada de API nova, renderiza os campos do `ContentCard` já carregado). `ContentBoard.tsx` vira o dono do estado `selectedCard` (mesmo padrão de `selectedTask` em `TasksTable.tsx`) e passa um `onClick` pra cada `ContentCard`, que vira um `<button>` clicável.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- Sem chamada nova à API do Trello — todos os campos do pop-up já existem em `ContentCard`/`ContentList` (`src/lib/trello.ts`).
- Sem botões de edição (Add/Dates/Checklist/Members/Attachment) e sem painel de comentários/atividade no pop-up — a página é só-leitura.
- Card do board esconde a linha de data/responsável/anexos quando vazia; o pop-up sempre mostra "Sem prazo"/"Sem descrição"/"Sem responsável"/"Sem anexos" explicitamente quando vazio.
- Cabeçalho de coluna não vira pill colorido — listas do Trello não têm cor própria (diferente dos status do ClickUp usados em Tasks).
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: `ContentCardModal.tsx`

**Files:**
- Create: `src/components/ContentCardModal.tsx`

**Interfaces:**
- Consumes: `ContentCard` type de `src/lib/trello.ts` — `{ id: string; name: string; description: string; labels: { name: string; color: string }[]; dueDate: number | null; assignees: string[]; attachments: { name: string; url: string }[] }`.
- Produces: `ContentCardModal({ card, onClose }: { card: ContentCard; onClose: () => void })` — usado por `ContentBoard.tsx` na Task 2.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContentCardModal.tsx
import { useEffect } from "react";
import type { ContentCard } from "@/lib/trello";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}

export function ContentCardModal({ card, onClose }: { card: ContentCard; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-card-foreground">{card.name}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Labels">
            {card.labels.length === 0 ? (
              <span className="text-muted-foreground">Sem labels</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {card.labels.map((label, i) => (
                  <span
                    key={`${label.name}-${i}`}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Descrição">
            {card.description ? (
              <p className="whitespace-pre-wrap">{card.description}</p>
            ) : (
              <span className="text-muted-foreground">Sem descrição</span>
            )}
          </Field>

          <Field label="Data prevista">{formatDueDate(card.dueDate)}</Field>

          <Field label="Responsável">
            {card.assignees.length === 0 ? (
              <span className="text-muted-foreground">Sem responsável</span>
            ) : (
              card.assignees.join(", ")
            )}
          </Field>

          <Field label="Anexos">
            {card.attachments.length === 0 ? (
              <span className="text-muted-foreground">Sem anexos</span>
            ) : (
              <ul className="space-y-1">
                {card.attachments.map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-accent hover:underline"
                    >
                      🔗 {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}
```

Nenhum "use client" próprio — segue o mesmo padrão de `TaskDetailModal.tsx`, que também não tem a diretiva porque só é importado dentro de árvores já marcadas `"use client"` (aqui será `ContentBoard.tsx`, na Task 2).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros. `ContentCardModal` ainda não é importado por ninguém nesta task — o `tsc` só confirma que o arquivo em si compila (tipos batem com `ContentCard` de `src/lib/trello.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/components/ContentCardModal.tsx
git commit -m "Adiciona ContentCardModal (pop-up de detalhe do card, sem chamada nova)"
```

---

### Task 2: Card clicável + board estilo Trello

**Files:**
- Modify: `src/components/ContentCard.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/ContentBoard.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: `ContentCardModal` de `src/components/ContentCardModal.tsx` (Task 1) — `{ card: ContentCard; onClose: () => void }`. `ContentCard`/`ContentList` types de `src/lib/trello.ts` (sem mudança).
- Produces: `ContentCard({ card, onClick }: { card: ContentCard; onClick: () => void })` — mudança de assinatura em relação à versão atual (que só recebia `{ card }`). `ContentBoard({ lists }: { lists: ContentList[] })` mantém a mesma assinatura pública (consumida por `ContentPageClient.tsx`, que não muda).

- [ ] **Step 1: Reescrever `ContentCard.tsx`**

```tsx
// src/components/ContentCard.tsx
import type { ContentCard as ContentCardData } from "@/lib/trello";

function formatDueDate(dueDate: number): string {
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function AttachmentIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path
        d="M8.3 3.3L4.6 7a1.5 1.5 0 1 1-2.1-2.1l3.7-3.7a1 1 0 1 1 1.4 1.4L4.2 6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ContentCard({ card, onClick }: { card: ContentCardData; onClick: () => void }) {
  const hasMeta = card.dueDate !== null || card.assignees.length > 0 || card.attachments.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-[var(--radius-card)] bg-card p-2.5 text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-card/80"
    >
      <p className="text-sm font-medium text-card-foreground">{card.name}</p>
      {card.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.description}</p>}
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((label, i) => (
            <span
              key={`${label.name}-${i}`}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      {hasMeta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {card.dueDate !== null && <span>{formatDueDate(card.dueDate)}</span>}
          {card.assignees.length > 0 && <span>{card.assignees.join(", ")}</span>}
          {card.attachments.length > 0 && (
            <span className="flex items-center gap-1">
              <AttachmentIcon />
              {card.attachments.length}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
```

Nota: os links de anexo saem do card do board (viravam `<a>` dentro do `<button>` agora clicável, o que é HTML inválido e quebraria o clique) — o card do board passa a mostrar só um contador com ícone de clipe, e a lista completa de links continua disponível no pop-up (`ContentCardModal`, Task 1).

- [ ] **Step 2: Reescrever `ContentBoard.tsx`**

```tsx
// src/components/ContentBoard.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData, ContentList } from "@/lib/trello";
import { ContentCard } from "./ContentCard";
import { ContentCardModal } from "./ContentCardModal";

export function ContentBoard({ lists }: { lists: ContentList[] }) {
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  if (lists.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma lista encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {lists.map((list) => (
        <div key={list.id} className="w-72 shrink-0 rounded-[var(--radius-card)] bg-muted/60 pb-3">
          <div className="flex items-center gap-2 rounded-t-[var(--radius-card)] bg-muted px-3 py-2.5">
            <p className="text-sm font-bold text-card-foreground">{list.name}</p>
            <span className="text-xs font-medium text-muted-foreground">{list.cards.length}</span>
          </div>
          <div className="space-y-2 px-3 pt-3">
            {list.cards.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Sem cards</p>
            ) : (
              list.cards.map((card) => (
                <ContentCard key={card.id} card={card} onClick={() => setSelectedCard(card)} />
              ))
            )}
          </div>
        </div>
      ))}
      {selectedCard && <ContentCardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build limpo, `/[client]/conteudos` continua na lista de rotas.

- [ ] **Step 5: Checagem visual no Browser pane**

Abrir `/debora/conteudos?key=e5bff4d1825a067cfab62539526e9a3c` (board sem data/responsável — confirma que a linha some do card) e `/bela/conteudos?key=f3b6464db28cd708fe5e11a315435323` ou `/tiago/conteudos?key=b9d179192160c98b579807d25f8a956e` (boards com `due` real — confirma que a data aparece no card). Em cada um: confirmar que o cabeçalho de coluna está com fundo mais sólido e cantos arredondados só no topo; clicar num card e confirmar que o pop-up abre com todos os campos (Labels/Descrição/Data prevista/Responsável/Anexos), incluindo "Sem prazo"/"Sem descrição"/"Sem responsável"/"Sem anexos" quando vazio; fechar com X, com Esc e clicando fora — todos devem fechar; conferir que um card com anexo mostra o contador com ícone no board e a lista completa de links no pop-up, cada um abrindo em nova aba; checar `read_console_messages` sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/ContentCard.tsx src/components/ContentBoard.tsx
git commit -m "ContentCard clicável + ContentBoard estilo Trello (pop-up de detalhe, metadados condicionais)"
```
