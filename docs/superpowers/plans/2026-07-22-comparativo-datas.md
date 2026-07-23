# Comparativo de datas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma opção "Personalizado" ao filtro de período do dashboard que permite comparar 2 janelas de data lado a lado (números + linhas roxa/azul) na seção "Métricas", sem tocar na seção "Público" nem no relatório em PDF.

**Architecture:** Extrai um núcleo `fetchOrganicSnapshotForWindow`/`getOrganicWindowSnapshot` de since/until explícitos (tanto no fetch real quanto no mock), reaproveitado pelo caminho normal (preset) e pelo novo caminho de comparação. A rota `/api/organic/[client]` aceita `since`/`until` como alternativa a `range`. O `Dashboard` busca 2 janelas em paralelo quando em modo comparação e passa um prop `compare` adicional pros cards, sem alterar o caminho normal existente.

**Tech Stack:** Next.js 16 App Router, TypeScript, Recharts, Tailwind. Sem framework de testes no projeto — verificação por `npx tsc --noEmit`, `curl` direto contra as rotas, e checagem visual via Browser pane (mesmo padrão já usado nas features anteriores deste repositório).

## Global Constraints

- Branch: `plataforma-v2`. Não mesclar em `main`/`staging` — spec (`docs/superpowers/specs/2026-07-22-comparativo-datas-design.md`) exige aprovação explícita do Victor antes de qualquer merge.
- Seção "Público" (`AudiencePanel`) não é afetada por nenhuma task deste plano.
- Nenhuma API paga nova — reaproveita só a Meta Graph API já integrada.
- O caminho normal (preset de período fixo) não pode mudar de comportamento em nenhuma task — cada refatoração preserva o resultado atual byte a byte onde possível.
- Sem suíte de testes automatizada no projeto — cada task verifica com `npx tsc --noEmit` (obrigatório, todo task termina com isso passando) e um passo manual (curl ou Browser pane).

---

### Task 1: Camada de dados — janela explícita (since/until) no lugar de preset

**Files:**
- Modify: `src/lib/metrics.ts`
- Modify: `src/lib/meta.ts`
- Modify: `src/app/api/organic/[client]/route.ts`

**Interfaces:**
- Produces: `export type OrganicWindowSnapshot` (metrics/trend/viewsTrend/likesTrend/topPosts/reachBreakdown, sem `changePct`), `export function pctChange(current: number, previous: number): number | null`, `export function getOrganicWindowSnapshot(clientId: string, days: number): OrganicWindowSnapshot`, `export async function fetchOrganicSnapshotForWindow(igId: string, since: number, until: number): Promise<OrganicWindowSnapshot>`. A rota `/api/organic/[client]` passa a aceitar `?since=YYYY-MM-DD&until=YYYY-MM-DD` como alternativa a `?range=`.
- Consumes: nada (task base, sem dependência de outras tasks).

- [ ] **Step 1: Adicionar "Personalizado" ao `DATE_RANGES` e exportar `pctChange`**

Em `src/lib/metrics.ts`, troque:

```ts
export const DATE_RANGES = [
  { id: "1d", label: "Hoje", days: 1 },
  { id: "7d", label: "Últimos 7 dias", days: 7 },
  { id: "14d", label: "Últimos 14 dias", days: 14 },
  { id: "30d", label: "Últimos 30 dias", days: 30 },
  { id: "60d", label: "Últimos 60 dias", days: 60 },
  { id: "90d", label: "Últimos 90 dias", days: 90 },
] as const;
```

por:

```ts
export const DATE_RANGES = [
  { id: "1d", label: "Hoje", days: 1 },
  { id: "7d", label: "Últimos 7 dias", days: 7 },
  { id: "14d", label: "Últimos 14 dias", days: 14 },
  { id: "30d", label: "Últimos 30 dias", days: 30 },
  { id: "60d", label: "Últimos 60 dias", days: 60 },
  { id: "90d", label: "Últimos 90 dias", days: 90 },
  // ponytail: days:0 nunca é usado de verdade — "custom" sempre é resolvido via since/until
  // explícitos (ver fetchOrganicSnapshotForWindow), nunca por essa contagem de dias.
  { id: "custom", label: "Personalizado", days: 0 },
] as const;
```

- [ ] **Step 2: Dividir `OrganicSnapshot` em `OrganicWindowSnapshot` + `changePct`**

Em `src/lib/metrics.ts`, troque:

```ts
export type OrganicSnapshot = {
  metrics: Record<OrganicMetricKey, number>;
  /** variação % vs. período anterior de mesma duração; null quando não dá pra calcular (base 0) */
  changePct: Record<OrganicMetricKey, number | null>;
  trend: { date: string; value: number }[];
  viewsTrend: { date: string; value: number }[];
  likesTrend: { date: string; value: number }[];
  topPosts: TopPost[];
  reachBreakdown?: ReachBreakdown;
};
```

por:

```ts
export type OrganicWindowSnapshot = {
  metrics: Record<OrganicMetricKey, number>;
  trend: { date: string; value: number }[];
  viewsTrend: { date: string; value: number }[];
  likesTrend: { date: string; value: number }[];
  topPosts: TopPost[];
  reachBreakdown?: ReachBreakdown;
};

export type OrganicSnapshot = OrganicWindowSnapshot & {
  /** variação % vs. período anterior de mesma duração; null quando não dá pra calcular (base 0) */
  changePct: Record<OrganicMetricKey, number | null>;
};
```

- [ ] **Step 3: Exportar `pctChange` e refatorar o mock em núcleo + wrapper**

Em `src/lib/metrics.ts`, troque a função privada:

```ts
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
```

por (só adiciona `export`):

```ts
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
```

Em seguida, troque toda a função `getOrganicSnapshot` (da assinatura até o `return` final):

```ts
export function getOrganicSnapshot(clientId: string, range: DateRangeId): OrganicSnapshot {
  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const metrics = generateMetrics(`${clientId}-${range}`, days);
  const previous = generateMetrics(`${clientId}-${range}-prev`, days);
  const rand = seededRandom(`${clientId}-${range}-trend`);

  const changePct = Object.fromEntries(
    (Object.keys(metrics) as OrganicMetricKey[]).map((key) => [
      key,
      pctChange(metrics[key], previous[key]),
    ])
  ) as Record<OrganicMetricKey, number | null>;

  const points = Math.min(days, 30);
  const trend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.reach / points) * (0.6 + rand())),
  }));
  const viewsTrend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.views / points) * (0.6 + rand())),
  }));
  const likesTrend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.likes / points) * (0.6 + rand())),
  }));

  const mockTitles = [
    "Vídeo #1",
    "Publicação #2",
    "Reel #3",
    "Publicação #4",
    "Vídeo #5",
  ];
  const topPosts: TopPost[] = Array.from({ length: 5 }, (_, i) => ({
    id: `${clientId}-post-${i + 1}`,
    title: mockTitles[i],
    likes: Math.round((metrics.likes / 5) * (0.7 + rand())),
    thumbnailColor: ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6"][i],
  })).sort((a, b) => b.likes - a.likes);

  const followerShare = 0.55 + rand() * 0.2; // 55–75% do alcance vem de quem já segue
  const reachBreakdown: ReachBreakdown = {
    byFollowType: {
      follower: Math.round(metrics.reach * followerShare),
      nonFollower: Math.round(metrics.reach * (1 - followerShare) * 0.85),
      unknown: Math.round(metrics.reach * (1 - followerShare) * 0.15),
    },
    byMediaType: {
      post: Math.round(metrics.reach * 0.35),
      story: Math.round(metrics.reach * 0.3),
      reel: Math.round(metrics.reach * 0.3),
      ad: Math.round(metrics.reach * 0.05),
    },
  };

  return { metrics, changePct, trend, viewsTrend, likesTrend, topPosts, reachBreakdown };
}
```

por:

```ts
export function getOrganicWindowSnapshot(clientId: string, days: number): OrganicWindowSnapshot {
  const seed = `${clientId}-${days}d`;
  const metrics = generateMetrics(seed, days);
  const rand = seededRandom(`${seed}-trend`);

  const points = Math.min(days, 30);
  const trend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.reach / points) * (0.6 + rand())),
  }));
  const viewsTrend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.views / points) * (0.6 + rand())),
  }));
  const likesTrend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.likes / points) * (0.6 + rand())),
  }));

  const mockTitles = [
    "Vídeo #1",
    "Publicação #2",
    "Reel #3",
    "Publicação #4",
    "Vídeo #5",
  ];
  const topPosts: TopPost[] = Array.from({ length: 5 }, (_, i) => ({
    id: `${clientId}-post-${i + 1}`,
    title: mockTitles[i],
    likes: Math.round((metrics.likes / 5) * (0.7 + rand())),
    thumbnailColor: ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6"][i],
  })).sort((a, b) => b.likes - a.likes);

  const followerShare = 0.55 + rand() * 0.2; // 55–75% do alcance vem de quem já segue
  const reachBreakdown: ReachBreakdown = {
    byFollowType: {
      follower: Math.round(metrics.reach * followerShare),
      nonFollower: Math.round(metrics.reach * (1 - followerShare) * 0.85),
      unknown: Math.round(metrics.reach * (1 - followerShare) * 0.15),
    },
    byMediaType: {
      post: Math.round(metrics.reach * 0.35),
      story: Math.round(metrics.reach * 0.3),
      reel: Math.round(metrics.reach * 0.3),
      ad: Math.round(metrics.reach * 0.05),
    },
  };

  return { metrics, trend, viewsTrend, likesTrend, topPosts, reachBreakdown };
}

export function getOrganicSnapshot(clientId: string, range: DateRangeId): OrganicSnapshot {
  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const current = getOrganicWindowSnapshot(clientId, days);
  const previous = getOrganicWindowSnapshot(`${clientId}-prev`, days);

  const changePct = Object.fromEntries(
    (Object.keys(current.metrics) as OrganicMetricKey[]).map((key) => [
      key,
      pctChange(current.metrics[key], previous.metrics[key]),
    ])
  ) as Record<OrganicMetricKey, number | null>;

  return { ...current, changePct };
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros relacionados a `metrics.ts` (erros em `meta.ts`/rota ainda vão aparecer até os próximos steps — ok por enquanto).

- [ ] **Step 5: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/metrics.ts
git commit -m "Divide OrganicSnapshot em OrganicWindowSnapshot + changePct, exporta pctChange"
```

- [ ] **Step 6: Extrair núcleo `fetchOrganicSnapshotForWindow` em `meta.ts`**

Em `src/lib/meta.ts`, atualize o import de `./metrics` (topo do arquivo) de:

```ts
import {
  DATE_RANGES,
  ORGANIC_METRICS,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
  type ReachBreakdown,
  type TopPost,
} from "./metrics";
```

para:

```ts
import {
  DATE_RANGES,
  ORGANIC_METRICS,
  pctChange,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
  type OrganicWindowSnapshot,
  type ReachBreakdown,
  type TopPost,
} from "./metrics";
```

Troque a função:

```ts
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function fetchOrganicSnapshotLive(igId: string, range: DateRangeId): Promise<OrganicSnapshot> {
  // ponytail: checagem de acesso ANTES de tentar puxar métricas — sem isso, uma conta sem
  // permissão nenhuma retorna tudo zerado (cada chamada individual é resiliente e não lançaria
  // erro) em vez de cair pro mock no chamador. Essa chamada crua não é resiliente de propósito.
  await graphGet(igId, { fields: "id" });

  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;
  const prevUntil = since;
  const prevSince = since - days * 86400;

  const [current, previous, topPosts, reachBreakdown, viewsTrend, likesTrend] = await Promise.all([
    fetchRange(igId, since, until),
    fetchRange(igId, prevSince, prevUntil),
    fetchTopVideos(igId, since, until),
    fetchReachBreakdown(igId, since, until),
    fetchDailyMetricSeries(igId, "views", since, until),
    fetchDailyMetricSeries(igId, "likes", since, until),
  ]);

  const keys = Object.keys(ORGANIC_METRICS) as OrganicMetricKey[];
  const metrics = {} as Record<OrganicMetricKey, number>;
  const changePct = {} as Record<OrganicMetricKey, number | null>;
  for (const key of keys) {
    metrics[key] = current[key];
    changePct[key] = pctChange(current[key], previous[key]);
  }

  return { metrics, changePct, trend: current.trend, viewsTrend, likesTrend, topPosts, reachBreakdown };
}
```

por:

```ts
// ponytail: núcleo reaproveitado tanto pelo caminho normal (preset -> since/until calculado
// abaixo) quanto pelo modo comparação (since/until explícitos vindos da UI). Sem changePct aqui —
// isso só existe quando há um "período anterior" pra comparar, que é decidido por quem chama.
export async function fetchOrganicSnapshotForWindow(
  igId: string,
  since: number,
  until: number
): Promise<OrganicWindowSnapshot> {
  // ponytail: checagem de acesso ANTES de tentar puxar métricas — sem isso, uma conta sem
  // permissão nenhuma retorna tudo zerado (cada chamada individual é resiliente e não lançaria
  // erro) em vez de cair pro mock no chamador. Essa chamada crua não é resiliente de propósito.
  await graphGet(igId, { fields: "id" });

  const [current, topPosts, reachBreakdown, viewsTrend, likesTrend] = await Promise.all([
    fetchRange(igId, since, until),
    fetchTopVideos(igId, since, until),
    fetchReachBreakdown(igId, since, until),
    fetchDailyMetricSeries(igId, "views", since, until),
    fetchDailyMetricSeries(igId, "likes", since, until),
  ]);

  const keys = Object.keys(ORGANIC_METRICS) as OrganicMetricKey[];
  const metrics = {} as Record<OrganicMetricKey, number>;
  for (const key of keys) {
    metrics[key] = current[key];
  }

  return { metrics, trend: current.trend, viewsTrend, likesTrend, topPosts, reachBreakdown };
}

export async function fetchOrganicSnapshotLive(igId: string, range: DateRangeId): Promise<OrganicSnapshot> {
  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;
  const prevUntil = since;
  const prevSince = since - days * 86400;

  const [current, previous] = await Promise.all([
    fetchOrganicSnapshotForWindow(igId, since, until),
    fetchOrganicSnapshotForWindow(igId, prevSince, prevUntil),
  ]);

  const keys = Object.keys(ORGANIC_METRICS) as OrganicMetricKey[];
  const changePct = {} as Record<OrganicMetricKey, number | null>;
  for (const key of keys) {
    changePct[key] = pctChange(current.metrics[key], previous.metrics[key]);
  }

  return { ...current, changePct };
}
```

- [ ] **Step 7: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Verificação manual — caminho normal continua idêntico**

Run (precisa de `META_SYSTEM_USER_TOKEN` etc. carregados, mesmo padrão usado antes nesta sessão):

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
cat > /tmp/test-window-refactor.ts << 'EOF'
import { fetchOrganicSnapshotLive } from "./src/lib/meta";

async function main() {
  const snapshot = await fetchOrganicSnapshotLive("17841401799523851", "7d");
  console.log("reach:", snapshot.metrics.reach, "changePct.reach:", snapshot.changePct.reach);
  console.log("trend length:", snapshot.trend.length);
}

main();
EOF
set -a && source .env.local && set +a && npx tsx /tmp/test-window-refactor.ts
rm /tmp/test-window-refactor.ts
```

Expected: roda sem erro, imprime `reach`, `changePct.reach` e `trend length` com números plausíveis (não `undefined`/`NaN`) — confirma que a refatoração não quebrou o caminho normal.

- [ ] **Step 9: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/meta.ts
git commit -m "Extrai fetchOrganicSnapshotForWindow como núcleo de fetchOrganicSnapshotLive"
```

- [ ] **Step 10: Rota `/api/organic/[client]` aceita `since`/`until` explícitos**

Troque todo o conteúdo de `src/app/api/organic/[client]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { getOrganicSnapshot, getOrganicWindowSnapshot, DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { fetchOrganicSnapshotLive, fetchOrganicSnapshotForWindow, hasMetaCredentials } from "@/lib/meta";
import { verifyClientToken } from "@/lib/access";

function parseIsoDate(value: string): number | null {
  const ms = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const sinceParam = request.nextUrl.searchParams.get("since");
  const untilParam = request.nextUrl.searchParams.get("until");
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ponytail: janela custom (comparativo de datas) tem prioridade sobre "range" quando os dois
  // vierem preenchidos — since/until é sempre explícito, nunca um preset.
  if (sinceParam && untilParam) {
    const since = parseIsoDate(sinceParam);
    const until = parseIsoDate(untilParam);
    if (since === null || until === null || until <= since) {
      return Response.json({ error: "invalid since/until" }, { status: 400 });
    }

    if (client.instagramBusinessId && hasMetaCredentials()) {
      try {
        const snapshot = await fetchOrganicSnapshotForWindow(client.instagramBusinessId, since, until);
        return Response.json({ ...snapshot, source: "live" });
      } catch (err) {
        // ponytail: qualquer erro da Graph API cai pro mock — nunca quebra o dashboard do cliente.
        console.error(`[organic] live fetch (janela custom) falhou pra ${clientId}:`, err);
      }
    }

    const days = Math.round((until - since) / 86400);
    return Response.json({ ...getOrganicWindowSnapshot(clientId, days), source: "mock" });
  }

  const range = (request.nextUrl.searchParams.get("range") ?? "30d") as DateRangeId;
  if (range === "custom" || !DATE_RANGES.some((r) => r.id === range)) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  if (client.instagramBusinessId && hasMetaCredentials()) {
    try {
      const snapshot = await fetchOrganicSnapshotLive(client.instagramBusinessId, range);
      return Response.json({ ...snapshot, source: "live" });
    } catch (err) {
      // ponytail: qualquer erro da Graph API cai pro mock — nunca quebra o dashboard do cliente.
      console.error(`[organic] live fetch falhou pra ${clientId}:`, err);
    }
  }

  return Response.json({ ...getOrganicSnapshot(clientId, range), source: "mock" });
}
```

- [ ] **Step 11: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 12: Verificação manual — rota aceita since/until e continua aceitando range**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
npm run build
```

Expected: build passa sem erro (essa rota é server-side, não dá pra testar via `npx tsx` isolado sem contexto do Next — o build já valida sintaxe/tipos de rota; a verificação funcional fica pro Task 4 via Browser pane, quando o Dashboard já estiver chamando essa rota de verdade).

- [ ] **Step 13: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/api/organic/[client]/route.ts
git commit -m "Rota /api/organic aceita since/until explícitos além de range"
```

---

### Task 2: `CompareRangePicker` + "Personalizado" no `DateRangeFilter`

**Files:**
- Create: `src/components/CompareRangePicker.tsx`
- Modify: `src/components/DateRangeFilter.tsx`

**Interfaces:**
- Consumes: `DATE_RANGES` de `@/lib/metrics` (já inclui `"custom"` desde a Task 1).
- Produces: `export type CompareWindows = { a: {since:string; until:string}; b: {since:string; until:string} }`, `export function CompareRangePicker({ onApply }: { onApply: (w: CompareWindows) => void })`. `DateRangeFilter` ganha um prop novo `onApplyCompare: (windows: CompareWindows) => void` (obrigatório).

- [ ] **Step 1: Criar `CompareRangePicker`**

Crie `src/components/CompareRangePicker.tsx`:

```tsx
"use client";

import { useState } from "react";

export type CompareWindows = {
  a: { since: string; until: string };
  b: { since: string; until: string };
};

function daysBetween(since: string, until: string): number | null {
  if (!since || !until) return null;
  const ms = new Date(`${until}T00:00:00Z`).getTime() - new Date(`${since}T00:00:00Z`).getTime();
  const days = Math.round(ms / 86400000);
  return days > 0 ? days : null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CompareRangePicker({ onApply }: { onApply: (windows: CompareWindows) => void }) {
  const [aSince, setASince] = useState("");
  const [aUntil, setAUntil] = useState("");
  const [bSince, setBSince] = useState("");

  const daysA = daysBetween(aSince, aUntil);
  const bUntil = bSince && daysA ? addDays(bSince, daysA) : null;
  const valid = Boolean(daysA && bSince && bUntil);

  return (
    <div className="w-72 space-y-3 p-4">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Período A</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={aSince}
            onChange={(e) => setASince(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
          />
          <span className="shrink-0 text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={aUntil}
            onChange={(e) => setAUntil(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Período B</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={bSince}
            onChange={(e) => setBSince(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{bUntil ? `até ${bUntil}` : "até —"}</span>
        </div>
      </div>

      <button
        disabled={!valid}
        onClick={() => valid && onApply({ a: { since: aSince, until: aUntil }, b: { since: bSince, until: bUntil! } })}
        className="w-full rounded-lg bg-brand-primary py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros (componente ainda não é usado em lugar nenhum, mas deve compilar isolado).

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/CompareRangePicker.tsx
git commit -m "Adiciona CompareRangePicker (2 seletores de data, duração B travada em A)"
```

- [ ] **Step 4: Integrar no `DateRangeFilter`**

Troque todo o conteúdo de `src/components/DateRangeFilter.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { CompareRangePicker, type CompareWindows } from "./CompareRangePicker";

function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DateRangeFilter({
  value,
  onChange,
  onApplyCompare,
}: {
  value: DateRangeId;
  onChange: (id: DateRangeId) => void;
  onApplyCompare: (windows: CompareWindows) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "custom">("list");
  const current = DATE_RANGES.find((r) => r.id === value)!;

  function close() {
    setOpen(false);
    setView("list");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm shadow-[var(--shadow-soft)]"
      >
        <span className="text-muted-foreground">Período:</span>
        <span className="font-semibold text-card-foreground">{current.label}</span>
        <ChevronIcon />
      </button>

      {open && (
        <>
          <button aria-label="Fechar filtro" className="fixed inset-0 z-40 cursor-default" onClick={close} />
          <div className="absolute right-0 z-50 mt-1.5 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-soft)]">
            {view === "custom" ? (
              <CompareRangePicker
                onApply={(windows) => {
                  onApplyCompare(windows);
                  close();
                }}
              />
            ) : (
              <div className="w-48 py-1">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (r.id === "custom") {
                        setView("custom");
                        return;
                      }
                      onChange(r.id);
                      close();
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      r.id === value ? "font-semibold text-brand-primary" : "text-card-foreground hover:bg-muted"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: erro esperado em `src/components/Dashboard.tsx` (`onApplyCompare` faltando no uso atual de `<DateRangeFilter>`) — é o único erro aceitável neste ponto, corrigido na Task 4. Nenhum outro erro deve aparecer.

- [ ] **Step 6: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/DateRangeFilter.tsx
git commit -m "DateRangeFilter: adiciona 'Personalizado' e abre CompareRangePicker"
```

---

### Task 3: `MetricCard` — modo comparação (2 valores, 2 linhas)

**Files:**
- Modify: `src/components/MetricCard.tsx`

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `MetricCard` ganha prop opcional `compare?: { valueB: string; deltaPct: number | null; sparklineB?: {value:number}[] }`. Consumido pela Task 4.

- [ ] **Step 1: Reescrever `MetricCard.tsx`**

Troque todo o conteúdo de `src/components/MetricCard.tsx`:

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { InfoTooltip } from "./InfoTooltip";

function Sparkline({ data, dataB }: { data: { value: number }[]; dataB?: { value: number }[] }) {
  if (!dataB) {
    return (
      <ResponsiveContainer width="100%" height={32}>
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="value" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ponytail: as 2 séries sempre têm o mesmo tamanho aqui — CompareRangePicker força Período B
  // a ter a mesma duração de A, então alinhar por índice (i) é seguro.
  const merged = data.map((d, i) => ({ a: d.value, b: dataB[i]?.value ?? null }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={merged} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey="a" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="b" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-medium text-muted-foreground">novo</span>;
  }
  const isUp = pct >= 0;
  return (
    <span className={`text-xs font-medium tabular-nums ${isUp ? "text-brand-success" : "text-brand-danger"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  label,
  description,
  value,
  changePct,
  sparkline,
  compare,
}: {
  label: string;
  description: string;
  value: string;
  changePct?: number | null;
  sparkline?: { value: number }[];
  compare?: { valueB: string; deltaPct: number | null; sparklineB?: { value: number }[] };
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        <InfoTooltip text={description} />
      </div>

      {compare ? (
        <>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-lg font-semibold text-card-foreground">{value}</p>
            <span className="text-xs text-muted-foreground">vs.</span>
            <p className="text-lg font-semibold text-card-foreground">{compare.valueB}</p>
            <ChangeBadge pct={compare.deltaPct} />
          </div>
          {sparkline && (
            <div className="mt-2">
              <Sparkline data={sparkline} dataB={compare.sparklineB} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-card-foreground">{value}</p>
            {changePct !== undefined && <ChangeBadge pct={changePct} />}
          </div>
          {sparkline && (
            <div className="mt-2">
              <Sparkline data={sparkline} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: mesmo único erro esperado da Task 2 (Step 5), nenhum erro novo relacionado a `MetricCard`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/MetricCard.tsx
git commit -m "MetricCard: modo comparação com 2 valores e 2 linhas no sparkline"
```

---

### Task 4: `ReachBarChart` em modo comparação + integração completa no `Dashboard`

**Files:**
- Modify: `src/components/ReachBarChart.tsx`
- Modify: `src/components/ExportPdfButton.tsx`
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `OrganicWindowSnapshot`, `pctChange`, `getOrganicSnapshot` de `@/lib/metrics` (Task 1); `CompareWindows` de `./CompareRangePicker` (Task 2); `compare` prop do `MetricCard` (Task 3); `onApplyCompare` prop do `DateRangeFilter` (Task 2).
- Produces: `Dashboard` funcional ponta a ponta com modo comparação.

- [ ] **Step 1: `ReachBarChart` ganha modo comparação**

Troque todo o conteúdo de `src/components/ReachBarChart.tsx`:

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function ReachBarChart({
  data,
  dataB,
}: {
  data: { date: string; value: number }[];
  dataB?: { date: string; value: number }[];
}) {
  if (dataB) {
    // ponytail: mesma garantia de tamanho igual do MetricCard — CompareRangePicker força A e B
    // a terem a mesma duração.
    const merged = data.map((d, i) => ({ date: d.date, a: d.value, b: dataB[i]?.value ?? null }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="a" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="b" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="group relative flex flex-1 justify-center">
            <div className="relative h-full w-full max-w-3 rounded-full bg-brand-track">
              <div
                className="absolute bottom-0 w-full rounded-full bg-brand-accent transition-all"
                style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              />
            </div>
            <div className="pointer-events-none absolute bottom-full mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background group-hover:block">
              {d.value.toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground">
            {i % Math.ceil(data.length / 8 || 1) === 0 ? d.date : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ExportPdfButton` ganha `disabled`**

Em `src/components/ExportPdfButton.tsx`, adicione o import do `InfoTooltip` logo abaixo do import de `useState`:

```tsx
"use client";

import { useState } from "react";
import { InfoTooltip } from "./InfoTooltip";
```

Troque a assinatura da função e o início do corpo:

```tsx
export function ExportPdfButton({
  clientId,
  range,
  accessKey,
}: {
  clientId: string;
  range: string;
  accessKey: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    if (downloading) return;
```

por:

```tsx
export function ExportPdfButton({
  clientId,
  range,
  accessKey,
  disabled,
}: {
  clientId: string;
  range: string;
  accessKey: string;
  disabled?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    if (downloading || disabled) return;
```

Troque o `return` final (o `<button>...</button>`):

```tsx
  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-[var(--shadow-soft)] hover:bg-muted disabled:cursor-wait"
    >
      {downloading ? <SpinnerIcon /> : <DownloadIcon />}
      {downloading ? "Baixando..." : "Baixar relatório"}
    </button>
  );
}
```

por:

```tsx
  if (disabled) {
    return (
      <span className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-60 shadow-[var(--shadow-soft)]">
        <DownloadIcon />
        Baixar relatório
        <InfoTooltip text="O relatório em PDF não funciona no modo de comparação de datas. Volte pra um período único pra baixar." />
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-[var(--shadow-soft)] hover:bg-muted disabled:cursor-wait"
    >
      {downloading ? <SpinnerIcon /> : <DownloadIcon />}
      {downloading ? "Baixando..." : "Baixar relatório"}
    </button>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: mesmo único erro pendente em `Dashboard.tsx` (`onApplyCompare` faltando), nada novo.

- [ ] **Step 4: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/ReachBarChart.tsx src/components/ExportPdfButton.tsx
git commit -m "ReachBarChart ganha modo 2 linhas; ExportPdfButton ganha estado disabled"
```

- [ ] **Step 5: Reescrever `Dashboard.tsx` com o modo comparação completo**

Troque todo o conteúdo de `src/components/Dashboard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/lib/clients";
import {
  ORGANIC_METRICS,
  getOrganicSnapshot,
  pctChange,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
  type OrganicWindowSnapshot,
} from "@/lib/metrics";
import { DateRangeFilter } from "./DateRangeFilter";
import type { CompareWindows } from "./CompareRangePicker";
import { MetricCard } from "./MetricCard";
import { ReachBarChart } from "./ReachBarChart";
import { TopVideosList } from "./TopVideosList";
import { AdsPanel } from "./AdsPanel";
import { ExportPdfButton } from "./ExportPdfButton";
import { Logo } from "./Logo";
import { AudiencePanel } from "./AudiencePanel";

type Tab = "organic" | "ads";

export function Dashboard({ client, accessKey }: { client: Client; accessKey: string }) {
  const [range, setRange] = useState<DateRangeId>("30d");
  const [tab, setTab] = useState<Tab>("organic");
  // ponytail: mock síncrono cobre o 1º render; o fetch troca por dado real (ou mock do servidor) assim que chega.
  const [snapshot, setSnapshot] = useState<OrganicSnapshot>(() => getOrganicSnapshot(client.id, range));
  const [snapshotKey, setSnapshotKey] = useState(`${client.id}:${range}`);
  const loading = snapshotKey !== `${client.id}:${range}`;

  const [compareWindows, setCompareWindows] = useState<CompareWindows | null>(null);
  const [compareSnapshots, setCompareSnapshots] = useState<{ a: OrganicWindowSnapshot; b: OrganicWindowSnapshot } | null>(
    null
  );

  useEffect(() => {
    if (compareWindows) return; // modo comparação usa o efeito abaixo
    let cancelled = false;
    const key = `${client.id}:${range}`;
    fetch(`/api/organic/${client.id}?range=${range}&key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: OrganicSnapshot) => {
        if (cancelled) return;
        setSnapshot(data);
        setSnapshotKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot(getOrganicSnapshot(client.id, range));
        setSnapshotKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [client.id, range, accessKey, compareWindows]);

  useEffect(() => {
    if (!compareWindows) {
      setCompareSnapshots(null);
      return;
    }
    let cancelled = false;
    const fetchWindow = (w: { since: string; until: string }) =>
      fetch(`/api/organic/${client.id}?since=${w.since}&until=${w.until}&key=${encodeURIComponent(accessKey)}`).then(
        (res) => res.json()
      );
    Promise.all([fetchWindow(compareWindows.a), fetchWindow(compareWindows.b)]).then(
      ([a, b]: [OrganicWindowSnapshot, OrganicWindowSnapshot]) => {
        if (!cancelled) setCompareSnapshots({ a, b });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [client.id, compareWindows, accessKey]);

  function handleRangeChange(id: DateRangeId) {
    setRange(id);
    if (id !== "custom") setCompareWindows(null);
  }

  function handleApplyCompare(windows: CompareWindows) {
    setRange("custom");
    setCompareWindows(windows);
  }

  const comparing = compareWindows !== null && compareSnapshots !== null;
  const m = comparing ? compareSnapshots!.a.metrics : snapshot.metrics;
  const c = snapshot.changePct;

  function compareProp(key: OrganicMetricKey, sparklineKey?: "trend" | "viewsTrend" | "likesTrend") {
    if (!comparing) return undefined;
    const { a, b } = compareSnapshots!;
    return {
      valueB: b.metrics[key].toLocaleString("pt-BR"),
      deltaPct: pctChange(a.metrics[key], b.metrics[key]),
      sparklineB: sparklineKey ? b[sparklineKey] : undefined,
    };
  }

  const activeTrend = comparing ? compareSnapshots!.a.trend : snapshot.trend;
  const activeTopPosts = comparing ? compareSnapshots!.a.topPosts : snapshot.topPosts;
  const activeReachBreakdown = comparing ? compareSnapshots!.a.reachBreakdown : snapshot.reachBreakdown;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Logo />
          <h1 className="mt-2 text-2xl font-bold text-foreground">{client.name}</h1>
        </div>
        <ExportPdfButton clientId={client.id} range={range} accessKey={accessKey} disabled={compareWindows !== null} />
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex w-fit gap-1 rounded-xl bg-card p-1 shadow-[var(--shadow-soft)]">
          {([
            ["organic", "Orgânico"],
            ["ads", "Ads"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === id ? "bg-brand-primary text-white" : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "organic" && (
          <div className="flex items-center gap-2">
            {!compareWindows && loading && <span className="text-xs text-muted-foreground">Atualizando…</span>}
            {compareWindows && !compareSnapshots && <span className="text-xs text-muted-foreground">Comparando…</span>}
            <DateRangeFilter value={range} onChange={handleRangeChange} onApplyCompare={handleApplyCompare} />
          </div>
        )}
      </div>

      {tab === "organic" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr]">
            <MetricCard
              label={ORGANIC_METRICS.newFollowers.label}
              description={ORGANIC_METRICS.newFollowers.description}
              value={m.newFollowers.toLocaleString("pt-BR")}
              compare={compareProp("newFollowers")}
            />
            <MetricCard
              label={ORGANIC_METRICS.lostFollowers.label}
              description={ORGANIC_METRICS.lostFollowers.description}
              value={m.lostFollowers.toLocaleString("pt-BR")}
              compare={compareProp("lostFollowers")}
            />
            <MetricCard
              label={ORGANIC_METRICS.netFollowers.label}
              description={ORGANIC_METRICS.netFollowers.description}
              value={m.netFollowers.toLocaleString("pt-BR")}
              compare={compareProp("netFollowers")}
            />

            <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] lg:row-span-2">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">Alcance</h3>
              <div className="h-56">
                <ReachBarChart data={activeTrend} dataB={comparing ? compareSnapshots!.b.trend : undefined} />
              </div>
            </div>

            <MetricCard
              label={ORGANIC_METRICS.reach.label}
              description={ORGANIC_METRICS.reach.description}
              value={m.reach.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.reach}
              sparkline={activeTrend}
              compare={compareProp("reach", "trend")}
            />
            <MetricCard
              label={ORGANIC_METRICS.views.label}
              description={ORGANIC_METRICS.views.description}
              value={m.views.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.views}
              sparkline={comparing ? compareSnapshots!.a.viewsTrend : snapshot.viewsTrend}
              compare={compareProp("views", "viewsTrend")}
            />
            <MetricCard
              label={ORGANIC_METRICS.likes.label}
              description={ORGANIC_METRICS.likes.description}
              value={m.likes.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.likes}
              sparkline={comparing ? compareSnapshots!.a.likesTrend : snapshot.likesTrend}
              compare={compareProp("likes", "likesTrend")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricCard
              label={ORGANIC_METRICS.comments.label}
              description={ORGANIC_METRICS.comments.description}
              value={m.comments.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.comments}
              compare={compareProp("comments")}
            />
            <MetricCard
              label={ORGANIC_METRICS.saves.label}
              description={ORGANIC_METRICS.saves.description}
              value={m.saves.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.saves}
              compare={compareProp("saves")}
            />
            <MetricCard
              label={ORGANIC_METRICS.shares.label}
              description={ORGANIC_METRICS.shares.description}
              value={m.shares.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.shares}
              compare={compareProp("shares")}
            />
          </div>

          <TopVideosList posts={activeTopPosts} />

          <AudiencePanel clientId={client.id} accessKey={accessKey} reachBreakdown={activeReachBreakdown} />
        </div>
      )}
      {tab === "ads" && <AdsPanel clientId={client.id} active={client.adsActive} />}
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem nenhum erro (é o momento em que o erro pendente das tasks anteriores desaparece).

- [ ] **Step 7: Build de produção**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npm run build`
Expected: build completo sem erro.

- [ ] **Step 8: Verificação visual via Browser pane**

1. `preview_start` com `{name: "dashboard-dev"}` (config já existe em `.claude/launch.json`).
2. Navegar pra um cliente com token válido: `http://localhost:3000/lais?key=ecfc91088af28b32fb48d1dbcc46f626` (token confirmado válido nesta sessão).
3. Confirmar que o dashboard carrega normal (modo preset, sem regressão) — cards com 1 valor, Alcance com barras, PDF habilitado.
4. Abrir o filtro de período, clicar "Personalizado", preencher Período A (ex: hoje - 7 dias até hoje) e o início do Período B (ex: hoje - 14 dias) — conferir que o "até" do Período B calcula sozinho.
5. Clicar "Aplicar" e confirmar: cards mostram "valor A vs. valor B + %", Alcance/Views/Curtidas viram 2 linhas (roxa/azul), Top 5 posts e as pizzas de "Público" continuam mostrando só o Período A, botão de PDF fica desabilitado com tooltip.
6. Reabrir o filtro, escolher "Últimos 30 dias" — confirmar que volta pro modo normal (1 valor, PDF habilitado de novo).

Expected: tudo acima se comporta como descrito, sem erros no console (`read_console_messages`).

- [ ] **Step 9: Commit final**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/Dashboard.tsx
git commit -m "Dashboard: integra modo comparação de datas ponta a ponta"
```

---

## Self-Review (feito pelo autor do plano, não delegado)

1. **Cobertura da spec**: entrada UX (Task 2), 2 valores lado a lado (Task 3/4), duração igual forçada (Task 2 — `CompareRangePicker`), alinhamento por índice (Task 3/4 — `Sparkline`/`ReachBarChart` usam `data.map((d,i) => ...dataB[i])`), Top 5/pizzas só Período A (Task 4 — `activeTopPosts`/`activeReachBreakdown` sempre vêm de `compareSnapshots.a`), PDF desabilitado (Task 4 — `ExportPdfButton disabled`). Todos os itens da spec têm task correspondente.
2. **Placeholders**: nenhum "TBD"/"implementar depois" — todo step tem código completo.
3. **Consistência de tipos**: `OrganicWindowSnapshot` (Task 1) é o mesmo tipo usado em `compareSnapshots` (Task 4) e retornado por `fetchOrganicSnapshotForWindow`/`getOrganicWindowSnapshot`; `CompareWindows` (Task 2) é o mesmo tipo usado em `onApplyCompare`/`handleApplyCompare` (Task 4); `compare` prop do `MetricCard` (Task 3) bate exatamente com o retorno de `compareProp` (Task 4) — mesmos nomes de campo (`valueB`, `deltaPct`, `sparklineB`).
