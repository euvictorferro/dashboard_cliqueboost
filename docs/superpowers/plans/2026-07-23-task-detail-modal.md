# Modal de detalhes da Task — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicar numa task na página Tasks abre um modal central com mais detalhes (responsáveis com foto real, datas, prioridade, tempo, tags, descrição), sem nenhuma chamada de rede nova.

**Architecture:** Estende o tipo `TaskItem` e o mapeamento de `fetchClientTasks` (já existentes) pra capturar campos que a API do ClickUp já devolve na mesma chamada de lista. Um novo componente `TaskDetailModal` renderiza esses dados; `TasksTable` guarda qual task foi clicada e decide quando mostrar o modal — tudo com dado já em memória, sem fetch adicional.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind. Sem framework de testes no projeto — verificação por `npx tsc --noEmit`, `npm run build`, e checagem visual via Browser pane (mesmo padrão já usado nas features anteriores deste repositório).

## Global Constraints

- Branch: `feature-tasks-clickup`. Não mesclar em `main`/`staging` sem aprovação explícita do Victor.
- Modal é **somente leitura** — nenhuma edição de campo, nenhum botão de ação.
- **Sem** feed de atividade/histórico e **sem** link de volta pro ClickUp — decisões explícitas da spec.
- **Nenhuma chamada de rede nova** — o modal usa só a task já carregada pela página (`fetchClientTasks`/`/api/tasks/[client]`, inalterados).
- Campo `priority`: nenhuma task nos 6 clientes reais tem prioridade definida hoje — o formato exato do sub-campo textual não foi confirmado ao vivo contra a API. O mapeamento precisa ser defensivo (nunca lançar erro por formato inesperado; cair pra `null` nesse caso).

---

### Task 1: Estende `TaskItem` com os campos ricos que a API já devolve

**Files:**
- Modify: `src/lib/clickup.ts`

**Interfaces:**
- Consumes: nada de outras tasks (task base).
- Produces: `TaskItem` com os campos novos `startDate`, `priority`, `tags`, `timeEstimate`, `timeSpent`, e `assignees` no novo formato `TaskAssignee[]` (em vez de `string[]`). Exporta os tipos `TaskAssignee` e `TaskPriority`. Consumido pelas Tasks 2 e 3.

- [ ] **Step 1: Trocar o tipo `TaskItem` e adicionar `TaskAssignee`/`TaskPriority`**

Em `src/lib/clickup.ts`, troque:

```ts
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
```

por:

```ts
export type TaskAssignee = {
  name: string;
  color: string;
  initials: string;
  avatarUrl?: string;
};

export type TaskPriority = {
  label: string;
  color: string;
};

export type TaskItem = {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusOrder: number;
  dueDate: number | null;
  startDate: number | null;
  assignees: TaskAssignee[];
  description: string;
  priority: TaskPriority | null;
  tags: string[];
  timeEstimate: number | null;
  timeSpent: number;
};
```

- [ ] **Step 2: Atualizar `RawClickUpTask` com os campos brutos correspondentes**

Troque:

```ts
type RawClickUpTask = {
  id: string;
  name: string;
  status: { status: string; color: string; orderindex: number };
  due_date: string | null;
  assignees: { username: string }[];
  description?: string;
};
```

por:

```ts
type RawClickUpAssignee = {
  username: string;
  color: string;
  initials: string;
  profilePicture: string | null;
};

type RawClickUpTask = {
  id: string;
  name: string;
  status: { status: string; color: string; orderindex: number };
  due_date: string | null;
  start_date: string | null;
  assignees: RawClickUpAssignee[];
  description?: string;
  priority: unknown;
  tags: { name: string }[];
  time_estimate: number | string | null;
  time_spent: number | string | null;
};
```

- [ ] **Step 3: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: erro esperado nesse ponto — `fetchClientTasks` ainda não constrói o novo formato (próximo step corrige). Se aparecer QUALQUER outro erro fora de `src/lib/clickup.ts`, pare e reavalie.

- [ ] **Step 4: Adicionar leitura defensiva de `priority` e reescrever o mapeamento de `fetchClientTasks`**

Logo acima de `fetchClientTasks`, adicione:

```ts
// ponytail: nenhuma task nos 6 clientes reais tem prioridade definida hoje (confirmado ao vivo
// nesta sessão) — não deu pra testar o formato exato do campo "priority" da API do ClickUp contra
// dado real, e a documentação pública não detalha os sub-campos. Leitura defensiva: tenta os 2
// nomes de campo mais prováveis (`priority` ou `name` pro texto) e cai pra null se não bater.
function parsePriority(raw: unknown): TaskPriority | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const label = typeof p.priority === "string" ? p.priority : typeof p.name === "string" ? p.name : null;
  const color = typeof p.color === "string" ? p.color : null;
  if (!label || !color) return null;
  return { label, color };
}
```

Troque todo o corpo de `fetchClientTasks` (a partir do `return tasks.map`):

```ts
  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status.status,
    statusColor: t.status.color,
    statusOrder: t.status.orderindex,
    dueDate: t.due_date ? Number(t.due_date) : null,
    startDate: t.start_date ? Number(t.start_date) : null,
    assignees: t.assignees.map((a) => ({
      name: a.username,
      color: a.color,
      initials: a.initials,
      avatarUrl: a.profilePicture ?? undefined,
    })),
    description: t.description ?? "",
    priority: parsePriority(t.priority),
    tags: t.tags.map((tag) => tag.name),
    timeEstimate: t.time_estimate ? Number(t.time_estimate) : null,
    timeSpent: t.time_spent ? Number(t.time_spent) : 0,
  }));
```

- [ ] **Step 5: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: erro esperado em `src/components/TasksTable.tsx` (usa `assignees: string[]` do formato antigo) — corrigido na Task 3. Nenhum outro erro deve aparecer.

- [ ] **Step 6: Verificação manual — busca real contra a API do ClickUp com os campos novos**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
cat > /private/tmp/test-clickup-fields.ts << 'EOF'
import { fetchClientTasks } from "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost/src/lib/clickup";

async function main() {
  const tasks = await fetchClientTasks("901714211778"); // Laís
  console.log(`${tasks.length} tasks`);
  console.log(JSON.stringify(tasks[0], null, 2));
}

main();
EOF
set -a && source .env.local && set +a && npx tsx /private/tmp/test-clickup-fields.ts
rm /private/tmp/test-clickup-fields.ts
```

Expected: imprime uma task com `assignees` como array de objetos (`name`, `color`, `initials`, `avatarUrl` — presente quando o ClickUp tiver foto), `tags` como array (provavelmente vazio, nenhum cliente usa tags hoje — tudo bem, não é erro), `priority: null` (nenhuma task tem prioridade — também esperado), `startDate`/`timeEstimate` provavelmente `null`, `timeSpent` um número (0 se nunca rastreado).

- [ ] **Step 7: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/clickup.ts
git commit -m "Estende TaskItem com prioridade, tags, datas e responsáveis com foto real"
```

---

### Task 2: Componente `TaskDetailModal`

**Files:**
- Create: `src/components/TaskDetailModal.tsx`

**Interfaces:**
- Consumes: `TaskItem`, `TaskAssignee`, `TaskPriority` (Task 1, `@/lib/clickup`).
- Produces: `export function TaskDetailModal({ task, onClose }: { task: TaskItem; onClose: () => void })`. Consumido pela Task 3.

- [ ] **Step 1: Criar `TaskDetailModal.tsx`**

Crie `src/components/TaskDetailModal.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { TaskItem } from "@/lib/clickup";

function formatDate(value: number | null): string | null {
  if (value === null) return null;
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function formatDateRange(startDate: number | null, dueDate: number | null): string {
  const start = formatDate(startDate);
  const due = formatDate(dueDate);
  if (start && due) return `${start} → ${due}`;
  if (due) return `Até ${due}`;
  if (start) return `A partir de ${start}`;
  return "Sem prazo definido";
}

function formatTime(timeEstimate: number | null, timeSpent: number): string {
  const parts: string[] = [];
  if (timeEstimate) parts.push(`${formatDuration(timeEstimate)} estimadas`);
  if (timeSpent) parts.push(`${formatDuration(timeSpent)} registradas`);
  return parts.length > 0 ? parts.join(" · ") : "Não definido";
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

export function TaskDetailModal({ task, onClose }: { task: TaskItem; onClose: () => void }) {
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
          <h2 className="text-lg font-bold text-card-foreground">{task.name}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Status">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: task.statusColor }}
            >
              {task.status}
            </span>
          </Field>

          <Field label="Responsáveis">
            {task.assignees.length === 0 ? (
              <span className="text-muted-foreground">Sem responsável</span>
            ) : (
              <ul className="space-y-1.5">
                {task.assignees.map((a) => (
                  <li key={a.name} className="flex items-center gap-2">
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL assinada do ClickUp
                      <img src={a.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: a.color }}
                      >
                        {a.initials}
                      </span>
                    )}
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field label="Datas">{formatDateRange(task.startDate, task.dueDate)}</Field>

          <Field label="Prioridade">
            {task.priority ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: task.priority.color }}
              >
                {task.priority.label}
              </span>
            ) : (
              <span className="text-muted-foreground">Sem prioridade</span>
            )}
          </Field>

          <Field label="Tempo">{formatTime(task.timeEstimate, task.timeSpent)}</Field>

          <Field label="Tags">
            {task.tags.length === 0 ? (
              <span className="text-muted-foreground">Sem tags</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-card-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Descrição">
            {task.description ? (
              <p className="whitespace-pre-wrap">{task.description}</p>
            ) : (
              <span className="text-muted-foreground">Sem descrição</span>
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: mesmo único erro pendente da Task 1 (Step 5, em `TasksTable.tsx`), nenhum erro novo relacionado a `TaskDetailModal.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/TaskDetailModal.tsx
git commit -m "Adiciona TaskDetailModal (popup somente leitura com detalhes da task)"
```

---

### Task 3: `TasksTable` — linhas clicáveis, avatares reais, abre o modal

**Files:**
- Modify: `src/components/TasksTable.tsx`

**Interfaces:**
- Consumes: `TaskItem`/`TaskAssignee` (Task 1), `TaskDetailModal` (Task 2).
- Produces: página Tasks funcional ponta a ponta com o modal.

- [ ] **Step 1: Reescrever `TasksTable.tsx` inteiro**

Troque todo o conteúdo de `src/components/TasksTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { TaskAssignee, TaskItem } from "@/lib/clickup";
import { TaskDetailModal } from "./TaskDetailModal";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function AssigneeAvatars({ assignees }: { assignees: TaskAssignee[] }) {
  if (assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem responsável</span>;
  }
  return (
    <div className="flex items-center -space-x-2">
      {assignees.map((a) => (
        <span
          key={a.name}
          title={a.name}
          className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-card"
        >
          {a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL assinada do ClickUp
            <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white"
              style={{ backgroundColor: a.color }}
            >
              {a.initials}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type TaskSectionData = { label: string; color: string; order: number; tasks: TaskItem[] };

function TaskSection({ section, onSelectTask }: { section: TaskSectionData; onSelectTask: (task: TaskItem) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <ChevronIcon open={open} />
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: section.color }}
        >
          {section.label}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{section.tasks.length}</span>
      </button>
      {open && (
        <div>
          {section.tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onSelectTask(task)}
              className="flex w-full items-center gap-4 border-t border-border px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <p className="flex-1 truncate text-sm text-card-foreground">{task.name}</p>
              <p className="hidden w-48 shrink-0 truncate text-xs text-muted-foreground sm:block">
                {task.description || "—"}
              </p>
              <p className="w-24 shrink-0 text-xs text-muted-foreground">{formatDueDate(task.dueDate)}</p>
              <div className="w-20 shrink-0">
                <AssigneeAvatars assignees={task.assignees} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksTable({ tasks }: { tasks: TaskItem[] }) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const groups = new Map<string, TaskSectionData>();
  for (const task of tasks) {
    const existing = groups.get(task.status);
    if (existing) {
      existing.tasks.push(task);
    } else {
      groups.set(task.status, { label: task.status, color: task.statusColor, order: task.statusOrder, tasks: [task] });
    }
  }

  const sections = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const section of sections) {
    section.tasks.sort((a, b) => {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    });
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <p className="flex-1">Nome</p>
        <p className="hidden w-48 shrink-0 sm:block">Descrição</p>
        <p className="w-24 shrink-0">Data prevista</p>
        <p className="w-20 shrink-0">Responsável</p>
      </div>
      {sections.map((section) => (
        <TaskSection key={section.label} section={section} onSelectTask={setSelectedTask} />
      ))}
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem nenhum erro (é o momento em que o erro pendente das tasks anteriores desaparece).

- [ ] **Step 3: Build de produção**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npm run build`
Expected: build completo sem erro.

- [ ] **Step 4: Verificação manual completa via Browser pane**

1. `preview_start` com `{name: "dashboard-cliqueboost"}`.
2. Navegar pra `http://localhost:PORT/lais/tasks?key=ecfc91088af28b32fb48d1dbcc46f626` (porta conforme o `preview_start` reportar).
3. Clicar em pelo menos 2 tasks diferentes (uma com responsável, outra sem — ex: "Adicionar refs no Obsidian" tem `assignees: []`) e confirmar: o modal abre na hora (sem spinner), mostra nome, status, responsáveis (foto ou iniciais), datas ("Sem prazo definido" quando não houver nenhuma data), "Sem prioridade", tempo ("Não definido" quando não houver estimativa nem tempo registrado), "Sem tags", descrição ou "Sem descrição".
4. Confirmar que Esc fecha o modal, clicar fora fecha o modal, e o X fecha o modal.
5. Confirmar que os avatares na tabela (fora do modal) continuam aparecendo corretos, agora com a cor/iniciais reais do ClickUp em vez da cor gerada por hash.
6. Checar `read_console_messages` — sem erros.

Expected: tudo acima se comporta como descrito, sem erros de console.

- [ ] **Step 5: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/TasksTable.tsx
git commit -m "TasksTable: linhas clicáveis abrem TaskDetailModal, avatares usam dado real do ClickUp"
```

---

## Self-Review (feito pelo autor do plano, não delegado)

1. **Cobertura da spec**: campos novos do `TaskItem` (Task 1) cobrem prioridade/tags/datas/tempo/responsáveis com foto exigidos pela spec; leitura defensiva de `priority` documentada e implementada (Task 1); modal somente leitura, sem activity feed, sem link pro ClickUp, fecha em X/clique fora/Esc (Task 2); linhas clicáveis e avatares reais (Task 3). Nenhuma chamada de rede nova em nenhuma task — todas usam a mesma `fetchClientTasks`/dado já carregado. Todos os itens da spec têm task correspondente.
2. **Placeholders**: nenhum "TBD"/"implementar depois" — todo step tem código completo.
3. **Consistência de tipos**: `TaskAssignee`/`TaskPriority` (Task 1) são os mesmos tipos usados em `TaskDetailModal` (Task 2) e em `TasksTable`/`AssigneeAvatars` (Task 3) — mesmos nomes de campo (`name`, `color`, `initials`, `avatarUrl`, `label`). `onSelectTask`/`setSelectedTask` (Task 3) e `onClose` (Task 2) batem entre si.
