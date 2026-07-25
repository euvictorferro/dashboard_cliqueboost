# Spec: Sidebar "Social Media" + Calendário + Bunker de Ideias

Branch: `feature-conteudos-refinamento` (mesma branch em uso, ainda não mesclada). Repo `/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost`.

## Contexto

O Victor quer reestruturar a navegação de "Conteúdos" num grupo "Social Media" com 3 páginas: Conteúdos (Kanban já existente, sem mudança), Calendário (visualização em calendário dos posts com data) e Bunker de Ideias (dashboard com a lista de ideias do Kanban + análise de concorrentes).

Esse pedido original incluía também uma feature de "Concorrentes/referências" com feed real de posts (curtidas, alcance) e "recriar o post" via IA — isso depende de scraping pago (Apify/Firecrawl) e da API da Claude, credenciais que o Victor ainda não tem. Decompomos o trabalho: este documento cobre a parte que dá pra construir e testar agora sem nenhuma API paga nova — incluindo o **cadastro real** de concorrentes (é só um CRUD no Supabase, não precisa de scraping) — com o **feed de posts e os números de perfil mockados** até a chave chegar. A parte de scraping/análise de verdade (buscar os posts reais, calcular alcance real, "recriar o post" via IA) fica para um round futuro, quando as credenciais existirem.

Investigação feita antes do design: `fetchClientBoard` (`src/lib/trello.ts`, já existe) já devolve todo card com `dueDate`, `listName` e todo o resto — Calendário e a seção Ideias do Bunker não precisam de nenhuma chamada nova ao Trello, só reorganizam o dado já buscado pela rota `/api/content/[client]` que já existe. Não há biblioteca de calendário instalada no projeto (`package.json` confirmado) — o calendário é construído na mão, mesmo espírito do board Kanban.

## Decisões (via brainstorming com o Victor)

1. **Sidebar**: "Conteúdos" vira um grupo expansível "Social Media" com 3 subitens (Conteúdos/Calendário/Bunker) — o grupo abre automaticamente quando uma dessas páginas está ativa.
2. **Calendário**: só visualização de **Mês** nessa primeira versão (Semana/Dia/Ano/Timeline ficam para um round futuro, evita construir 4-5 visualizações sem validar se o mês já resolve). Sem lib de calendário nova — grade construída na mão com Tailwind.
3. **Card sem data não aparece no Calendário** — filtro explícito por `dueDate !== null`.
4. **Clicar num card (Calendário ou Ideias do Bunker) abre o mesmo `ContentCardModal`** já usado no Kanban — reaproveitado, não duplicado.
5. **Bunker — Ideias**: reaproveita a lista "Ideias"/"Backlog" que já existe em cada board (mesmo heurístico de nome já usado desde a spec original do Conteúdos), em formato de lista vertical.
6. **Bunker — Concorrentes**: cadastro (@ + plataforma) e exclusão são **reais**, salvos numa tabela nova no Supabase deste projeto. O feed de posts e o modal "Ver perfil" usam **dado de exemplo fixo por concorrente** (determinístico, não aleatório a cada carregamento) — a função que gera esse dado tem a mesma assinatura que a função real vai ter depois, pra trocar sem mexer na UI quando a chave da Apify/Firecrawl chegar.
7. **"Recriar o post"**: botão visível, porém desabilitado com indicação "em breve" — depende da mesma peça (IA) que ainda não está disponível.

## Arquitetura

### Sidebar (`src/components/Sidebar.tsx`)

- `NAV_ITEMS` vira uma estrutura com um item de grupo (`{ key: "social", label: "Social Media", icon, children: [...] }`) contendo os 3 subitens (`conteudos`/`calendario`/`bunker`), cada um com seu próprio `href`/`label`/`icon`.
- `active` (prop já existente) ganha os 2 novos valores possíveis (`"calendario"`, `"bunker"`) — quando `active` é um dos 3 filhos, o grupo renderiza expandido; senão, colapsado (comportamento simples, sem persistir estado de expansão entre navegações).

### Calendário

- **`src/app/[client]/calendario/page.tsx`** (novo): mesmo padrão de auth de `conteudos/page.tsx` (`verifyClientToken`, `AccessDenied`), renderiza `<Sidebar active="calendario">` + `<CalendarPageClient>`.
- **`src/components/CalendarPageClient.tsx`** (novo): mesmo padrão de fetch de `ContentPageClient.tsx` — busca `/api/content/[client]` (rota já existente, sem mudança), mesmos estados de erro/carregando, renderiza `CalendarView` com todos os cards de todas as listas (achatado, não por lista).
- **`src/components/CalendarView.tsx`** (novo): recebe `cards: ContentCard[]` (achatado de todas as listas) + `clientId`/`accessKey`. Filtra `dueDate !== null`. Estado local de mês exibido (`currentMonth`, default mês atual) com botões anterior/próximo. Grade de 7 colunas (Dom-Sáb), células vazias antes do dia 1 e depois do último dia do mês pra alinhar a grade. Cada card vira uma barra compacta (nome truncado) na célula do seu dia — múltiplos cards no mesmo dia empilham verticalmente dentro da célula. Clicar na barra abre `ContentCardModal` (import direto do componente já existente, com estado local `selectedCard`, mesmo padrão de `ContentBoard.tsx`).

### Bunker

- **`src/app/[client]/bunker/page.tsx`** (novo): mesmo padrão de auth, renderiza `<Sidebar active="bunker">` + `<BunkerPageClient>`.
- **`src/components/BunkerPageClient.tsx`** (novo): busca `/api/content/[client]` (pra seção Ideias) e `/api/content/[client]/competitors` (novo, pra seção Concorrentes) em paralelo. Localiza a lista de ideias com `lists.find(l => /ideias|backlog/i.test(l.name))` — mesmo heurístico já usado na spec original do Conteúdos. Renderiza `IdeasList` + `CompetitorsSection`.
- **`src/components/IdeasList.tsx`** (novo): recebe `cards: ContentCard[]` (da lista de ideias) + `clientId`/`accessKey`. Lista vertical (nome, labels, descrição truncada — reaproveita o mesmo estilo de linha já usado, não um card de Kanban). Clicar abre `ContentCardModal`, mesmo padrão do Calendário.

#### Concorrentes — dados

- **`supabase/migrations/0003_content_competitors.sql`** (novo): tabela `content_competitors` (`id uuid default gen_random_uuid() primary key`, `client_id text not null`, `handle text not null`, `platform text not null check (platform in ('instagram','tiktok','linkedin'))`, `created_at timestamptz not null default now()`), RLS ligado sem policies (só a Service Role Key acessa, mesmo padrão de `daily_metric_cache`).
- **`src/lib/competitors.ts`** (novo, server-only):
  - `fetchCompetitors(clientId): Promise<Competitor[]>` — `select * from content_competitors where client_id = ...`.
  - `addCompetitor(clientId, handle, platform): Promise<Competitor>` — insert.
  - `deleteCompetitor(clientId, competitorId): Promise<void>` — delete (filtrado por `client_id` também, pra um cliente nunca conseguir apagar concorrente de outro).
  - `type Competitor = { id: string; handle: string; platform: "instagram" | "tiktok" | "linkedin" }`.
  - `type CompetitorPost = { id: string; thumbnailUrl: string; caption: string; likes: number; reach: number; postUrl: string }`.
  - `type CompetitorProfile = { followers: number; following: number; postsCount: number; topPosts: CompetitorPost[] }`.
  - `fetchCompetitorFeed(competitor: Competitor): Promise<CompetitorPost[]>` — **versão mock**: gera de 2 a 5 posts fixos por concorrente, usando o `handle` como seed determinística (mesmo handle sempre gera os mesmos números/textos) — pra parecer dado real e estável entre recarregamentos, mas deixar óbvio ao olhar de perto que é exemplo (thumbnail cinza com iniciais, texto genérico tipo "Post sobre [tema aleatório determinístico]"). Assinatura já pronta pra virar uma chamada real (Apify/Firecrawl) depois, sem mudar quem chama.
  - `fetchCompetitorProfile(competitor: Competitor): Promise<CompetitorProfile>` — mesma lógica de mock determinística.
- **`src/app/api/content/[client]/competitors/route.ts`** (novo): `GET` (lista) / `POST` (adiciona, corpo `{ handle, platform }`) — mesmo padrão de auth das rotas irmãs.
- **`src/app/api/content/[client]/competitors/[competitorId]/route.ts`** (novo): `DELETE`.
- **`src/app/api/content/[client]/competitors/[competitorId]/feed/route.ts`** (novo): `GET` — devolve `{ feed: CompetitorPost[] }` (mock).
- **`src/app/api/content/[client]/competitors/[competitorId]/profile/route.ts`** (novo): `GET` — devolve `CompetitorProfile` (mock).

#### Concorrentes — UI

- **`src/components/CompetitorsSection.tsx`** (novo): título + botão "+ Adicionar" (abre `AddCompetitorModal`). Lista de concorrentes, cada um renderizando seu feed (busca sob demanda, `fetchCompetitorFeed` real futuramente) como uma tabela: preview/@ /curtidas/alcance por linha, "..." no fim de cada linha do concorrente (não por post) abrindo um menu com "Excluir perfil" (chama `DELETE`, remove da lista local) / "Ver perfil" (abre `CompetitorProfileModal`).
- **`src/components/AddCompetitorModal.tsx`** (novo): formulário com campo de texto (@ do perfil) + seletor de plataforma (Instagram/TikTok/LinkedIn) — `POST` na rota de competitors, adiciona à lista local ao salvar.
- **`src/components/CompetitorProfileModal.tsx`** (novo): busca `/competitors/[id]/profile` ao abrir, mostra seguidores/seguindo/quantidade de posts + lista dos posts mais engajados (mock) — cada post com um botão "Recriar o post" desabilitado, tooltip "em breve".

## Fluxo de dados

1. **Calendário**: `CalendarPageClient` busca `/api/content/[client]` (já existe) → achata todas as listas em `cards` → `CalendarView` filtra por `dueDate` e agrupa por dia do mês exibido.
2. **Bunker/Ideias**: `BunkerPageClient` busca `/api/content/[client]` → encontra a lista de ideias por nome → `IdeasList` renderiza os cards dela.
3. **Bunker/Concorrentes**: `BunkerPageClient` busca `/api/content/[client]/competitors` (lista real) → `CompetitorsSection` busca o feed mock de cada um sob demanda (`/competitors/[id]/feed`) → adicionar/excluir concorrente atualiza a tabela real no Supabase e o estado local.

## Tratamento de erros

- Calendário/Ideias: mesmo tratamento de erro já existente em `/api/content/[client]` (`no_board_configured`/`fetch_failed`).
- Competitors: `GET`/`POST`/`DELETE` seguem o mesmo padrão de auth (401) das rotas irmãs; falha ao adicionar mostra erro inline no modal, sem fechar; falha ao excluir mostra erro inline na linha, sem remover da lista local até confirmar sucesso.

## Testes / verificação

Sem suíte automatizada (padrão já estabelecido). Verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual: Sidebar mostrando o grupo expandido nas 3 páginas; Calendário da Débora (tem cards com `due` real — Bela e Tiago também) mostrando barras nos dias certos e nenhum card sem data; Bunker mostrando a lista de Ideias real de um cliente + cadastro/exclusão real de um concorrente de teste (removido ao final do teste) + feed mock renderizando de forma estável (mesmo handle = mesmos números em recarregamentos).

## Fora de escopo (explícito, adiado pra quando as chaves da Apify/Firecrawl + Claude chegarem)

- Scraping real de posts de concorrentes (feed/perfil hoje são mock).
- "Recriar o post" funcional (depende de IA).
- Visualizações de Semana/Dia/Ano/Timeline no Calendário — só Mês nessa versão.
- Qualquer edição nos cards a partir do Calendário/Bunker além do que o `ContentCardModal` já faz (que já é editável, reaproveitado sem mudança).
