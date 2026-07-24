# Página Conteúdos (Kanban do Trello) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova página "Conteúdos" que espelha (só leitura) o board real do Trello de cada cliente, em Kanban de verdade (colunas lado a lado), acessível pela Sidebar.

**Architecture:** Mesmo padrão já estabelecido pela página Tasks (ClickUp): uma lib server-only (`src/lib/trello.ts`) busca e mapeia o board real, uma rota (`/api/content/[client]`) expõe isso com o mesmo padrão de auth das rotas irmãs, e uma página client-side busca e renderiza. Diferença estrutural: Tasks agrupa por status (campo simples); Conteúdos agrupa por lista do Trello — mais parecido com um Kanban de colunas de verdade, então o componente de layout é novo (`ContentBoard`), não reaproveita `TasksTable`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind. Sem framework de testes no projeto — verificação por `npx tsc --noEmit`, `npm run build`, e checagem visual via Browser pane.

## Global Constraints

- Branch: `feature-conteudos-trello`. Não mesclar em `main`/`staging` sem aprovação explícita do Victor.
- Somente leitura — nenhuma escrita no Trello (nem criar card, nem mover, nem editar).
- Colunas seguem exatamente os nomes/ordem reais de cada board — nunca hardcoded.
- Campos do card: nome, descrição, labels, data prevista, responsável, anexos. Data prevista e responsável aparecem mesmo vazios ("Sem prazo"/"Sem responsável") — decisão explícita do Victor, mesmo a maioria dos cards reais não usar esses campos hoje.
- Board IDs confirmados: debora=`6a45322767a3396275720779`, lais=`6a1d9bfebe2405767f61e0d6`, sam=`68dacb7ba8957ca2511e9071`, nelson=`6a62cc0c3349ba1222b431e0`, tiago=`6a15e2cce98811c102520e22`, bela=`68f4f4c34ad83399f540858a`.
- Credenciais já em `.env.local`: `TRELLO_API_KEY`, `TRELLO_TOKEN` (testadas ao vivo nesta sessão).
- Sem cache — busca ao vivo a cada carregamento da página (mesma política das demais rotas).

---

### Task 1: Camada de dados do Trello

**Files:**
- Modify: `src/lib/clients.ts`
- Create: `src/lib/trello.ts`
- Create: `src/app/api/content/[client]/route.ts`

**Interfaces:**
- Consumes: nada de outras tasks (task base).
- Produces: `Client.trelloBoardId`, `export type ContentLabel = { name: string; color: string }`, `export type ContentCard = { id: string; name: string; description: string; labels: ContentLabel[]; dueDate: number | null; assignees: string[]; attachments: { name: string; url: string }[] }`, `export type ContentList = { id: string; name: string; cards: ContentCard[] }`, `export function hasTrelloCredentials(): boolean`, `export async function fetchClientBoard(boardId: string): Promise<ContentList[]>`. Rota `GET /api/content/[client]` devolve `{ lists: ContentList[] }` ou `{ error: "no_board_configured" | "fetch_failed" | "unknown client" | "unauthorized" }`. Consumido pelas Tasks 2 e 3.

- [ ] **Step 1: Adicionar `trelloBoardId` aos 6 clientes**

Em `src/lib/clients.ts`, troque:

```ts
export type Client = {
  id: string;
  name: string;
  /** Fica true quando o cliente tiver conta de Ads conectada e rodando de fato. */
  adsActive: boolean;
  /** Instagram Business Account ID (Meta Business Suite → Configurações → Contas → Instagram). */
  instagramBusinessId?: string;
  /** Ad Account ID do Meta Ads — só existe pra quem roda tráfego pago. */
  adAccountId?: string;
  /** ID da Lista do ClickUp (Booster Space > Clientes > <nome>) — usada pela página Tasks. */
  clickupListId?: string;
};

// ponytail: lista hardcoded, como TEAM_MEMBERS no CRM. Migrar pra Supabase quando o projeto novo existir.
export const CLIENTS: Client[] = [
  { id: "debora", name: "Débora Segnini", adsActive: false, instagramBusinessId: "17841460379583584", adAccountId: "2747334925666942", clickupListId: "901714744652" },
  { id: "lais", name: "Laís Daltrozo", adsActive: false, instagramBusinessId: "17841401799523851", adAccountId: "2095558858011678", clickupListId: "901714211778" },
  { id: "sam", name: "Sam", adsActive: false, instagramBusinessId: "17841403158327784", clickupListId: "901711532887" },
  { id: "nelson", name: "Nelson", adsActive: false, instagramBusinessId: "17841433504082304", adAccountId: "959090240381783", clickupListId: "901711532905" },
  { id: "tiago", name: "Tiago Zamboni", adsActive: false, instagramBusinessId: "17841401844913174", clickupListId: "901713981087" },
  { id: "bela", name: "Bela Castro", adsActive: false, instagramBusinessId: "17841445125553950", clickupListId: "901711532881" },
];
```

por:

```ts
export type Client = {
  id: string;
  name: string;
  /** Fica true quando o cliente tiver conta de Ads conectada e rodando de fato. */
  adsActive: boolean;
  /** Instagram Business Account ID (Meta Business Suite → Configurações → Contas → Instagram). */
  instagramBusinessId?: string;
  /** Ad Account ID do Meta Ads — só existe pra quem roda tráfego pago. */
  adAccountId?: string;
  /** ID da Lista do ClickUp (Booster Space > Clientes > <nome>) — usada pela página Tasks. */
  clickupListId?: string;
  /** ID do board do Trello do cliente — usado pela página Conteúdos. */
  trelloBoardId?: string;
};

// ponytail: lista hardcoded, como TEAM_MEMBERS no CRM. Migrar pra Supabase quando o projeto novo existir.
export const CLIENTS: Client[] = [
  { id: "debora", name: "Débora Segnini", adsActive: false, instagramBusinessId: "17841460379583584", adAccountId: "2747334925666942", clickupListId: "901714744652", trelloBoardId: "6a45322767a3396275720779" },
  { id: "lais", name: "Laís Daltrozo", adsActive: false, instagramBusinessId: "17841401799523851", adAccountId: "2095558858011678", clickupListId: "901714211778", trelloBoardId: "6a1d9bfebe2405767f61e0d6" },
  { id: "sam", name: "Sam", adsActive: false, instagramBusinessId: "17841403158327784", clickupListId: "901711532887", trelloBoardId: "68dacb7ba8957ca2511e9071" },
  { id: "nelson", name: "Nelson", adsActive: false, instagramBusinessId: "17841433504082304", adAccountId: "959090240381783", clickupListId: "901711532905", trelloBoardId: "6a62cc0c3349ba1222b431e0" },
  { id: "tiago", name: "Tiago Zamboni", adsActive: false, instagramBusinessId: "17841401844913174", clickupListId: "901713981087", trelloBoardId: "6a15e2cce98811c102520e22" },
  { id: "bela", name: "Bela Castro", adsActive: false, instagramBusinessId: "17841445125553950", clickupListId: "901711532881", trelloBoardId: "68f4f4c34ad83399f540858a" },
];
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/clients.ts
git commit -m "Adiciona trelloBoardId aos 6 clientes"
```

- [ ] **Step 4: Criar `src/lib/trello.ts`**

Crie `src/lib/trello.ts`:

```ts
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
};

export type ContentList = {
  id: string;
  name: string;
  cards: ContentCard[];
};

type RawTrelloList = { id: string; name: string; pos: number };
type RawTrelloLabel = { name: string; color: string | null };
type RawTrelloAttachment = { name: string; url: string; fileName?: string };
type RawTrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  idMembers: string[];
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

// ponytail: busca ao vivo, sem cache — 3 chamadas em paralelo (lists, cards, members), sem loop
// por card. "attachments=true" é obrigatório pra API devolver os anexos (testado ao vivo).
export async function fetchClientBoard(boardId: string): Promise<ContentList[]> {
  const [rawLists, rawCards, rawMembers]: [RawTrelloList[], RawTrelloCard[], RawTrelloMember[]] = await Promise.all([
    trelloGet(`boards/${boardId}/lists`, { fields: "name,pos" }),
    trelloGet(`boards/${boardId}/cards`, { fields: "name,desc,due,idList,idMembers,labels,pos", attachments: "true" }),
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

- [ ] **Step 5: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Verificação manual — busca real contra a API do Trello**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
cat > /private/tmp/test-trello.ts << 'EOF'
import { fetchClientBoard } from "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost/src/lib/trello";

async function main() {
  const lists = await fetchClientBoard("6a45322767a3396275720779"); // Débora
  console.log(`${lists.length} listas`);
  for (const l of lists) console.log(`  ${l.name}: ${l.cards.length} cards`);
  console.log(JSON.stringify(lists[0]?.cards[0] ?? lists.find((l) => l.cards.length > 0)?.cards[0], null, 2));
}

main();
EOF
set -a && source .env.local && set +a && npx tsx /private/tmp/test-trello.ts
rm /private/tmp/test-trello.ts
```

Expected: imprime 7 listas (Ideias, Stories Diários, Semana 1-4, Postados — nomes exatos do board real da Débora), a contagem de cards por lista somando 47, e um card de exemplo com `labels` preenchido (`Instagram`/`Facebook` com cor em hex), `dueDate: null`, `assignees: []`, `attachments` (vazio ou preenchido dependendo do card sorteado).

- [ ] **Step 7: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/trello.ts
git commit -m "Adiciona fetchClientBoard (API do Trello)"
```

- [ ] **Step 8: Criar a rota `/api/content/[client]`**

Crie `src/app/api/content/[client]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientBoard, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!client.trelloBoardId) {
    return Response.json({ error: "no_board_configured" }, { status: 404 });
  }
  if (!hasTrelloCredentials()) {
    // ponytail: distinto de "no_board_configured" — isso é config do ambiente (key/token
    // faltando), não do cliente. Mesma separação já aplicada na rota /api/tasks.
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const lists = await fetchClientBoard(client.trelloBoardId);
    return Response.json({ lists });
  } catch (err) {
    // ponytail: qualquer erro da API do Trello cai num 502 — a página trata isso com uma
    // mensagem inline, sem fallback de mock (não existe mock natural pra isso).
    console.error(`[content] falha ao buscar board pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 9: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 10: Build de produção**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npm run build`
Expected: build completo sem erro, com `/api/content/[client]` aparecendo na lista de rotas.

- [ ] **Step 11: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/api/content/\[client\]/route.ts
git commit -m "Rota /api/content busca o board do Trello do cliente"
```

---

### Task 2: Rota da página + item na Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/app/[client]/conteudos/page.tsx`

**Interfaces:**
- Consumes: nada de outras tasks (independente da Task 1 — só rota/navegação, a página em si é criada na Task 3).
- Produces: `Sidebar` aceita `active: "dashboard" | "tasks" | "conteudos"`. Rota `/[client]/conteudos` existe e faz a checagem de auth (renderiza `ContentPageClient`, que só existe de verdade a partir da Task 3 — até lá, este step cria a página, e ela só compila depois que a Task 3 criar o componente. Ver nota no Step 3).

- [ ] **Step 1: Adicionar o item "Conteúdos" na Sidebar**

Em `src/components/Sidebar.tsx`, troque:

```tsx
import Link from "next/link";
import { Logo } from "./Logo";

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8.5l1.7 1.7L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
] as const;

export function Sidebar({
  clientId,
  accessKey,
  active,
}: {
  clientId: string;
  accessKey: string;
  active: "dashboard" | "tasks";
}) {
```

por:

```tsx
import Link from "next/link";
import { Logo } from "./Logo";

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8.5l1.7 1.7L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="2" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="4" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
  { href: "/conteudos", label: "Conteúdos", key: "conteudos", icon: ContentIcon },
] as const;

export function Sidebar({
  clientId,
  accessKey,
  active,
}: {
  clientId: string;
  accessKey: string;
  active: "dashboard" | "tasks" | "conteudos";
}) {
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros (o `active` das pages existentes, `"dashboard"`/`"tasks"`, continua válido dentro do union type maior).

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/Sidebar.tsx
git commit -m "Sidebar: adiciona item Conteúdos"
```

- [ ] **Step 4: Criar a página `/[client]/conteudos`**

Crie `src/app/[client]/conteudos/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { ContentPageClient } from "@/components/ContentPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="conteudos" />
      <div className="flex-1">
        <ContentPageClient clientId={found.id} accessKey={key!} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: erro esperado — `@/components/ContentPageClient` ainda não existe (criado na Task 3). Nenhum outro erro deve aparecer.

- [ ] **Step 6: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/\[client\]/conteudos/page.tsx
git commit -m "Adiciona rota /[client]/conteudos"
```

---

### Task 3: Componentes — `ContentBoard`, `ContentCard`, `ContentPageClient`

**Files:**
- Create: `src/components/ContentCard.tsx`
- Create: `src/components/ContentBoard.tsx`
- Create: `src/components/ContentPageClient.tsx`

**Interfaces:**
- Consumes: `ContentList`, `ContentCard` (tipo, Task 1, `@/lib/trello`), rota `GET /api/content/[client]` (Task 1), página `/[client]/conteudos` (Task 2, já importa `ContentPageClient` por nome).
- Produces: página Conteúdos funcional ponta a ponta.

- [ ] **Step 1: Criar `ContentCard.tsx`**

Crie `src/components/ContentCard.tsx`:

```tsx
import type { ContentCard as ContentCardData } from "@/lib/trello";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function formatAssignees(assignees: string[]): string {
  return assignees.length > 0 ? assignees.join(", ") : "Sem responsável";
}

export function ContentCard({ card }: { card: ContentCardData }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-3 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-medium text-card-foreground">{card.name}</p>
      {card.description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{card.description}</p>}
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
      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <p>{formatDueDate(card.dueDate)}</p>
        <p>{formatAssignees(card.assignees)}</p>
      </div>
      {card.attachments.length > 0 && (
        <div className="mt-2 space-y-1">
          {card.attachments.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[11px] text-brand-accent hover:underline"
            >
              🔗 {a.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `ContentBoard.tsx`**

Crie `src/components/ContentBoard.tsx`:

```tsx
import type { ContentList } from "@/lib/trello";
import { ContentCard } from "./ContentCard";

export function ContentBoard({ lists }: { lists: ContentList[] }) {
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
        <div key={list.id} className="w-72 shrink-0 rounded-[var(--radius-card)] bg-muted/40 p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <p className="text-sm font-semibold text-card-foreground">{list.name}</p>
            <span className="text-xs font-medium text-muted-foreground">{list.cards.length}</span>
          </div>
          <div className="space-y-2">
            {list.cards.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Sem cards</p>
            ) : (
              list.cards.map((card) => <ContentCard key={card.id} card={card} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Criar `ContentPageClient.tsx`**

Crie `src/components/ContentPageClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { ContentList } from "@/lib/trello";
import { ContentBoard } from "./ContentBoard";

type ErrorKind = "no_board" | "fetch_failed";

export function ContentPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [lists, setLists] = useState<ContentList[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLists(null);
    setError(null);
    fetch(`/api/content/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_board_configured" ? "no_board" : "fetch_failed");
        }
        return data as { lists: ContentList[] };
      })
      .then((data) => {
        if (!cancelled) setLists(data.lists);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_board" ? "no_board" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_board"
      ? "Nenhum board configurado pra esse cliente."
      : "Não foi possível carregar os conteúdos agora.";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Conteúdos</h1>
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !lists && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && lists && <ContentBoard lists={lists} />}
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem nenhum erro (é o momento em que o erro pendente da Task 2 desaparece).

- [ ] **Step 5: Build de produção**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npm run build`
Expected: build completo sem erro, com `/[client]/conteudos` aparecendo na lista de rotas.

- [ ] **Step 6: Verificação manual completa via Browser pane**

1. `preview_start` com `{name: "dashboard-cliqueboost"}`.
2. Navegar pra `http://localhost:PORT/debora/conteudos?key=e5bff4d1825a067cfab62539526e9a3c` (Débora, 47 cards reais — bom teste de volume; porta conforme o `preview_start` reportar).
3. Confirmar: a sidebar mostra "Conteúdos" destacado, o board carrega em colunas lado a lado (Ideias, Stories Diários, Semana 1-4, Postados — nomes reais do board), cada coluna com a contagem certa de cards, cards mostrando nome/descrição/labels coloridos ("Instagram"/"Facebook" etc.), "Sem prazo" e "Sem responsável" (já que nenhum card real usa esses campos hoje), e os cards com anexo mostrando o link.
4. Clicar em "Dashboard" e depois em "Tasks" na sidebar — confirma que a navegação entre as 3 páginas funciona e a chave continua na URL.
5. Testar o scroll horizontal do board (mais colunas do que cabe na tela).
6. Checar `read_console_messages` — sem erros.

Expected: tudo acima bate, sem erros de console, dados reais e coerentes com o que já vimos via curl nesta sessão (47 cards no total, distribuídos pelas 7 listas da Débora).

- [ ] **Step 7: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/ContentCard.tsx src/components/ContentBoard.tsx src/components/ContentPageClient.tsx
git commit -m "Adiciona página Conteúdos (Kanban do Trello, colunas lado a lado)"
```

---

## Self-Review (feito pelo autor do plano, não delegado)

1. **Cobertura da spec**: mapeamento de board por cliente + lib server-only + rota com auth (Task 1); item de navegação + rota da página (Task 2); componentes de Kanban com todos os campos de card da decisão #3, incluindo data/responsável mesmo vazios (Task 3). "Bunker de Ideias" = coluna normal, sem tratamento especial — nenhuma task cria formulário de envio, consistente com a decisão #4 (fora de escopo). Todos os itens da spec têm task correspondente.
2. **Placeholders**: nenhum "TBD"/"implementar depois" — todo step tem código completo.
3. **Consistência de tipos**: `ContentList`/`ContentCard`/`ContentLabel` (Task 1) são os mesmos tipos usados em `ContentBoard`/`ContentCard.tsx`/`ContentPageClient` (Task 3) — mesmos nomes de campo (`name`, `description`, `labels`, `dueDate`, `assignees`, `attachments`). `client.trelloBoardId` (Task 1) é lido exatamente com esse nome na rota (Task 1) e a rota devolve `{ lists }`, que é exatamente o que `ContentPageClient` espera (Task 3). `Sidebar`'s `active="conteudos"` (Task 2) bate com a rota criada na mesma task. Import `type ContentCard as ContentCardData` em `ContentCard.tsx` evita colisão de nome entre o tipo (`@/lib/trello`) e o componente (mesmo arquivo) — mesmo padrão que outros componentes deste projeto já usam pra evitar esse tipo de colisão.
