# Capa de imagem, labels acima do título (Conteúdos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cards do Trello com imagem de capa mostram essa imagem no card do board e no pop-up de detalhe; labels aparecem acima do título (não abaixo); tudo sem chamada nova de API pra listar o board (só a imagem em si é buscada sob demanda, via proxy autenticado).

**Architecture:** `fetchClientBoard` (já busca todos os anexos numa chamada só) passa a resolver a URL do maior preview não-escalado do anexo de capa, quando existe. O navegador do cliente não consegue baixar essa URL diretamente (o Trello exige um header `Authorization: OAuth` que só o nosso servidor tem) — uma rota de proxy nova busca a imagem com esse header e devolve os bytes. `clientId`/`accessKey` passam a descer por toda a árvore de componentes (`ContentPageClient` → `ContentBoard` → `ContentCard`/`ContentCardModal`) pra montar a URL do proxy.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- Sem chamada nova à API do Trello pra listar o board — a URL da capa já vem de dados já buscados por `fetchClientBoard` (mesma chamada `attachments=true` de hoje, só adicionando `idAttachmentCover` aos campos pedidos).
- A rota de proxy só aceita URLs que comecem com `https://trello.com/1/cards/` — qualquer outra URL é rejeitada com 400 (evita virar um proxy aberto).
- A rota de proxy usa o mesmo padrão de auth das rotas irmãs (`verifyClientToken`, 401 se inválido).
- Imagem que falha ao carregar (removida, expirada, erro de proxy) esconde a capa silenciosamente — sem mensagem de erro visível, mesma filosofia já usada pra data/responsável vazios.
- Pop-up de detalhe: capa em banner no topo, título e botão de fechar (X) abaixo dela — sem sobrepor o X na imagem.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: Camada de dados — `coverImageUrl` + rota de proxy

**Files:**
- Modify: `src/lib/trello.ts` (arquivo inteiro será substituído)
- Create: `src/app/api/content/[client]/cover-proxy/route.ts`

**Interfaces:**
- Produces: `ContentCard.coverImageUrl: string | null` (novo campo no tipo já existente, consumido por `ContentCard.tsx`/`ContentCardModal.tsx` na Task 2). Rota `GET /api/content/[client]/cover-proxy?key=<token>&url=<preview URL do Trello, URL-encoded>` — devolve os bytes da imagem com `Content-Type` original em caso de sucesso, 401 (token inválido), 400 (URL fora do domínio permitido) ou 404 (falha ao buscar no Trello).

- [ ] **Step 1: Reescrever `src/lib/trello.ts`**

```ts
// src/lib/trello.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a API Key/Token).
const TRELLO_API = "https://api.trello.com/1";

export function hasTrelloCredentials(): boolean {
  return Boolean(process.env.TRELLO_API_KEY) && Boolean(process.env.TRELLO_TOKEN);
}

async function trelloGet(path: string, params: Record<string, string>) {
  const url = new URL(`${TRELLO_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", process.env.TRELLO_API_KEY!);
  url.searchParams.set("token", process.env.TRELLO_TOKEN!);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json === "string" ? json : JSON.stringify(json));
  return json;
}

export type ContentLabel = { name: string; color: string };

export type ContentCard = {
  id: string;
  name: string;
  description: string;
  labels: ContentLabel[];
  dueDate: number | null;
  assignees: string[];
  attachments: { name: string; url: string }[];
  coverImageUrl: string | null;
};

export type ContentList = {
  id: string;
  name: string;
  cards: ContentCard[];
};

type RawTrelloList = { id: string; name: string; pos: number };
type RawTrelloLabel = { name: string; color: string | null };
type RawTrelloPreview = { url: string; width: number; height: number; scaled: boolean };
type RawTrelloAttachment = { id: string; name: string; url: string; fileName?: string; previews: RawTrelloPreview[] };
type RawTrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  idMembers: string[];
  idAttachmentCover: string | null;
  labels: RawTrelloLabel[];
  attachments: RawTrelloAttachment[];
  pos: number;
};
type RawTrelloMember = { id: string; fullName: string };

// ponytail: paleta de cores nomeadas do Trello (estável há anos, não muda por board) — a API
// devolve o nome da cor ("purple", "green"...), não um hex, então convertemos aqui pro pill
// renderizar com a cor certa. "black" e ausência de cor caem no mesmo cinza neutro.
const TRELLO_LABEL_COLORS: Record<string, string> = {
  green: "#61bd4f",
  yellow: "#f2d600",
  orange: "#ff9f1a",
  red: "#eb5a46",
  purple: "#c377e0",
  blue: "#0079bf",
  sky: "#00c2e0",
  lime: "#51e898",
  pink: "#ff78cb",
  black: "#4d4d4d",
};

function trelloColorToHex(color: string | null): string {
  if (!color) return "#8590a2";
  return TRELLO_LABEL_COLORS[color] ?? "#8590a2";
}

// ponytail: capa é a maior preview não-escalada do anexo marcado como idAttachmentCover — se
// não houver nenhuma não-escalada, cai pra maior escalada. Sem capa configurada ou anexo/preview
// ausente (removido depois de virar capa) -> null, o card volta pro layout sem capa.
function pickCoverImageUrl(card: RawTrelloCard): string | null {
  if (!card.idAttachmentCover) return null;
  const attachment = card.attachments.find((a) => a.id === card.idAttachmentCover);
  if (!attachment || attachment.previews.length === 0) return null;

  const nonScaled = attachment.previews.filter((p) => !p.scaled);
  const pool = nonScaled.length > 0 ? nonScaled : attachment.previews;
  return [...pool].sort((a, b) => b.width - a.width)[0].url;
}

// ponytail: busca ao vivo, sem cache — 3 chamadas em paralelo (lists, cards, members), sem loop
// por card. "attachments=true" é obrigatório pra API devolver os anexos (testado ao vivo).
export async function fetchClientBoard(boardId: string): Promise<ContentList[]> {
  const [rawLists, rawCards, rawMembers]: [RawTrelloList[], RawTrelloCard[], RawTrelloMember[]] = await Promise.all([
    trelloGet(`boards/${boardId}/lists`, { fields: "name,pos" }),
    trelloGet(`boards/${boardId}/cards`, {
      fields: "name,desc,due,idList,idMembers,labels,pos,idAttachmentCover",
      attachments: "true",
    }),
    trelloGet(`boards/${boardId}/members`, { fields: "fullName" }),
  ]);

  const memberNames = new Map(rawMembers.map((m) => [m.id, m.fullName]));

  const cardsByList = new Map<string, ContentCard[]>();
  for (const c of [...rawCards].sort((a, b) => a.pos - b.pos)) {
    const card: ContentCard = {
      id: c.id,
      name: c.name,
      description: c.desc,
      labels: c.labels.map((l) => ({ name: l.name || "Sem nome", color: trelloColorToHex(l.color) })),
      dueDate: c.due ? new Date(c.due).getTime() : null,
      assignees: c.idMembers.map((id) => memberNames.get(id) ?? "Desconhecido"),
      attachments: c.attachments.map((a) => ({ name: a.name || a.fileName || a.url, url: a.url })),
      coverImageUrl: pickCoverImageUrl(c),
    };
    const existing = cardsByList.get(c.idList) ?? [];
    existing.push(card);
    cardsByList.set(c.idList, existing);
  }

  return [...rawLists]
    .sort((a, b) => a.pos - b.pos)
    .map((l) => ({ id: l.id, name: l.name, cards: cardsByList.get(l.id) ?? [] }));
}
```

- [ ] **Step 2: Criar a rota de proxy**

```ts
// src/app/api/content/[client]/cover-proxy/route.ts
import { NextRequest } from "next/server";
import { verifyClientToken } from "@/lib/access";

const TRELLO_ATTACHMENT_URL_PREFIX = "https://trello.com/1/cards/";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  const url = request.nextUrl.searchParams.get("url");

  if (!(await verifyClientToken(clientId, key))) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!url || !url.startsWith(TRELLO_ATTACHMENT_URL_PREFIX)) {
    return new Response("invalid url", { status: 400 });
  }

  if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
    // ponytail: distinto de "not found" só nos logs — pro navegador ambos viram a capa
    // desaparecendo silenciosamente (onError do <img>), mesma filosofia da rota /api/content.
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (cover-proxy)");
    return new Response("not found", { status: 404 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${process.env.TRELLO_API_KEY}", oauth_token="${process.env.TRELLO_TOKEN}"`,
      },
      cache: "no-store",
    });
    if (!res.ok || !res.body) {
      return new Response("not found", { status: 404 });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error(`[content] falha ao buscar capa via proxy pra ${clientId}:`, err);
    return new Response("not found", { status: 404 });
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Testar a rota de proxy ao vivo**

Iniciar o dev server (`npm run dev`) e, com o server rodando, buscar a URL real de uma capa via curl direto na API do Trello (substitua pelas credenciais de `.env.local`):

```bash
source .env.local
curl -s "https://api.trello.com/1/boards/6a45322767a3396275720779/cards?fields=name,idAttachmentCover&attachments=true&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}" \
  | python3 -c "
import json,sys
cards = json.load(sys.stdin)
c = next(c for c in cards if c['idAttachmentCover'])
att = next(a for a in c['attachments'] if a['id'] == c['idAttachmentCover'])
preview = sorted([p for p in att['previews'] if not p['scaled']] or att['previews'], key=lambda p: -p['width'])[0]
print(preview['url'])
"
```

Copiar a URL impressa e testar o proxy local:

```bash
curl -s -o /tmp/cover-test.webp -w "%{http_code}\n" \
  "http://localhost:3000/api/content/debora/cover-proxy?key=e5bff4d1825a067cfab62539526e9a3c&url=<URL_COPIADA_URL_ENCODED>"
```

Expected: `200`, e `/tmp/cover-test.webp` é um arquivo de imagem válido (`file /tmp/cover-test.webp` mostra `Web/P image`). Testar também com uma URL fora de `https://trello.com/1/cards/` (ex: `url=https://example.com`) — espera `400`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trello.ts src/app/api/content/\[client\]/cover-proxy/route.ts
git commit -m "Adiciona coverImageUrl (capa de card) + rota de proxy autenticado pro Trello"
```

---

### Task 2: Componentes — capa, reordenação de labels, plumbing de `clientId`/`accessKey`

**Files:**
- Modify: `src/components/ContentPageClient.tsx`
- Modify: `src/components/ContentBoard.tsx`
- Modify: `src/components/ContentCard.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/ContentCardModal.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: `ContentCard.coverImageUrl: string | null` e rota `/api/content/[client]/cover-proxy` (Task 1).
- Produces: `ContentCard({ card, clientId, accessKey, onClick })` e `ContentCardModal({ card, clientId, accessKey, onClose })` — mudança de assinatura em relação à versão atual (que só recebiam `card`/`onClick`/`onClose`). `ContentBoard({ lists, clientId, accessKey })` — mudança de assinatura em relação à versão atual (só recebia `lists`).

- [ ] **Step 1: `ContentPageClient.tsx` — passar `clientId`/`accessKey` pro `ContentBoard`**

Trocar a linha:

```tsx
{!error && lists && <ContentBoard lists={lists} />}
```

por:

```tsx
{!error && lists && <ContentBoard lists={lists} clientId={clientId} accessKey={accessKey} />}
```

(`clientId` e `accessKey` já existem no escopo do componente — são os parâmetros da própria função `ContentPageClient`.)

- [ ] **Step 2: Reescrever `ContentBoard.tsx`**

```tsx
// src/components/ContentBoard.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData, ContentList } from "@/lib/trello";
import { ContentCard } from "./ContentCard";
import { ContentCardModal } from "./ContentCardModal";

export function ContentBoard({
  lists,
  clientId,
  accessKey,
}: {
  lists: ContentList[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  if (lists.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma lista encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
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
                <ContentCard
                  key={card.id}
                  card={card}
                  clientId={clientId}
                  accessKey={accessKey}
                  onClick={() => setSelectedCard(card)}
                />
              ))
            )}
          </div>
        </div>
      ))}
      {selectedCard && (
        <ContentCardModal
          card={selectedCard}
          clientId={clientId}
          accessKey={accessKey}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Reescrever `ContentCard.tsx`**

```tsx
// src/components/ContentCard.tsx
"use client";

import { useState } from "react";
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

export function ContentCard({
  card,
  clientId,
  accessKey,
  onClick,
}: {
  card: ContentCardData;
  clientId: string;
  accessKey: string;
  onClick: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const hasMeta = card.dueDate !== null || card.assignees.length > 0 || card.attachments.length > 0;
  const showCover = card.coverImageUrl !== null && !coverFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-[var(--radius-card)] bg-card text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-card/80"
    >
      {showCover && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado, não é asset local
        <img
          src={`/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(card.coverImageUrl!)}`}
          alt=""
          className="h-24 w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      )}
      <div className="p-2.5">
        {card.labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
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
        <p className="text-sm font-medium text-card-foreground">{card.name}</p>
        {card.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.description}</p>}
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
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Reescrever `ContentCardModal.tsx`**

```tsx
// src/components/ContentCardModal.tsx
"use client";

import { useEffect, useState } from "react";
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

export function ContentCardModal({
  card,
  clientId,
  accessKey,
  onClose,
}: {
  card: ContentCard;
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = card.coverImageUrl !== null && !coverFailed;

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
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        {showCover && (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado, não é asset local
          <img
            src={`/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(card.coverImageUrl!)}`}
            alt=""
            className="h-40 w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        )}

        <div className="p-6">
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
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build limpo, `/[client]/conteudos` e `/api/content/[client]/cover-proxy` continuam/aparecem na lista de rotas.

- [ ] **Step 7: Checagem visual no Browser pane**

Abrir três boards e comparar:

- `/debora/conteudos?key=e5bff4d1825a067cfab62539526e9a3c` (1 card com capa, coluna "Semana 2") — confirmar que o card mostra a imagem no topo, labels acima do título, e que abrir o pop-up desse card mostra o banner no topo com título+X abaixo dele.
- `/tiago/conteudos?key=b9d179192160c98b579807d25f8a956e` (5 cards com capa) — confirmar múltiplos cards com capa na mesma coluna/board, sem quebrar o layout.
- `/bela/conteudos?key=f3b6464db28cd708fe5e11a315435323` (nenhum card com capa) — confirmar que nada mudou visualmente pra esse board (nenhum espaço vazio reservado onde não há capa) e que labels continuam aparecendo acima do título mesmo sem capa.

Em cada board: checar `read_console_messages` sem erros (nem 401/400/404 inesperados na aba de rede pra `cover-proxy` — só card com capa real deve chamar a rota).

- [ ] **Step 8: Commit**

```bash
git add src/components/ContentPageClient.tsx src/components/ContentBoard.tsx src/components/ContentCard.tsx src/components/ContentCardModal.tsx
git commit -m "Capa de imagem no card/pop-up + labels acima do título (Conteúdos)"
```
