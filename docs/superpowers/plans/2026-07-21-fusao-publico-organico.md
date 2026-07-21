# Fusão "Público" → "Orgânico" + redesign chart-forward — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a aba "Público" como conceito de navegação, levar seu conteúdo pro final da aba "Orgânico", e trocar o visual de barras genéricas por gráficos de pizza (gênero, alcance por origem/tipo de conteúdo) e barras em ordem etária natural (idade), escondendo a coluna "Engajados" inteira (com 1 aviso único) quando a conta não tem engajamento suficiente no período.

**Architecture:** Puramente de apresentação — nenhuma mudança na busca de dado (`src/lib/meta.ts`, `src/lib/audience.ts`, rota `/api/audience/[client]`). Três componentes novos e focados (pizza genérica, barra de idade, lista geográfica) substituem o `DemographicCompare` genérico; `AudiencePanel` os compõe; `Dashboard.tsx` para de tratar audiência como aba própria.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Recharts (já usado no projeto — sem dependência nova).

## Global Constraints

- Sem framework de testes neste projeto. Verificação: `npx tsc --noEmit`, `npm run build`, e checagem visual no navegador (o controlador faz a parte visual pessoalmente, não os subagentes — ver nota abaixo).
- **Nota sobre ambiente:** subagentes anteriores nesta sessão tiveram falsos negativos ("unauthorized") ao subir `npm run dev` sozinhos, porque `.env.local` não carregava no processo deles. Subagentes NÃO devem subir servidor de dev nem tentar curl/verificação ao vivo — só `tsc`/`build`. O controlador faz a checagem visual depois, via seu próprio método já validado (Browser pane).
- Trabalhar na branch `staging`. Nunca commitar direto na `main`.
- Reaproveitar a paleta de marca já usada no projeto (`#7c3aed`, `#0080ff`, `#00c896`, `#ff5c4d`, `#8b5cf6`) — nenhuma cor nova.
- Reaproveitar o Recharts, já instalado — nenhuma dependência nova.
- `docs/superpowers/specs/2026-07-21-fusao-publico-organico-design.md` é a spec aprovada que rege este plano.

---

### Task 1: Componentes de visualização (pizza, barra de idade, lista geográfica) + bandeira de país

**Files:**
- Modify: `src/lib/countries.ts` (adicionar `countryFlag`)
- Create: `src/components/SlicePieChart.tsx`
- Create: `src/components/AgeBarChart.tsx`
- Create: `src/components/GeoRankList.tsx`

**Interfaces:**
- Consumes: `DemographicSlice` (`@/lib/audience`, já existe); `countryName` (já existe em `countries.ts`)
- Produces:
  - `countryFlag(code: string): string` — de `countries.ts`
  - `<SlicePieChart label={string} data={{name: string; value: number}[]} />` — de `SlicePieChart.tsx`
  - `<AgeBarChart label={string} slices={DemographicSlice[]} />` — de `AgeBarChart.tsx`
  - `<GeoRankList label={string} slices={DemographicSlice[]} showFlag?={boolean} />` — de `GeoRankList.tsx`

- [ ] **Step 1: Adicionar `countryFlag` em `countries.ts`**

No final de `src/lib/countries.ts`, depois da função `countryName` existente, adicionar:

```ts

// ponytail: bandeira via Regional Indicator Symbols (par de codepoints Unicode a partir do
// código ISO alpha-2) — não precisa de imagem nem lib externa.
export function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "";
  const codePoints = [...upper].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
```

- [ ] **Step 2: Criar `SlicePieChart.tsx`**

Criar `src/components/SlicePieChart.tsx`:

```tsx
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const PALETTE = ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6", "#c4b5fd"];

export function SlicePieChart({ label, data }: { label: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={22} outerRadius={44} paddingAngle={1}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-1.5 text-xs text-card-foreground">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-medium">{total === 0 ? 0 : Math.round((d.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `AgeBarChart.tsx`**

Criar `src/components/AgeBarChart.tsx`:

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { DemographicSlice } from "@/lib/audience";

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function sortByAge(slices: DemographicSlice[]): DemographicSlice[] {
  return AGE_ORDER.map((bracket) => slices.find((s) => s.key === bracket)).filter(
    (s): s is DemographicSlice => Boolean(s)
  );
}

export function AgeBarChart({ label, slices }: { label: string; slices: DemographicSlice[] }) {
  const data = sortByAge(slices);

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="key" fontSize={10} stroke="hsl(var(--muted-foreground))" />
            <YAxis hide />
            <Bar dataKey="pct" fill="hsl(var(--brand-primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar `GeoRankList.tsx`**

Criar `src/components/GeoRankList.tsx`:

```tsx
import type { DemographicSlice } from "@/lib/audience";
import { countryFlag } from "@/lib/countries";

export function GeoRankList({
  label,
  slices,
  showFlag,
}: {
  label: string;
  slices: DemographicSlice[];
  showFlag?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {showFlag && <span>{countryFlag(s.key)}</span>}
            <span className="flex-1 truncate text-card-foreground">{s.label}</span>
            <span className="font-medium text-muted-foreground">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && npx tsc --noEmit`
Expected: sem erros. Nenhum desses componentes é importado por nada ainda (isso acontece na Task 2), então essa é a verificação completa disponível nesse estágio.

- [ ] **Step 6: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/lib/countries.ts src/components/SlicePieChart.tsx src/components/AgeBarChart.tsx src/components/GeoRankList.tsx
git commit -m "Adiciona componentes de gráfico (pizza, barra de idade, lista geográfica) pro redesign chart-forward"
```

---

### Task 2: Recompor AudiencePanel, remover aba Público do Dashboard

**Files:**
- Modify: `src/components/AudiencePanel.tsx` (reescreve completamente o conteúdo interno)
- Modify: `src/components/Dashboard.tsx` (remove a aba "Público", sempre renderiza `AudiencePanel` dentro da aba Orgânico)
- Delete: `src/components/DemographicCompare.tsx` (substituído pelos componentes da Task 1)

**Interfaces:**
- Consumes: `SlicePieChart`, `AgeBarChart`, `GeoRankList` (Task 1); `AudienceTimeframeFilter`, `getAudienceSnapshot`, `AudienceSnapshot`, `AudienceTimeframeId` (já existiam); `ReachBreakdown` (já existia)
- Produces: `<AudiencePanel clientId accessKey reachBreakdown />` com a mesma assinatura pública de antes (nenhum consumidor externo muda)

- [ ] **Step 1: Reescrever `src/components/AudiencePanel.tsx`**

Substituir o conteúdo inteiro do arquivo por:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAudienceSnapshot, type AudienceSnapshot, type AudienceTimeframeId } from "@/lib/audience";
import type { ReachBreakdown } from "@/lib/metrics";
import { AudienceTimeframeFilter } from "./AudienceTimeframeFilter";
import { SlicePieChart } from "./SlicePieChart";
import { AgeBarChart } from "./AgeBarChart";
import { GeoRankList } from "./GeoRankList";

function AudienceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function TwoColumn({
  showEngaged,
  followers,
  engaged,
}: {
  showEngaged: boolean;
  followers: React.ReactNode;
  engaged: React.ReactNode;
}) {
  return (
    <div className={showEngaged ? "grid grid-cols-1 gap-6 sm:grid-cols-2" : ""}>
      {followers}
      {showEngaged && engaged}
    </div>
  );
}

function ReachBreakdownCard({ breakdown }: { breakdown: ReachBreakdown }) {
  const followData = [
    { name: "Seguidores", value: breakdown.byFollowType.follower },
    { name: "Não-seguidores", value: breakdown.byFollowType.nonFollower },
  ];
  const mediaData = [
    { name: "Posts", value: breakdown.byMediaType.post },
    { name: "Stories", value: breakdown.byMediaType.story },
    { name: "Reels", value: breakdown.byMediaType.reel },
    { name: "Anúncios", value: breakdown.byMediaType.ad },
  ];

  return (
    <AudienceCard title="Alcance por origem e tipo de conteúdo (período principal do dashboard)">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SlicePieChart label="Seguidor vs. não-seguidor" data={followData} />
        <SlicePieChart label="Tipo de conteúdo" data={mediaData} />
      </div>
    </AudienceCard>
  );
}

function hasAnyData(set: AudienceSnapshot["followers"]): boolean {
  return set.gender.length > 0 || set.age.length > 0 || set.country.length > 0 || set.city.length > 0;
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

  const engagedHasData = hasAnyData(snapshot.engaged);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Público</h2>
        <AudienceTimeframeFilter value={timeframe} onChange={setTimeframe} />
      </div>

      {!snapshot.hasEnoughData ? (
        <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Ainda não temos dados suficientes sobre esse público.</p>
        </div>
      ) : (
        <>
          {!engagedHasData && (
            <p className="text-xs text-muted-foreground">
              Ainda não temos engajamento suficiente no período pra mostrar a demografia de quem interagiu — só
              seguidores por enquanto.
            </p>
          )}

          <AudienceCard title="Gênero">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={
                <SlicePieChart
                  label="Seguidores"
                  data={snapshot.followers.gender.map((s) => ({ name: s.label, value: s.pct }))}
                />
              }
              engaged={
                <SlicePieChart
                  label="Engajados"
                  data={snapshot.engaged.gender.map((s) => ({ name: s.label, value: s.pct }))}
                />
              }
            />
          </AudienceCard>

          <AudienceCard title="Idade">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={<AgeBarChart label="Seguidores" slices={snapshot.followers.age} />}
              engaged={<AgeBarChart label="Engajados" slices={snapshot.engaged.age} />}
            />
          </AudienceCard>

          <AudienceCard title="Países">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={<GeoRankList label="Seguidores" slices={snapshot.followers.country} showFlag />}
              engaged={<GeoRankList label="Engajados" slices={snapshot.engaged.country} showFlag />}
            />
          </AudienceCard>

          <AudienceCard title="Cidades">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={<GeoRankList label="Seguidores" slices={snapshot.followers.city} />}
              engaged={<GeoRankList label="Engajados" slices={snapshot.engaged.city} />}
            />
          </AudienceCard>
        </>
      )}

      {reachBreakdown && <ReachBreakdownCard breakdown={reachBreakdown} />}
    </div>
  );
}
```

- [ ] **Step 2: Apagar `src/components/DemographicCompare.tsx`**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
rm src/components/DemographicCompare.tsx
```

- [ ] **Step 3: Remover a aba "Público" de `src/components/Dashboard.tsx`**

Trocar:

```ts
type Tab = "organic" | "ads" | "audience";
```

por:

```ts
type Tab = "organic" | "ads";
```

Trocar o array de abas de:

```tsx
          {([
            ["organic", "Orgânico"],
            ["ads", "Ads"],
            ["audience", "Público"],
          ] as const).map(([id, label]) => (
```

por:

```tsx
          {([
            ["organic", "Orgânico"],
            ["ads", "Ads"],
          ] as const).map(([id, label]) => (
```

Trocar o final do arquivo, de:

```tsx
          <TopVideosList posts={snapshot.topPosts} />
        </div>
      )}
      {tab === "ads" && <AdsPanel clientId={client.id} active={client.adsActive} />}
      {tab === "audience" && (
        <AudiencePanel clientId={client.id} accessKey={accessKey} reachBreakdown={snapshot.reachBreakdown} />
      )}
    </div>
  );
}
```

para:

```tsx
          <TopVideosList posts={snapshot.topPosts} />

          <AudiencePanel clientId={client.id} accessKey={accessKey} reachBreakdown={snapshot.reachBreakdown} />
        </div>
      )}
      {tab === "ads" && <AdsPanel clientId={client.id} active={client.adsActive} />}
    </div>
  );
}
```

(O import de `AudiencePanel` já existe no topo do arquivo — não precisa mudar.)

- [ ] **Step 4: Verificar tipos e build**

Run:
```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
npx tsc --noEmit
npm run build
```
Expected: ambos sem erro. Confirme que nenhum arquivo restante importa `DemographicCompare` (`grep -r "DemographicCompare" src/` deve retornar vazio).

- [ ] **Step 5: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add -A
git commit -m "Funde aba Público em Orgânico com redesign chart-forward (pizza, barra de idade, esconder Engajados vazio)"
git push
```

---

## Depois das duas tasks

O controlador (não um subagente) faz o deploy de preview e a checagem visual pessoalmente, testando com a Laís (`lais` / token `ecfc91088af28b32fb48d1dbcc46f626`) e confirmando: só 2 abas (Orgânico/Ads), seção de audiência aparece no final do Orgânico com pizza de gênero, barra de idade em ordem natural, listas de país (com bandeira) e cidade, coluna Engajados escondida com o aviso único, e os 2 gráficos de pizza no card de alcance por origem/tipo de conteúdo.
