# Aba "Público" (demografia de audiência) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma terceira aba "Público" ao dashboard de cada cliente, mostrando demografia de seguidores e engajados (gênero, idade, país, cidade) lado a lado, mais um breakdown de alcance por seguidor-vs-não-seguidor e por tipo de conteúdo.

**Architecture:** Segue exatamente o padrão já usado pelo fluxo "Orgânico" (metrics.ts = tipos + mock, meta.ts = fetch real da Graph API, rota `/api/audience/[client]` protegida pelo mesmo token, componente client-side que busca e reage). Sem framework de teste novo, sem dependência nova.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Instagram Graph API v25.0 (`follower_demographics`, `engaged_audience_demographics`, `reach` com breakdown).

## Global Constraints

- Este projeto não tem framework de testes (nunca teve, a sessão inteira usou `tsc`, `npm run build`, curl e o Browser pane pra verificar). Não introduzir Jest/Vitest agora — cada task abaixo verifica com esses mesmos meios.
- Toda rota nova usa `verifyClientToken` de `src/lib/access.ts`, igual à rota `/api/organic/[client]`.
- Trabalhar sempre na branch `staging` (já existe e está com `git checkout` feito). Nunca commitar direto na `main`.
- Depois de cada task: `npx tsc --noEmit` deve passar sem erro antes do commit.
- Não rodar `vercel --prod` nesse plano — só `vercel` (preview) quando o Victor pedir pra ver. Produção só depois de aprovação explícita.
- A API da Meta usa `breakdowns` (plural) para as métricas demográficas (`follower_demographics`/`engaged_audience_demographics`) e `breakdown` (singular) para `reach`/`views` — confirmado no exemplo oficial da documentação, não são o mesmo parâmetro. Não confundir os dois.

---

### Task 1: Camada de dados de audiência (tipos, dicionário de países, mock)

**Files:**
- Create: `src/lib/countries.ts`
- Create: `src/lib/audience.ts`

**Interfaces:**
- Consumes: nada (não depende de nenhuma task anterior)
- Produces:
  - `countryName(code: string): string` — de `countries.ts`
  - `genderLabel(code: string): string` — de `audience.ts`
  - `AUDIENCE_TIMEFRAMES: readonly {id, label}[]` e `AudienceTimeframeId` — de `audience.ts`
  - `DemographicSlice = {key: string; label: string; pct: number}` — de `audience.ts`
  - `DemographicSet = {gender, age, country, city: DemographicSlice[]}` — de `audience.ts`
  - `AudienceSnapshot = {followers: DemographicSet; engaged: DemographicSet; hasEnoughData: boolean}` — de `audience.ts`
  - `getAudienceSnapshot(clientId: string, timeframe: AudienceTimeframeId): AudienceSnapshot` — de `audience.ts`

- [ ] **Step 1: Criar o dicionário de países**

Criar `src/lib/countries.ts`:

```ts
// ponytail: tabela fixa, cobre os países mais prováveis de aparecer no público dos clientes.
// Fallback pro próprio código ISO se não estiver na lista — nunca quebra a UI.
export const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  PT: "Portugal",
  AR: "Argentina",
  MX: "México",
  CO: "Colômbia",
  CL: "Chile",
  PE: "Peru",
  UY: "Uruguai",
  PY: "Paraguai",
  BO: "Bolívia",
  EC: "Equador",
  VE: "Venezuela",
  ES: "Espanha",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  GB: "Reino Unido",
  CA: "Canadá",
  JP: "Japão",
  CN: "China",
  IN: "Índia",
  AU: "Austrália",
  NL: "Países Baixos",
  TR: "Turquia",
  RU: "Rússia",
  ZA: "África do Sul",
  AE: "Emirados Árabes Unidos",
  IE: "Irlanda",
  CH: "Suíça",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}
```

- [ ] **Step 2: Criar tipos, timeframes e o mock de audiência**

Criar `src/lib/audience.ts`:

```ts
import { countryName } from "./countries";

export const AUDIENCE_TIMEFRAMES = [
  { id: "this_week", label: "Esta semana" },
  { id: "this_month", label: "Este mês" },
  { id: "last_30_days", label: "Últimos 30 dias" },
  { id: "last_90_days", label: "Últimos 90 dias" },
] as const;

export type AudienceTimeframeId = (typeof AUDIENCE_TIMEFRAMES)[number]["id"];

export type DemographicSlice = { key: string; label: string; pct: number };

export type DemographicSet = {
  gender: DemographicSlice[];
  age: DemographicSlice[];
  country: DemographicSlice[];
  city: DemographicSlice[];
};

export type AudienceSnapshot = {
  followers: DemographicSet;
  engaged: DemographicSet;
  /** false quando a Meta não retornou dado suficiente (conta abaixo do mínimo de seguidores/engajamentos) */
  hasEnoughData: boolean;
};

const GENDER_LABELS: Record<string, string> = { F: "Feminino", M: "Masculino", U: "Não informado" };

export function genderLabel(code: string): string {
  return GENDER_LABELS[code.toUpperCase()] ?? code;
}

// ponytail: mock determinístico, mesmo padrão do getOrganicSnapshot em metrics.ts —
// cobre dev local e clientes sem instagramBusinessId, sem depender da Graph API.
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

function mockSet(seed: string): DemographicSet {
  const rand = seededRandom(seed);

  const femalePct = Math.round(50 + rand() * 30);
  const gender: DemographicSlice[] = [
    { key: "F", label: genderLabel("F"), pct: femalePct },
    { key: "M", label: genderLabel("M"), pct: 100 - femalePct },
  ];

  const ageBrackets = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const ageRaw = ageBrackets.map(() => rand());
  const ageSum = ageRaw.reduce((a, b) => a + b, 0);
  const age: DemographicSlice[] = ageBrackets.map((key, i) => ({
    key,
    label: key,
    pct: Math.round((ageRaw[i] / ageSum) * 100),
  }));

  const countries = ["BR", "US", "PT", "AR"];
  const countryRaw = countries.map((_, i) => rand() * (countries.length - i));
  const countrySum = countryRaw.reduce((a, b) => a + b, 0);
  const country: DemographicSlice[] = countries
    .map((code, i) => ({ key: code, label: countryName(code), pct: Math.round((countryRaw[i] / countrySum) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const cities = ["São Paulo", "Rio de Janeiro", "Orlando", "Miami", "Lisboa"];
  const cityRaw = cities.map((_, i) => rand() * (cities.length - i));
  const citySum = cityRaw.reduce((a, b) => a + b, 0);
  const city: DemographicSlice[] = cities
    .map((label, i) => ({ key: label, label, pct: Math.round((cityRaw[i] / citySum) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return { gender, age, country, city };
}

export function getAudienceSnapshot(clientId: string, timeframe: AudienceTimeframeId): AudienceSnapshot {
  return {
    followers: mockSet(`${clientId}-${timeframe}-followers`),
    engaged: mockSet(`${clientId}-${timeframe}-engaged`),
    hasEnoughData: true,
  };
}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros (os dois arquivos são novos e autocontidos, nada mais no projeto os importa ainda).

- [ ] **Step 4: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/countries.ts src/lib/audience.ts
git commit -m "Adiciona camada de dados de audiência (tipos, países, mock)"
```

---

### Task 2: Integração real com a Graph API (demografia + breakdown de alcance)

**Files:**
- Modify: `src/lib/metrics.ts` (adicionar `ReachBreakdown` e estender `OrganicSnapshot`, mais mock de `reachBreakdown` em `getOrganicSnapshot`)
- Modify: `src/lib/meta.ts` (novas funções `fetchAudienceSnapshotLive` e `fetchReachBreakdown`, mais wiring em `fetchOrganicSnapshotLive`)

**Interfaces:**
- Consumes: `AudienceTimeframeId`, `AudienceSnapshot`, `DemographicSlice` (Task 1); `countryName` (Task 1); `genderLabel` (Task 1); `safeGraphGet`, `graphGet`, `chunkWindows` (já existem em `meta.ts`)
- Produces:
  - `ReachBreakdown = {byFollowType: {follower, nonFollower, unknown}; byMediaType: {post, story, reel, ad}}` — de `metrics.ts`
  - `OrganicSnapshot.reachBreakdown?: ReachBreakdown` — campo novo, opcional
  - `fetchAudienceSnapshotLive(igId: string, timeframe: AudienceTimeframeId): Promise<AudienceSnapshot>` — de `meta.ts`
  - `fetchReachBreakdown(igId: string, since: number, until: number): Promise<ReachBreakdown>` — de `meta.ts`

- [ ] **Step 1: Adicionar `ReachBreakdown` e estender `OrganicSnapshot` em `metrics.ts`**

No arquivo `src/lib/metrics.ts`, logo depois da definição de `TopPost` (antes de `OrganicSnapshot`), adicionar:

```ts
export type ReachBreakdown = {
  byFollowType: { follower: number; nonFollower: number; unknown: number };
  byMediaType: { post: number; story: number; reel: number; ad: number };
};
```

E mudar a definição de `OrganicSnapshot` de:

```ts
export type OrganicSnapshot = {
  metrics: Record<OrganicMetricKey, number>;
  changePct: Record<OrganicMetricKey, number | null>;
  trend: { date: string; value: number }[];
  topPosts: TopPost[];
};
```

para:

```ts
export type OrganicSnapshot = {
  metrics: Record<OrganicMetricKey, number>;
  changePct: Record<OrganicMetricKey, number | null>;
  trend: { date: string; value: number }[];
  topPosts: TopPost[];
  reachBreakdown?: ReachBreakdown;
};
```

- [ ] **Step 2: Adicionar mock de `reachBreakdown` em `getOrganicSnapshot`**

Dentro de `getOrganicSnapshot` (mesmo arquivo `metrics.ts`), imediatamente antes do `return { metrics, changePct, trend, topPosts };` final, adicionar:

```ts
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
```

E trocar o `return` final para:

```ts
  return { metrics, changePct, trend, topPosts, reachBreakdown };
```

(`rand` já existe nesse escopo — é o mesmo `seededRandom` usado pra gerar `topPosts`.)

- [ ] **Step 3: Adicionar as novas importações no topo de `meta.ts`**

Trocar o bloco de import no topo de `src/lib/meta.ts` de:

```ts
import {
  DATE_RANGES,
  ORGANIC_METRICS,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
  type TopPost,
} from "./metrics";
```

para:

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
import { genderLabel, type AudienceSnapshot, type AudienceTimeframeId, type DemographicSlice } from "./audience";
import { countryName } from "./countries";
```

- [ ] **Step 4: Implementar `fetchDemographicBreakdown` e `fetchAudienceSnapshotLive`**

Adicionar em `src/lib/meta.ts`, depois da função `fetchTopVideos` e antes de `pctChange`:

```ts
type DemographicBreakdownName = "age" | "gender" | "city" | "country";

function labelFor(breakdown: DemographicBreakdownName, rawKey: string): string {
  if (breakdown === "country") return countryName(rawKey);
  if (breakdown === "gender") return genderLabel(rawKey);
  return rawKey; // age e city já vêm como texto legível da Meta
}

async function fetchDemographicBreakdown(
  igId: string,
  metric: "follower_demographics" | "engaged_audience_demographics",
  breakdown: DemographicBreakdownName,
  timeframe: AudienceTimeframeId
): Promise<DemographicSlice[]> {
  // ponytail: métricas demográficas usam "breakdowns" (plural) — diferente do "breakdown"
  // (singular) usado por reach/views. Confirmado no exemplo oficial da doc da Graph API.
  const res = await safeGraphGet(`${igId}/insights`, {
    metric,
    period: "lifetime",
    timeframe,
    breakdowns: breakdown,
    metric_type: "total_value",
  });

  const results: { dimension_values: string[]; value: number }[] =
    res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  const total = results.reduce((sum: number, r: { value: number }) => sum + r.value, 0);
  if (total === 0) return [];

  const limit = breakdown === "country" || breakdown === "city" ? 5 : results.length;
  return results
    .map((r) => {
      const rawKey = r.dimension_values[r.dimension_values.length - 1];
      return { key: rawKey, label: labelFor(breakdown, rawKey), pct: Math.round((r.value / total) * 100) };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

const DEMOGRAPHIC_BREAKDOWNS = ["age", "gender", "country", "city"] as const;

export async function fetchAudienceSnapshotLive(
  igId: string,
  timeframe: AudienceTimeframeId
): Promise<AudienceSnapshot> {
  await graphGet(igId, { fields: "id" });

  const [followersResults, engagedResults] = await Promise.all([
    Promise.all(DEMOGRAPHIC_BREAKDOWNS.map((b) => fetchDemographicBreakdown(igId, "follower_demographics", b, timeframe))),
    Promise.all(
      DEMOGRAPHIC_BREAKDOWNS.map((b) => fetchDemographicBreakdown(igId, "engaged_audience_demographics", b, timeframe))
    ),
  ]);

  const [followersAge, followersGender, followersCountry, followersCity] = followersResults;
  const [engagedAge, engagedGender, engagedCountry, engagedCity] = engagedResults;

  const hasEnoughData = [...followersResults, ...engagedResults].some((slice) => slice.length > 0);

  return {
    followers: { age: followersAge, gender: followersGender, country: followersCountry, city: followersCity },
    engaged: { age: engagedAge, gender: engagedGender, country: engagedCountry, city: engagedCity },
    hasEnoughData,
  };
}
```

- [ ] **Step 5: Implementar `fetchReachBreakdown`**

Adicionar logo depois de `fetchAudienceSnapshotLive`:

```ts
async function fetchReachBreakdownChunk(
  igId: string,
  since: number,
  until: number,
  breakdown: "follow_type" | "media_product_type"
): Promise<Record<string, number>> {
  const res = await safeGraphGet(`${igId}/insights`, {
    metric: "reach",
    period: "day",
    since: String(since),
    until: String(until),
    metric_type: "total_value",
    breakdown,
  });
  const results: { dimension_values: string[]; value: number }[] =
    res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  const totals: Record<string, number> = {};
  for (const r of results) {
    const key = r.dimension_values[r.dimension_values.length - 1];
    totals[key] = (totals[key] ?? 0) + r.value;
  }
  return totals;
}

export async function fetchReachBreakdown(igId: string, since: number, until: number): Promise<ReachBreakdown> {
  const windows = chunkWindows(since, until);
  const [followTypeChunks, mediaTypeChunks] = await Promise.all([
    Promise.all(windows.map(([s, u]) => fetchReachBreakdownChunk(igId, s, u, "follow_type"))),
    Promise.all(windows.map(([s, u]) => fetchReachBreakdownChunk(igId, s, u, "media_product_type"))),
  ]);

  const sumKey = (chunks: Record<string, number>[], key: string) =>
    chunks.reduce((sum, c) => sum + (c[key] ?? 0), 0);

  return {
    byFollowType: {
      follower: sumKey(followTypeChunks, "FOLLOWER"),
      nonFollower: sumKey(followTypeChunks, "NON_FOLLOWER"),
      unknown: sumKey(followTypeChunks, "UNKNOWN"),
    },
    byMediaType: {
      post: sumKey(mediaTypeChunks, "POST") + sumKey(mediaTypeChunks, "CAROUSEL_CONTAINER"),
      story: sumKey(mediaTypeChunks, "STORY"),
      reel: sumKey(mediaTypeChunks, "REEL") + sumKey(mediaTypeChunks, "REELS"),
      ad: sumKey(mediaTypeChunks, "AD"),
    },
  };
}
```

- [ ] **Step 6: Ligar `fetchReachBreakdown` dentro de `fetchOrganicSnapshotLive`**

Em `fetchOrganicSnapshotLive` (mesmo arquivo), trocar:

```ts
  const [current, previous, topPosts] = await Promise.all([
    fetchRange(igId, since, until),
    fetchRange(igId, prevSince, prevUntil),
    fetchTopVideos(igId, since, until),
  ]);
```

por:

```ts
  const [current, previous, topPosts, reachBreakdown] = await Promise.all([
    fetchRange(igId, since, until),
    fetchRange(igId, prevSince, prevUntil),
    fetchTopVideos(igId, since, until),
    fetchReachBreakdown(igId, since, until),
  ]);
```

E o `return` final da função, de:

```ts
  return { metrics, changePct, trend: current.trend, topPosts };
```

para:

```ts
  return { metrics, changePct, trend: current.trend, topPosts, reachBreakdown };
```

- [ ] **Step 7: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Verificar contra dado real (Laís)**

Isso exige a rota da Task 3 pra ser chamável por HTTP — pular a verificação funcional aqui e confirmar junto com a Task 3 (o build/tsc já garante que o código compila e os tipos batem).

- [ ] **Step 9: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/metrics.ts src/lib/meta.ts
git commit -m "Integra demografia e breakdown de alcance com a Graph API real"
```

---

### Task 3: Rota de API `/api/audience/[client]`

**Files:**
- Create: `src/app/api/audience/[client]/route.ts`

**Interfaces:**
- Consumes: `CLIENTS` (`@/lib/clients`), `getAudienceSnapshot`/`AUDIENCE_TIMEFRAMES`/`AudienceTimeframeId` (Task 1, `@/lib/audience`), `fetchAudienceSnapshotLive`/`hasMetaCredentials` (Task 2, `@/lib/meta`), `verifyClientToken` (`@/lib/access`, já existe)
- Produces: `GET /api/audience/{clientId}?timeframe=...&key=...` → JSON `AudienceSnapshot & {source: "live" | "mock"}`, ou `{error: string}` com status 400/401/404

- [ ] **Step 1: Criar a rota**

Criar `src/app/api/audience/[client]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { getAudienceSnapshot, AUDIENCE_TIMEFRAMES, type AudienceTimeframeId } from "@/lib/audience";
import { fetchAudienceSnapshotLive, hasMetaCredentials } from "@/lib/meta";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const timeframe = (request.nextUrl.searchParams.get("timeframe") ?? "last_30_days") as AudienceTimeframeId;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!AUDIENCE_TIMEFRAMES.some((t) => t.id === timeframe)) {
    return Response.json({ error: "invalid timeframe" }, { status: 400 });
  }

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (client.instagramBusinessId && hasMetaCredentials()) {
    try {
      const snapshot = await fetchAudienceSnapshotLive(client.instagramBusinessId, timeframe);
      return Response.json({ ...snapshot, source: "live" });
    } catch (err) {
      // ponytail: qualquer erro da Graph API cai pro mock — nunca quebra o dashboard do cliente.
      console.error(`[audience] live fetch falhou pra ${clientId}:`, err);
    }
  }

  return Response.json({ ...getAudienceSnapshot(clientId, timeframe), source: "mock" });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar local e testar sem token (deve bloquear)**

Run: `npm run dev` (em background) e depois:
```bash
curl -s "http://localhost:3001/api/audience/lais?timeframe=last_30_days"
```
Expected: `{"error":"unauthorized"}`

- [ ] **Step 4: Testar com o token real da Laís — dado ao vivo**

```bash
curl -s "http://localhost:3001/api/audience/lais?timeframe=last_30_days&key=ecfc91088af28b32fb48d1dbcc46f626"
```
Expected: JSON com `"source":"live"`, e `followers`/`engaged` com arrays de `gender`/`age`/`country`/`city` preenchidos (Laís tem seguidores/engajamento de sobra pra passar do mínimo de 100 da Meta).

- [ ] **Step 5: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/api/audience
git commit -m "Adiciona rota de API /api/audience/[client]"
```

---

### Task 4: Componentes de UI (filtro de período e comparação demográfica)

**Files:**
- Create: `src/components/AudienceTimeframeFilter.tsx`
- Create: `src/components/DemographicCompare.tsx`

**Interfaces:**
- Consumes: `AUDIENCE_TIMEFRAMES`/`AudienceTimeframeId` (Task 1), `DemographicSlice` (Task 1)
- Produces:
  - `<AudienceTimeframeFilter value={AudienceTimeframeId} onChange={(id: AudienceTimeframeId) => void} />`
  - `<DemographicCompare title={string} followers={DemographicSlice[]} engaged={DemographicSlice[]} />`

- [ ] **Step 1: Criar `AudienceTimeframeFilter.tsx`**

Criar `src/components/AudienceTimeframeFilter.tsx` (mesmo padrão visual de `src/components/DateRangeFilter.tsx`, trocando a fonte de opções):

```tsx
"use client";

import { useState } from "react";
import { AUDIENCE_TIMEFRAMES, type AudienceTimeframeId } from "@/lib/audience";

function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AudienceTimeframeFilter({
  value,
  onChange,
}: {
  value: AudienceTimeframeId;
  onChange: (id: AudienceTimeframeId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = AUDIENCE_TIMEFRAMES.find((t) => t.id === value)!;

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
          <button
            aria-label="Fechar filtro"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-soft)]">
            {AUDIENCE_TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  t.id === value ? "font-semibold text-brand-primary" : "text-card-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `DemographicCompare.tsx`**

Criar `src/components/DemographicCompare.tsx`:

```tsx
import type { DemographicSlice } from "@/lib/audience";

function Bars({ slices }: { slices: DemographicSlice[] }) {
  if (slices.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dado suficiente.</p>;
  }
  return (
    <div className="space-y-2">
      {slices.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{s.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-track">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
              style={{ width: `${Math.max(4, s.pct)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium text-card-foreground">{s.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function DemographicCompare({
  title,
  followers,
  engaged,
}: {
  title: string;
  followers: DemographicSlice[];
  engaged: DemographicSlice[];
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Seguidores</p>
          <Bars slices={followers} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Engajados</p>
          <Bars slices={engaged} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (esses componentes ainda não são importados por nada, então isso só confirma que compilam isoladamente).

- [ ] **Step 4: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/AudienceTimeframeFilter.tsx src/components/DemographicCompare.tsx
git commit -m "Adiciona componentes de filtro de período e comparação demográfica"
```

---

### Task 5: `AudiencePanel` + nova aba "Público" no Dashboard

**Files:**
- Create: `src/components/AudiencePanel.tsx`
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `AudienceTimeframeFilter`, `DemographicCompare` (Task 4); `getAudienceSnapshot`, `AudienceSnapshot`, `AudienceTimeframeId` (Task 1); `ReachBreakdown` (Task 2, `@/lib/metrics`); rota `/api/audience/[client]` (Task 3)
- Produces: `<AudiencePanel clientId={string} accessKey={string} reachBreakdown={ReachBreakdown | undefined} />`, e a aba "Público" visível e funcional no dashboard de cada cliente

- [ ] **Step 1: Criar `AudiencePanel.tsx`**

Criar `src/components/AudiencePanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAudienceSnapshot, type AudienceSnapshot, type AudienceTimeframeId } from "@/lib/audience";
import type { ReachBreakdown } from "@/lib/metrics";
import { AudienceTimeframeFilter } from "./AudienceTimeframeFilter";
import { DemographicCompare } from "./DemographicCompare";

function ReachBreakdownCard({ breakdown }: { breakdown: ReachBreakdown }) {
  const followTotal = breakdown.byFollowType.follower + breakdown.byFollowType.nonFollower + breakdown.byFollowType.unknown;
  const mediaTotal =
    breakdown.byMediaType.post + breakdown.byMediaType.story + breakdown.byMediaType.reel + breakdown.byMediaType.ad;
  const pct = (value: number, total: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Alcance por origem e tipo de conteúdo (período principal do dashboard)
      </h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Seguidor vs. não-seguidor
          </p>
          <p className="text-sm text-card-foreground">Seguidores: {pct(breakdown.byFollowType.follower, followTotal)}%</p>
          <p className="text-sm text-card-foreground">
            Não-seguidores: {pct(breakdown.byFollowType.nonFollower, followTotal)}%
          </p>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tipo de conteúdo</p>
          <p className="text-sm text-card-foreground">Posts: {pct(breakdown.byMediaType.post, mediaTotal)}%</p>
          <p className="text-sm text-card-foreground">Stories: {pct(breakdown.byMediaType.story, mediaTotal)}%</p>
          <p className="text-sm text-card-foreground">Reels: {pct(breakdown.byMediaType.reel, mediaTotal)}%</p>
          <p className="text-sm text-card-foreground">Anúncios: {pct(breakdown.byMediaType.ad, mediaTotal)}%</p>
        </div>
      </div>
    </div>
  );
}

export function AudiencePanel({
  clientId,
  accessKey,
  reachBreakdown,
}: {
  clientId: string;
  accessKey: string;
  reachBreakdown?: ReachBreakdown;
}) {
  const [timeframe, setTimeframe] = useState<AudienceTimeframeId>("last_30_days");
  const [snapshot, setSnapshot] = useState<AudienceSnapshot>(() => getAudienceSnapshot(clientId, timeframe));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/audience/${clientId}?timeframe=${timeframe}&key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: AudienceSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(getAudienceSnapshot(clientId, timeframe));
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, timeframe, accessKey]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AudienceTimeframeFilter value={timeframe} onChange={setTimeframe} />
      </div>

      {!snapshot.hasEnoughData ? (
        <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Ainda não temos dados suficientes sobre esse público.</p>
        </div>
      ) : (
        <>
          <DemographicCompare title="Gênero" followers={snapshot.followers.gender} engaged={snapshot.engaged.gender} />
          <DemographicCompare title="Idade" followers={snapshot.followers.age} engaged={snapshot.engaged.age} />
          <DemographicCompare title="Países" followers={snapshot.followers.country} engaged={snapshot.engaged.country} />
          <DemographicCompare title="Cidades" followers={snapshot.followers.city} engaged={snapshot.engaged.city} />
        </>
      )}

      {reachBreakdown && <ReachBreakdownCard breakdown={reachBreakdown} />}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar a aba "Público" em `Dashboard.tsx`**

Em `src/components/Dashboard.tsx`:

1. Adicionar o import (junto dos outros imports de componentes):

```ts
import { AudiencePanel } from "./AudiencePanel";
```

2. Trocar a linha do tipo `Tab`:

```ts
type Tab = "organic" | "ads";
```

por:

```ts
type Tab = "organic" | "ads" | "audience";
```

3. No array de abas dentro do `<nav>`, trocar:

```tsx
{([
  ["organic", "Orgânico"],
  ["ads", "Ads"],
] as const).map(([id, label]) => (
```

por:

```tsx
{([
  ["organic", "Orgânico"],
  ["ads", "Ads"],
  ["audience", "Público"],
] as const).map(([id, label]) => (
```

4. Trocar o bloco de renderização condicional das abas, de:

```tsx
      {tab === "organic" ? (
        <div className="space-y-6">
          {/* ...conteúdo orgânico existente... */}
        </div>
      ) : (
        <AdsPanel clientId={client.id} active={client.adsActive} />
      )}
```

para (mantendo o conteúdo orgânico existente igual, só trocando o formato do condicional pra caber a 3ª aba):

```tsx
      {tab === "organic" && (
        <div className="space-y-6">
          {/* ...conteúdo orgânico existente, sem nenhuma mudança... */}
        </div>
      )}
      {tab === "ads" && <AdsPanel clientId={client.id} active={client.adsActive} />}
      {tab === "audience" && (
        <AudiencePanel clientId={client.id} accessKey={accessKey} reachBreakdown={snapshot.reachBreakdown} />
      )}
```

- [ ] **Step 3: Verificar tipos e build**

Run:
```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
npx tsc --noEmit
npm run build
```
Expected: ambos sem erro.

- [ ] **Step 4: Deploy de preview e checagem visual**

```bash
vercel
```
Abrir a URL de preview retornada em `/lais?key=ecfc91088af28b32fb48d1dbcc46f626`, clicar na aba "Público", conferir:
- As 4 seções (Gênero, Idade, Países, Cidades) aparecem com barras Seguidores | Engajados lado a lado
- O card de "Alcance por origem e tipo de conteúdo" aparece embaixo
- O filtro de período da aba Público muda entre Esta semana/Este mês/Últimos 30/90 dias sem afetar o filtro da aba Orgânico
- Trocar o filtro do dashboard (aba Orgânico) e voltar pra "Público" — o card de alcance por origem deve refletir o novo período

- [ ] **Step 5: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/AudiencePanel.tsx src/components/Dashboard.tsx
git commit -m "Adiciona aba Público ao dashboard (demografia + breakdown de alcance)"
git push
```

---

## Depois de todas as tasks

Avisar o Victor que a branch `staging` está pronta pra ele ver no preview, e esperar aprovação antes de fazer merge pra `main` e rodar `vercel --prod`.
