# Tasks + Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma página "Tasks" (só leitura, espelhando a Lista do ClickUp de cada cliente) e a sidebar de navegação necessária pra alternar entre "Dashboard" e "Tasks".

**Architecture:** Introduz um `layout.tsx` compartilhado sob `/[client]` que faz a checagem de token uma única vez (hoje duplicada seria necessária com 2 páginas) e renderiza a `Sidebar`. Um novo `src/lib/clickup.ts` (server-only, mesmo padrão de `meta.ts`) busca as tasks direto da API do ClickUp, sem cache. A página Tasks segue o mesmo padrão de página-servidor-fina + componente-cliente que já existe pro Dashboard.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, API REST do ClickUp v2.

## Global Constraints

- Branch: `feature-tasks-clickup`. Não mesclar em `main`/`staging` — essa visualização não é pros clientes verem ainda, só aprovação explícita do Victor libera o merge.
- Cliente só visualiza tasks — sem UI de criação/edição/exclusão nessa v1.
- Busca sempre ao vivo na API do ClickUp, sem cache.
- Sem suíte de testes automatizada no projeto — cada task verifica com `npx tsc --noEmit` (obrigatório) e um passo manual (curl e/ou Browser pane).
- Mapeamento cliente → Lista do ClickUp (já confirmado):

  | client.id | List ID |
  |---|---|
  | debora | 901714744652 |
  | lais | 901714211778 |
  | sam | 901711532887 |
  | nelson | 901711532905 |
  | tiago | 901713981087 |
  | bela | 901711532881 |

- `CLICKUP_API_TOKEN` já está configurado em `.env.local` e validado nesta sessão contra a API real (`GET /list/{id}/task` retornando `name`, `status` (`{status, color, orderindex}`), `due_date` (string de epoch-ms ou `null`), `assignees` (array de `{username, ...}`), `description`).

---

### Task 1: Camada de dados do ClickUp (lib + rota)

**Files:**
- Modify: `src/lib/clients.ts`
- Create: `src/lib/clickup.ts`
- Create: `src/app/api/tasks/[client]/route.ts`

**Interfaces:**
- Consumes: nada de outras tasks (task base).
- Produces: `Client.clickupListId?: string` (novo campo), `export type TaskItem` e `export async function fetchClientTasks(listId: string): Promise<TaskItem[]>` e `export function hasClickUpCredentials(): boolean` de `src/lib/clickup.ts`. Rota `GET /api/tasks/[client]?key=...` retornando `{ tasks: TaskItem[] }` (200), `{ error: "no_list_configured" }` (404) ou `{ error: "fetch_failed" }` (502).

- [ ] **Step 1: Adicionar `clickupListId` ao tipo `Client` e preencher os 6 clientes**

Troque todo o conteúdo de `src/lib/clients.ts`:

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

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/clients.ts
git commit -m "Adiciona clickupListId aos 6 clientes"
```

- [ ] **Step 4: Criar `src/lib/clickup.ts`**

Crie `src/lib/clickup.ts`:

```ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa o token secreto).
const CLICKUP_API = "https://api.clickup.com/api/v2";

export function hasClickUpCredentials(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN);
}

export type TaskItem = {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusOrder: number;
  dueDate: number | null;
  assignees: string[];
  description: string;
};

type RawClickUpTask = {
  id: string;
  name: string;
  status: { status: string; color: string; orderindex: number };
  due_date: string | null;
  assignees: { username: string }[];
  description?: string;
};

// ponytail: busca ao vivo, sem cache — volume baixo (1 chamada por carregamento da página,
// sem loop de dias como as métricas da Meta) e listas de tarefas mudam bem menos.
export async function fetchClientTasks(listId: string): Promise<TaskItem[]> {
  const url = new URL(`${CLICKUP_API}/list/${listId}/task`);
  url.searchParams.set("include_closed", "true");
  const res = await fetch(url, {
    headers: { Authorization: process.env.CLICKUP_API_TOKEN! },
    cache: "no-store",
  });
  const json = await res.json();
  if (json.err) throw new Error(json.err);

  const tasks: RawClickUpTask[] = json.tasks ?? [];
  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status.status,
    statusColor: t.status.color,
    statusOrder: t.status.orderindex,
    dueDate: t.due_date ? Number(t.due_date) : null,
    assignees: t.assignees.map((a) => a.username),
    description: t.description ?? "",
  }));
}
```

- [ ] **Step 5: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Verificação manual — busca real contra a API do ClickUp**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
cat > /tmp/test-clickup.ts << 'EOF'
import { fetchClientTasks } from "./src/lib/clickup";

async function main() {
  const tasks = await fetchClientTasks("901714211778"); // Laís
  console.log(`${tasks.length} tasks`);
  console.log(tasks[0]);
}

main();
EOF
set -a && source .env.local && set +a && npx tsx /tmp/test-clickup.ts
rm /tmp/test-clickup.ts
```

Expected: imprime um número de tasks maior que 0 e os campos da primeira task (`name`, `status`, `statusColor`, `statusOrder`, `dueDate`, `assignees`, `description`) com valores plausíveis (não `undefined`).

- [ ] **Step 7: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/clickup.ts
git commit -m "Adiciona fetchClientTasks (API do ClickUp)"
```

- [ ] **Step 8: Criar a rota `/api/tasks/[client]`**

Crie `src/app/api/tasks/[client]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientTasks, hasClickUpCredentials } from "@/lib/clickup";
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

  if (!client.clickupListId || !hasClickUpCredentials()) {
    return Response.json({ error: "no_list_configured" }, { status: 404 });
  }

  try {
    const tasks = await fetchClientTasks(client.clickupListId);
    return Response.json({ tasks });
  } catch (err) {
    // ponytail: qualquer erro da API do ClickUp cai num 502 — a página trata isso com uma
    // mensagem inline, sem fallback de mock (não existe mock natural pra tarefas).
    console.error(`[tasks] falha ao buscar tasks pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 9: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 10: Verificação manual — build de produção**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npm run build`
Expected: build passa sem erro (a checagem funcional completa da rota fica pro Task 3, quando a página já estiver chamando ela de verdade via Browser pane — mas dá pra confirmar via curl direto assim que o dev server subir, ver Task 3 Step 4).

- [ ] **Step 11: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/api/tasks/\[client\]/route.ts
git commit -m "Rota /api/tasks/[client] busca tasks do ClickUp"
```

---

### Task 2: Layout compartilhado + Sidebar

**Files:**
- Create: `src/app/[client]/layout.tsx`
- Modify: `src/app/[client]/page.tsx`
- Create: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: nada de Task 1 diretamente (a Sidebar só monta URLs, não chama a rota de tasks).
- Produces: `Sidebar({ clientId, accessKey })` — consumido pelo layout. O layout passa a ser o único lugar que chama `verifyClientToken` pra tudo debaixo de `/[client]/*`.

- [ ] **Step 1: Criar o layout compartilhado**

Crie `src/app/[client]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { verifyClientToken } from "@/lib/access";

export default async function ClientLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
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
      <Sidebar clientId={found.id} accessKey={key!} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Simplificar `src/app/[client]/page.tsx` (checagem de token já é feita no layout)**

Troque todo o conteúdo de `src/app/[client]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { Dashboard } from "@/components/Dashboard";

export default async function ClientPage({
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

  return <Dashboard client={found} accessKey={key!} />;
}
```

- [ ] **Step 3: Criar `Sidebar.tsx`**

Crie `src/components/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
] as const;

export function Sidebar({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-4">
      {NAV_ITEMS.map((item) => {
        const href = `/${clientId}${item.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={item.href}
            href={`${href}?key=${encodeURIComponent(accessKey)}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual — Dashboard continua igual, agora com sidebar**

1. `preview_start` com `{name: "dashboard-cliqueboost"}`.
2. Navegar pra `http://localhost:PORT/lais?key=ecfc91088af28b32fb48d1dbcc46f626` (porta impressa pelo preview_start).
3. Confirmar: o Dashboard renderiza exatamente como antes (todos os cards, gráficos, sem regressão), agora com uma coluna de navegação à esquerda mostrando "Dashboard" (destacado) e "Tasks".
4. Clicar em "Tasks" — vai dar 404 (página ainda não existe, isso é esperado, resolve no Task 3), mas confirme que a URL virou `/lais/tasks?key=ecfc91088af28b32fb48d1dbcc46f626` (a chave foi propagada corretamente).

Expected: passos 3 e 4 batem com o descrito, sem erros de console.

- [ ] **Step 6: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/\[client\]/layout.tsx src/app/\[client\]/page.tsx src/components/Sidebar.tsx
git commit -m "Adiciona layout compartilhado + Sidebar (Dashboard/Tasks)"
```

---

### Task 3: Página Tasks + tabela

**Files:**
- Create: `src/app/[client]/tasks/page.tsx`
- Create: `src/components/TasksPageClient.tsx`
- Create: `src/components/TasksTable.tsx`

**Interfaces:**
- Consumes: `TaskItem` (Task 1, `@/lib/clickup`), rota `GET /api/tasks/[client]` (Task 1), `Sidebar`/layout (Task 2 — essa página só existe debaixo do layout já criado).
- Produces: página funcional em `/[client]/tasks`.

- [ ] **Step 1: Criar `TasksTable.tsx`**

Crie `src/components/TasksTable.tsx`:

```tsx
import type { TaskItem } from "@/lib/clickup";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function formatAssignees(assignees: string[]): string {
  return assignees.length > 0 ? assignees.join(", ") : "Sem responsável";
}

export function TasksTable({ tasks }: { tasks: TaskItem[] }) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.statusOrder !== b.statusOrder) return a.statusOrder - b.statusOrder;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate - b.dueDate;
  });

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Data prevista</th>
            <th className="px-4 py-3 font-medium">Responsável</th>
            <th className="px-4 py-3 font-medium">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => (
            <tr key={task.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-card-foreground">{task.name}</td>
              <td className="px-4 py-3">
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: task.statusColor }}
                >
                  {task.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDueDate(task.dueDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatAssignees(task.assignees)}</td>
              <td className="px-4 py-3 text-muted-foreground">{task.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `TasksPageClient.tsx`**

Crie `src/components/TasksPageClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { TaskItem } from "@/lib/clickup";
import { TasksTable } from "./TasksTable";

type ErrorKind = "no_list" | "fetch_failed";

export function TasksPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setError(null);
    fetch(`/api/tasks/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_list_configured" ? "no_list" : "fetch_failed");
        }
        return data as { tasks: TaskItem[] };
      })
      .then((data) => {
        if (!cancelled) setTasks(data.tasks);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_list" ? "no_list" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_list"
      ? "Nenhuma lista de tarefas configurada pra esse cliente."
      : "Não foi possível carregar as tarefas agora.";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Tasks</h1>
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !tasks && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && tasks && <TasksTable tasks={tasks} />}
    </div>
  );
}
```

- [ ] **Step 3: Criar a página `/[client]/tasks`**

Crie `src/app/[client]/tasks/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { TasksPageClient } from "@/components/TasksPageClient";

export default async function ClientTasksPage({
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

  return <TasksPageClient clientId={found.id} accessKey={key!} />;
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Build de produção**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npm run build`
Expected: build completo sem erro.

- [ ] **Step 6: Verificação manual completa via Browser pane**

1. `preview_start` com `{name: "dashboard-cliqueboost"}` (reaproveita se já estiver rodando do Task 2).
2. Navegar pra `http://localhost:PORT/lais/tasks?key=ecfc91088af28b32fb48d1dbcc46f626`.
3. Confirmar: a sidebar mostra "Tasks" destacado, a tabela carrega as tasks reais da Lista "Laís" no ClickUp (14 tasks nesta sessão — nome, badge de status colorido nas cores do ClickUp, data prevista formatada ou "Sem prazo", responsável ou "Sem responsável").
4. Clicar em "Dashboard" na sidebar — confirma que volta pro Dashboard normalmente, com a chave preservada na URL.
5. Checar `read_console_messages` — sem erros.

Expected: tudo acima bate, sem erros de console, dados reais e coerentes com o que já vimos via curl nesta sessão.

- [ ] **Step 7: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/\[client\]/tasks/page.tsx src/components/TasksPageClient.tsx src/components/TasksTable.tsx
git commit -m "Adiciona página Tasks (tabela só leitura, dados do ClickUp)"
```

---

## Self-Review

1. **Cobertura da spec**: entrada da lib ClickUp + rota (Task 1), layout+sidebar com propagação de `?key=` (Task 2), tabela com as 5 colunas/ordenação/formatação exatas da decisão #2 (Task 3), tratamento de erro com as 2 mensagens distintas (`no_list_configured` vs `fetch_failed`, Task 3). Todos os itens da spec têm task correspondente.
2. **Placeholders**: nenhum "TBD"/"implementar depois" — todo step tem código completo.
3. **Consistência de tipos**: `TaskItem` (Task 1) é o mesmo tipo usado em `TasksTable`/`TasksPageClient` (Task 3) — mesmos nomes de campo (`statusColor`, `statusOrder`, `dueDate`, `assignees`, `description`). `clickupListId` (Task 1) é lido exatamente com esse nome na rota. `Sidebar` (Task 2) monta URLs no formato `/${clientId}` e `/${clientId}/tasks`, que são exatamente as rotas criadas nas Tasks 2 e 3.
