# Aba "Público" — demografia da audiência (Instagram Graph API)

## Contexto

Victor quer trazer o máximo possível de dado demográfico da Meta pro dashboard: localização (cidade/país), gênero, idade, e como seguidores vs. não-seguidores interagem com posts/stories/reels. Antes de desenhar qualquer coisa, pesquisei a documentação oficial atualizada da Instagram Graph API (v25.0, atualizada em 16/jun/2026) pra confirmar o que é tecnicamente possível com as permissões que já temos (`instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`) — nenhuma permissão nova ou App Review é necessária.

**O que a Meta expõe e vamos usar:**
- `follower_demographics` — idade, cidade, país, gênero dos **seguidores**
- `engaged_audience_demographics` — mesma coisa, mas de quem **engajou** (curtiu/comentou/salvou) no período
- `reach` com `breakdown=follow_type` — alcance separado por seguidor vs. não-seguidor
- `reach` com `breakdown=media_product_type` — alcance separado por post/story/reel/anúncio

**O que a Meta NÃO expõe** (importante não prometer): etnia/raça não existe como dimensão. Localização para em cidade/país.

**Limitação técnica que molda o design:** as métricas de demografia (`follower_demographics`, `engaged_audience_demographics`) usam `period=lifetime` + `timeframe` fixo — não aceitam `since`/`until` livres como o resto do dashboard. Os únicos valores de `timeframe` válidos a partir da v20 são: `this_week`, `this_month`, `last_30_days`, `last_90_days`. Também só retornam dado se a conta tiver 100+ seguidores (pra `follower_demographics`) ou 100+ engajamentos no período (pra `engaged_audience_demographics`) — todos os 6 clientes atuais (Débora, Laís, Sam, Nelson, Tiago, Bela) já passam desse mínimo.

Já o `reach` com `breakdown=follow_type`/`media_product_type` usa `period=day` + `since`/`until`, igual às métricas que já buscamos hoje — encaixa no mesmo mecanismo de chunking em janelas de até 30 dias que `fetchRange`/`fetchChunk` já implementam em `src/lib/meta.ts`.

Decisões fechadas com o Victor (incluindo 2 rodadas de mockup visual aprovadas):
- Fica em uma aba nova, "Público", com filtro de período **próprio** (Esta semana / Este mês / Últimos 30 dias / Últimos 90 dias), independente do filtro do resto do dashboard.
- Mostra demografia dos **dois públicos**: Seguidores e Engajados, **lado a lado** (2 colunas, não um toggle) em cada métrica.
- O breakdown de alcance por seguidor-vs-não-seguidor e por tipo de conteúdo entra na mesma leva, mas usa o filtro de período **principal** do dashboard (o de sempre), porque tecnicamente é a mesma métrica de alcance que já buscamos, só que quebrada em subconjuntos.

## Arquitetura

### Tipos e dados (`src/lib/audience.ts`, novo arquivo)

```ts
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
```

Cada `DemographicSlice[]` vem ordenado do maior pro menor `pct`, limitado a um top N razoável pra exibição (top 5 países/cidades; todas as faixas etárias e gêneros, que já são poucas).

### Mapeamento de país (`src/lib/countries.ts`, novo arquivo)

Dicionário estático `Record<string, string>` (código ISO alpha-2 → nome em português) cobrindo os países mais comuns (Brasil e vizinhos, EUA, Europa principal, etc.), com fallback pro próprio código se não encontrado. Não precisa de lib externa — é só uma tabela fixa.

### `src/lib/meta.ts` — novas funções

- `fetchDemographicBreakdown(igId, metric, breakdown, timeframe)`: uma chamada a `{igId}/insights?metric={metric}&period=lifetime&timeframe={timeframe}&breakdown={breakdown}&metric_type=total_value`, usando `safeGraphGet` (já existe, tolera falha sem quebrar o resto). Converte `total_value.breakdowns[0].results` em `DemographicSlice[]`, calculando `pct` como `valor / soma_total`. Se a resposta vier vazia (conta abaixo do mínimo), retorna array vazio.
- `fetchAudienceSnapshot(igId, timeframe)`: dispara as 8 combinações (2 métricas × 4 breakdowns: age/gender/country/city) em paralelo via `Promise.all`, monta o `AudienceSnapshot`. `hasEnoughData` fica `false` se todas as 8 chamadas voltarem vazias (sinal de que a conta está abaixo do mínimo da Meta).
- `fetchReachBreakdown(igId, since, until)`: reaproveita o `chunkWindows` que já existe, buscando `reach` com `breakdown=follow_type` e `breakdown=media_product_type` por chunk, somando os resultados. Retorna `{ byFollowType: {follower, nonFollower, unknown}, byMediaType: {post, story, reel, ad} }`.

### Extensão do que já existe

`OrganicSnapshot` (em `src/lib/metrics.ts`) ganha um campo opcional `reachBreakdown?: ReachBreakdown`. `fetchOrganicSnapshotLive` (em `meta.ts`) passa a chamar `fetchReachBreakdown` junto com o `fetchRange` que já existe, no mesmo `Promise.all`. Isso evita uma rota nova só pra esse pedaço — o breakdown de alcance chega de graça na mesma resposta que o dashboard já busca.

### Rota nova

`src/app/api/audience/[client]/route.ts` — espelha exatamente o padrão de `api/organic/[client]/route.ts`: valida `timeframe` contra `AUDIENCE_TIMEFRAMES`, valida cliente, valida token via `verifyClientToken` (já existe), chama `fetchAudienceSnapshot` se `client.instagramBusinessId && hasMetaCredentials()`, com fallback pra um `AudienceSnapshot` mock determinístico (mesma filosofia do `getOrganicSnapshot` mock atual) se der erro ou não tiver credencial.

## Componentes de UI

- **Nova aba "Público"** no `Dashboard.tsx`, ao lado de Orgânico/Ads.
- `src/components/AudiencePanel.tsx`: busca `/api/audience/{clientId}?timeframe=...&key=...` num `useEffect` próprio (mesmo padrão do fetch em `Dashboard.tsx`), mantém seu próprio estado de `timeframe`.
- `src/components/AudienceTimeframeFilter.tsx`: dropdown igual ao `DateRangeFilter` existente, mas com as 4 opções de `AUDIENCE_TIMEFRAMES`.
- `src/components/DemographicCompare.tsx`: componente reutilizável que recebe `title`, `followers: DemographicSlice[]`, `engaged: DemographicSlice[]` e renderiza as 2 colunas lado a lado, cada uma com barras horizontais (reaproveita o padrão visual das barras de progresso já usado em `TopVideosList.tsx`). Usado 4 vezes (gênero, idade, país, cidade).
- Seção de breakdown de alcance (seguidor-vs-não-seguidor, tipo de conteúdo) também dentro de `AudiencePanel.tsx`, mas lendo do `snapshot.reachBreakdown` que já vem do fetch orgânico principal (prop recebida do `Dashboard.tsx`, não busca de novo).
- **Estado vazio:** quando `hasEnoughData === false`, mostra um card único "Ainda não temos dados suficientes sobre esse público" no lugar das 4 comparações, em vez de gráficos zerados.

## Erros

Mesma filosofia já usada em todo o projeto: qualquer falha de uma chamada individual à Graph API (via `safeGraphGet`) degrada pra array vazio, nunca derruba a tela inteira. Se `hasMetaCredentials()` for falso ou o cliente não tiver `instagramBusinessId`, cai pro mock — igual ao dashboard orgânico hoje.

## Testes

- Rodar `npx tsc --noEmit` antes de qualquer commit.
- Deploy de preview na branch `staging` (`vercel`, sem `--prod`).
- Conferir com a Laís (tem volume de seguidores/engajamento de sobra) se os números de gênero/idade/país/cidade aparecem e se a soma das % bate ~100%.
- Conferir visualmente o layout lado a lado em mobile (largura estreita) — 2 colunas pode precisar virar empilhado.
- Não há hoje nenhum cliente abaixo do mínimo de 100 seguidores/engajamentos pra testar o estado vazio "ao vivo" — validar esse caminho por leitura de código e, se possível, forçando `hasEnoughData: false` manualmente em teste local.
- Confirmar que o breakdown de alcance (seguidor-vs-não-seguidor / tipo de conteúdo) muda junto quando o filtro de período **principal** do dashboard muda, e que a aba Público em si só muda com o filtro próprio dela.
