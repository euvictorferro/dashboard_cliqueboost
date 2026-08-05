# Report de Bug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente reporta um bug (página + descrição + até 3 prints) pelo dropdown de conta,
via um modal; o report é salvo no Supabase (tabela `bug_reports` + bucket de storage
`bug-report-screenshots`), sem notificação automática.

**Architecture:** Rota `POST /api/bug-reports/[client]` (mesmo padrão de
`/api/conta/[client]/logo`: valida token, sobe as imagens pro Storage, insere uma linha).
`BugReportModal` client component autocontido (formulário → confirmação, sem sair da página
atual). `AccountCard` ganha um item de menu novo que abre o modal; o `pageLabel` da página
atual desce de `AppFrame` → `Sidebar` → `AccountCard` pra pré-selecionar o dropdown de página.

**Tech Stack:** Next.js (App Router) + React + TypeScript + Tailwind + Supabase (Postgres +
Storage), sem libs novas.

## Global Constraints

- Sem framework de testes no projeto — verificação é `npx tsc --noEmit -p .` (zero erros) e,
  na tarefa final, `npm run build` + checagem visual manual no preview.
- Sem notificação automática (e-mail/Slack/push) — só grava no banco, conforme decidido na
  spec (`docs/superpowers/specs/2026-08-05-bug-report-design.md`).
- RLS ligado na tabela nova, sem policies — só a Service Role Key (server-side) acessa, mesmo
  padrão de `referral_leads`/`chat_messages`.
- Upload de imagem: máximo 3 arquivos por report, 2MB cada, tipos `image/png`, `image/jpeg`,
  `image/webp` — mesmo teto de tamanho já usado no upload de foto de perfil
  (`src/app/api/conta/[client]/logo/route.ts`).
- Ícones em SVG inline (mesmo padrão do resto do projeto) — sem instalar lib de ícones.
- Cards/modais usam `rounded-lg border border-border bg-card` (padrão mais recente da branch).

---

## Task 1: Migration da tabela `bug_reports`

**Files:**
- Create: `supabase/migrations/0017_bug_reports.sql`

**Interfaces:**
- Produces: tabela `bug_reports` com colunas `id uuid`, `client_id text`, `page text`,
  `description text`, `screenshot_urls text[]`, `created_at timestamptz` — consumida pela
  Task 2.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0017_bug_reports.sql
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  page text not null,
  description text not null,
  screenshot_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de referral_leads/chat_messages.
alter table bug_reports enable row level security;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0017_bug_reports.sql
git commit -m "feat(bug-report): migration da tabela bug_reports"
```

Não é possível rodar essa migration daqui (sem acesso de rede ao Supabase neste ambiente) —
ela roda quando o Victor aplicar as migrations pendentes no projeto Supabase (mesmo fluxo já
usado pras migrations anteriores, 0001-0016).

---

## Task 2: `src/lib/bugReports.ts`

**Files:**
- Create: `src/lib/bugReports.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` de `src/lib/supabase.ts` (já existe).
- Produces: `createBugReport(clientId: string, page: string, description: string,
  screenshotUrls: string[]): Promise<void>` — consumida pela Task 3.

- [ ] **Step 1: Criar o arquivo**

```ts
// src/lib/bugReports.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export async function createBugReport(
  clientId: string,
  page: string,
  description: string,
  screenshotUrls: string[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("bug_reports")
    .insert({ client_id: clientId, page, description, screenshot_urls: screenshotUrls });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bugReports.ts
git commit -m "feat(bug-report): lib createBugReport"
```

---

## Task 3: Rota `POST /api/bug-reports/[client]`

**Files:**
- Create: `src/app/api/bug-reports/[client]/route.ts`

**Interfaces:**
- Consumes: `CLIENTS` de `@/lib/clients`, `verifyClientToken` de `@/lib/access`,
  `createBugReport` de `@/lib/bugReports` (Task 2), `getSupabaseAdmin` de `@/lib/supabase`.
- Produces: endpoint HTTP `POST /api/bug-reports/[client]?key=...` — recebe `FormData` com
  campos `page` (string), `description` (string) e `screenshots` (0 a 3 arquivos, mesmo campo
  repetido), responde `{ ok: true }` em sucesso ou `{ error: "..." }` com status apropriado.
  Consumida pela Task 4 (o modal faz o `fetch` pra essa rota).

- [ ] **Step 1: Criar a rota**

```ts
// src/app/api/bug-reports/[client]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { createBugReport } from "@/lib/bugReports";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_SCREENSHOTS = 3;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "invalid_body" }, { status: 400 });

  const page = formData.get("page");
  const description = formData.get("description");
  if (typeof page !== "string" || page.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const files = formData.getAll("screenshots").filter((f): f is File => f instanceof File);
  if (files.length > MAX_SCREENSHOTS) return Response.json({ error: "too_many_files" }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "invalid_type" }, { status: 400 });
    if (file.size > MAX_SIZE_BYTES) return Response.json({ error: "too_large" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "fetch_failed" }, { status: 502 });

  try {
    const screenshotUrls: string[] = [];
    for (const file of files) {
      const ext = EXT_BY_TYPE[file.type];
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("bug-report-screenshots")
        .upload(path, buffer, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from("bug-report-screenshots").getPublicUrl(path);
      screenshotUrls.push(data.publicUrl);
    }

    await createBugReport(clientId, page.trim(), description.trim(), screenshotUrls);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[bug-reports] falha ao salvar report de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/bug-reports/[client]/route.ts"
git commit -m "feat(bug-report): rota POST /api/bug-reports/[client]"
```

---

## Task 4: `BugReportModal`

**Files:**
- Create: `src/components/BugReportModal.tsx`

**Interfaces:**
- Consumes: nada de outro componente novo (chama `fetch` direto na rota da Task 3).
- Produces: `BugReportModal({ clientId: string; accessKey: string; currentPageLabel: string;
  onClose: () => void })` — consumido pela Task 5.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/BugReportModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";

const PAGE_OPTIONS = ["Dashboard", "Tasks", "Conteúdos", "Calendário", "Atas", "Bunker", "Booster AI", "Conta", "Outra"];
const MAX_SCREENSHOTS = 3;

type Status = "form" | "sending" | "sent";
type Screenshot = { file: File; previewUrl: string };

function CheckCircleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M9.5 4.5L4.7 9.3a1.8 1.8 0 1 0 2.5 2.5l5.3-5.3a3 3 0 1 0-4.2-4.2L3 7.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BugReportModal({
  clientId,
  accessKey,
  currentPageLabel,
  onClose,
}: {
  clientId: string;
  accessKey: string;
  currentPageLabel: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(PAGE_OPTIONS.includes(currentPageLabel) ? currentPageLabel : "Outra");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      for (const s of screenshots) URL.revokeObjectURL(s.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_SCREENSHOTS - screenshots.length;
    const accepted = files.slice(0, room);
    setScreenshots((prev) => [...prev, ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("page", page);
    formData.append("description", description.trim());
    for (const s of screenshots) formData.append("screenshots", s.file);

    fetch(`/api/bug-reports/${clientId}?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("sent");
      })
      .catch(() => {
        setStatus("form");
        setErrorMsg("Não foi possível enviar agora, tenta de novo.");
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        {status === "sent" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="text-brand-success">
              <CheckCircleIcon />
            </span>
            <p className="text-sm font-semibold text-card-foreground">Enviamos o erro para nosso time.</p>
            <p className="text-sm text-muted-foreground">
              Nosso time de developers vai analisar o erro e corrigi-lo assim que possível. Agradecemos pelo seu
              feedback.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-card-foreground">Reportar bug</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="bug-report-page">
                Página com o problema
              </label>
              <select
                id="bug-report-page"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                {PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="bug-report-description">
                O que aconteceu?
              </label>
              <textarea
                id="bug-report-description"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreve o que você viu, o que esperava ver, e como reproduzir..."
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={screenshots.length >= MAX_SCREENSHOTS}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <PaperclipIcon />
                Anexar print ({screenshots.length}/{MAX_SCREENSHOTS})
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFilesChosen}
                className="hidden"
              />
              {screenshots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {screenshots.map((s, i) => (
                    <div key={s.previewUrl} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.previewUrl} alt={s.file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(i)}
                        aria-label={`Remover ${s.file.name}`}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

            <button
              type="submit"
              disabled={!description.trim() || status === "sending"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40"
            >
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/BugReportModal.tsx
git commit -m "feat(bug-report): modal de formulário + confirmação"
```

---

## Task 5: Integrar no `AccountCard` (thread do `pageLabel` + item de menu)

**Files:**
- Modify: `src/components/AppFrame.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/AccountCard.tsx`

**Interfaces:**
- Consumes: `BugReportModal` (Task 4).
- Produces: nada consumido por outra task — topo da árvore desta feature.

- [ ] **Step 1: `AppFrame.tsx` — passar `pageLabel` pro `Sidebar`**

Ler o arquivo atual primeiro. É uma mudança de uma linha: no JSX que renderiza `<Sidebar
.../>`, adicionar a prop `pageLabel={pageLabel}` (o valor já existe no componente, só não era
passado adiante):

```tsx
<Sidebar clientId={clientId} accessKey={accessKey} active={active} pageLabel={pageLabel} collapsed={collapsed} />
```

- [ ] **Step 2: `Sidebar.tsx` — aceitar `pageLabel` e repassar pro `AccountCard`**

Ler o arquivo atual primeiro. Duas mudanças:

1. No tipo de props de `Sidebar` (`export function Sidebar({ clientId, accessKey, active,
   collapsed = false }: {...})`), adicionar `pageLabel: string;` ao tipo e à desestruturação.
2. Onde hoje renderiza `<AccountCard clientId={clientId} accessKey={accessKey} />`, mudar
   para `<AccountCard clientId={clientId} accessKey={accessKey} pageLabel={pageLabel} />`.

- [ ] **Step 3: `AccountCard.tsx` — item de menu + estado do modal**

Ler o arquivo atual primeiro (já tem os itens Ajustes/Tema/Sair, mais o hover pra abrir o
dropdown). Mudanças:

1. Import novo: `import { BugReportModal } from "./BugReportModal";`
2. Prop nova na assinatura da função: `pageLabel: string` (junto de `clientId`/`accessKey`).
3. Estado novo: `const [bugModalOpen, setBugModalOpen] = useState(false);`
4. Dentro do bloco do dropdown (`{open && (...)}`), entre o link "Ajustes" e o bloco de Tema,
   adicionar:

```tsx
<button
  type="button"
  onClick={() => {
    setBugModalOpen(true);
    setOpen(false);
  }}
  className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
>
  Reportar bug
</button>
```

5. Logo após o `</div>` que fecha a `<div className="relative border-t border-border pt-3"
   ...>` (ou seja, como último item do `return`, fora do bloco condicional `{open && (...)}`
   — o modal precisa renderizar mesmo com o dropdown fechado), adicionar:

```tsx
{bugModalOpen && (
  <BugReportModal
    clientId={clientId}
    accessKey={accessKey}
    currentPageLabel={pageLabel}
    onClose={() => setBugModalOpen(false)}
  />
)}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 5: Lint dos arquivos tocados**

Run: `npx eslint src/components/AppFrame.tsx src/components/Sidebar.tsx src/components/AccountCard.tsx src/components/BugReportModal.tsx`
Expected: sem erros novos (avisos pré-existentes de `react-hooks/set-state-in-effect` em
outros componentes da branch não são regressão desta task).

- [ ] **Step 6: Build de produção**

Run: `npm run build`
Expected: build completa sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppFrame.tsx src/components/Sidebar.tsx src/components/AccountCard.tsx
git commit -m "feat(bug-report): integra modal no dropdown de conta (thread do pageLabel)"
```

- [ ] **Step 8: Deploy de preview e checagem visual**

Run: `vercel deploy`

Abrir qualquer página de cliente no preview (cliente de teste: `debora`, token
`e5bff4d1825a067cfab62539526e9a3c`), passar o mouse no card de conta, clicar em "Reportar bug",
e confirmar manualmente:
- Modal abre com o dropdown de página já pré-selecionado com a página atual.
- Preencher descrição, anexar 1-2 imagens (aparecem miniaturas com botão de remover), enviar.
- Tela de confirmação aparece com o ícone verde e o texto exato pedido.
- Tentar enviar sem descrição — botão "Enviar" deve ficar desabilitado.
- Fechar e reabrir o modal — formulário deve estar limpo.
- **Nota:** o bucket `bug-report-screenshots` no Supabase Storage precisa existir (público,
  criado manualmente no dashboard do Supabase, mesmo processo do `client-logos`) e a migration
  `0017_bug_reports.sql` precisa estar aplicada — sem isso o envio vai falhar com "Não foi
  possível enviar agora". Se der erro no teste, confirmar essas duas coisas antes de investigar
  o código.

---

## Self-Review

**Cobertura da spec:** as 4 seções da spec (`2026-08-05-bug-report-design.md`) têm task
correspondente — entry point + item de menu (Task 5), formulário (Task 4), confirmação
(Task 4), backend/banco (Tasks 1-3). Fora de escopo (painel admin, notificação automática,
rate limiting) confirmado como não implementado em nenhuma task.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo componente e rota tem código
completo.

**Consistência de tipos:** `page`/`description`/`screenshots` (nomes de campo do `FormData`)
são os mesmos entre `BugReportModal` (Task 4, quem monta o `FormData`) e a rota (Task 3, quem
lê o `FormData`) — conferido campo a campo. `createBugReport` tem a mesma assinatura entre
`bugReports.ts` (Task 2) e a chamada na rota (Task 3). `pageLabel: string` é o mesmo nome de
prop em `AppFrame` → `Sidebar` → `AccountCard` → `BugReportModal` (como `currentPageLabel`) —
conferido na Task 5.
