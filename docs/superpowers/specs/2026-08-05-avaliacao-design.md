# Avaliação — popup de rating mensal

## Contexto

Motivação: coletar avaliação mensal (0.5–5 estrelas + texto opcional) de cada cliente do
portal, dado que alimenta o go-to-market. Popup deve aparecer perto do fim de cada mês e
insistir (com mensagens variadas) até o cliente avaliar. Segue o mesmo padrão 100% manual das
features anteriores (Report de Bug, Faturamento): sem painel admin, sem integração automática —
Victor consulta os dados direto no Supabase quando quiser.

## Decisões confirmadas com o Victor

- **Janela de exibição**: últimos 3 dias do mês corrente até o cliente avaliar (não fecha na
  virada do mês — continua pedindo aquele mês em meses seguintes até ser respondido).
- **Granularidade**: uma avaliação por mês por cliente (histórico mensal, não um registro
  único sobrescrito).
- **Frequência de reexibição** após "Agora não"/fechar: no máximo 1x por dia de acesso
  (throttle em localStorage), não a cada navegação de página.
- **Onde plugar o check**: client-side, `useEffect` no `AppFrame` (componente único que já
  envolve toda página logada do portal) chamando uma API — sem criar `layout.tsx` novo.

## Escopo

### 1. Tabela `client_ratings` (migration nova)

Segue o padrão de `bug_reports` / `referral_leads`:

- `id uuid primary key default gen_random_uuid()`
- `client_id text not null` (slug do cliente, mesma convenção das outras tabelas — sem FK)
- `month_ref date not null` (primeiro dia do mês avaliado, ex: `2026-07-01`)
- `stars numeric(2,1) not null check (stars >= 0.5 and stars <= 5 and stars % 0.5 = 0)`
- `feedback text` (nullable)
- `created_at timestamptz not null default now()`
- `unique (client_id, month_ref)` — impede duplicata pro mesmo mês
- `enable row level security`, **sem policies** (Service Role Key apenas, mesmo padrão
  fail-closed das outras tabelas).

### 2. API routes (`src/app/api/ratings/[client]/route.ts`)

Segue o padrão de `src/app/api/bug-reports/[client]/route.ts` (novo `src/lib/ratings.ts`,
server-only, espelhando `src/lib/bugReports.ts`, usando `getSupabaseAdmin()`):

- `GET ?key=...` — valida token (`verifyClientToken`, de `src/lib/access.ts`), calcula o "mês
  alvo" (lógica abaixo) e retorna `{ show: boolean, monthRef: "YYYY-MM-01" | null }`.
- `POST ?key=...` — recebe `{ month_ref, stars, feedback }`, valida (`stars` em passos de 0.5
  entre 0.5 e 5), insere via `getSupabaseAdmin()`.

**Lógica do "mês alvo pendente"** (calculada no GET, no servidor):

Mês alvo = mês corrente, se hoje está nos últimos 3 dias do mês corrente E não há rating pra
ele ainda; senão, mês alvo = mês anterior, se não há rating pra ele ainda (cobre quem não abriu
o app nos últimos 3 dias daquele mês). Se ambos já avaliados (ou nenhum se aplica), não mostra
popup (`show: false`, `monthRef: null`).

### 3. Componente `RatingPopup` (`src/components/RatingPopup.tsx`, novo, `"use client"`)

- Renderizado via `createPortal(..., document.body)` — mesmo motivo do `BugReportModal` (nasce
  dentro de `AppFrame`/`Sidebar`, que tem contexto de empilhamento próprio via `sticky`).
- **Estado 1 (convite)**: mensagem rotativa (lista abaixo) + botões "Agora não" / "Avaliar".
  Mensagem escolhida por índice determinístico a partir do contador de dispensas salvo em
  localStorage (não repete a mesma toda vez).
- **Estado 2 (formulário)**: seletor de estrelas de 0.5 em 0.5 (10 níveis — clique/hover em
  metade do ícone) + textarea opcional ("Conte mais, se quiser") + botão "Enviar".
- Ao enviar: `POST /api/ratings/[client]`, fecha popup, não aparece de novo até o próximo mês
  elegível.
- Ao "Agora não" ou fechar: grava `localStorage['rating-dismissed-{clientId}'] = hoje
  (YYYY-MM-DD)` (throttle de 1x/dia) e incrementa `localStorage['rating-dismiss-count-{clientId}']`
  (pra variar a mensagem da próxima vez).

### 4. Mensagens rotativas (convite)

Tom leve, crescente em "cutucada" a cada dispensa:

1. "Como está sendo sua experiência com a Clique Boost esse mês? Sua avaliação nos ajuda a
   evoluir!"
2. "Ei, ainda não recebemos sua nota desse mês — leva 10 segundos, prometemos!"
3. "Sei que já te perguntei, mas... avalia a gente aí? 👀"
4. "Terceira tentativa! Sua opinião realmente importa pra gente (e pro seu contentzinho)."
5. "Tá bom, última insistência por hoje: como foi o mês? 🙏"
6. (a partir da 5ª dispensa, repete a mensagem 5 indefinidamente)

### 5. Plug em `AppFrame`

- `useEffect` on mount: se `localStorage['rating-dismissed-{clientId}']` já é hoje, não busca
  nada (economiza chamada). Senão, `GET /api/ratings/[client]?key=...`; se `show: true`,
  renderiza `<RatingPopup clientId accessKey monthRef onClose onSubmitted />`.
- `AppFrame` já recebe `clientId`/`accessKey` como props — reaproveita, sem novo mecanismo de
  resolução de cliente.

## Fora de escopo (confirmado)

- Sem painel admin de visualização — Victor consulta via Supabase direto.
- Sem notificação automática de nova avaliação.
- Sem edição/exclusão de avaliação pelo cliente depois de enviada.
- Sem pipeline de follow-up (ex: nota baixa dispara alerta) — fica pra depois se o Victor pedir.

## Verificação end-to-end

1. `npx tsc --noEmit -p .` e `npm run build`.
2. Testar manualmente ajustando temporariamente a "janela de dias" ou inserindo/removendo
   linhas em `client_ratings` via Supabase pra simular: (a) dentro da janela sem rating → popup
   aparece; (b) "Agora não" → não reaparece no mesmo dia, reaparece no dia seguinte; (c)
   avaliar → popup some e não retorna nesse mês; (d) fora da janela e mês anterior já avaliado
   → popup não aparece.
3. Testar visualmente no preview com Playwright MCP (cliente `debora`), incluindo o popup não
   ficar atrás de nenhum elemento (herda o mesmo risco de empilhamento do `BugReportModal`).
4. Deploy preview → link pro Victor.
