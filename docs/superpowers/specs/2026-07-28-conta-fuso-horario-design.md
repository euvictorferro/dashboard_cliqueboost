# Página Conta — Fuso Horário do Cliente — Design

## Contexto

"Conta" é o próximo item do roadmap Fase A (item 5), descrito lá como: Briefing, Brand, Tempo de contrato, Indicação de amigos. Ao pedir pra começar, o Victor trouxe um requisito novo, fora do texto original do roadmap: o cliente deve poder configurar o **fuso horário** usado na exibição de horários do Calendário (e da página Atas) — hoje esse fuso está fixo em `America/New_York` (decisão deliberada de uma rodada anterior, implementada em `src/lib/nyTime.ts` e usada por `CalendarMonthView`/`CalendarWeekView`/`CalendarDayView`/`AtasList`/`AtaDetailPageClient`/`formatCallDate.ts`).

Dado que "Conta" cobre 5 pedaços independentes (Briefing, Brand, Tempo de contrato, Indicação de amigos, e agora Fuso horário), esta rodada trata **só do fuso horário** — os demais pedaços ficam pra desenhos futuros separados, cada um com sua própria spec/plano.

## Decisões confirmadas com o Victor

- Só fusos dos EUA: Eastern, Central, Mountain, Pacific (dropdown com 4 opções, default Eastern — o valor já fixo hoje, então clientes que não mexerem não percebem diferença).
- O fuso escolhido pelo cliente passa a valer de verdade nas páginas Calendário (Mês/Semana/Dia) e Atas (lista + detalhe) — não é só um campo salvo sem efeito.
- Item novo "Conta" na Sidebar, standalone (junto com Dashboard/Tasks/Atas).

## Arquitetura

**Nova tabela Supabase `client_settings`:**
- `client_id text primary key`
- `time_zone text not null default 'America/New_York'`
- RLS ligado, sem policies (só Service Role Key, mesmo padrão de `content_competitors`/`call_notes`).

**`src/lib/clientSettings.ts` (novo)** — `fetchClientSettings(clientId): Promise<{ timeZone: string }>` (faz upsert implícito: se a linha não existir ainda, retorna o default `America/New_York` sem precisar de uma linha real no banco — só cria a linha quando o cliente efetivamente salva uma preferência); `updateClientSettings(clientId, timeZone): Promise<void>` (upsert real).

**`src/lib/nyTime.ts` → renomeado pra `src/lib/clientTime.ts`** — as mesmas 3 funções, mas cada uma passa a receber `timeZone: string` como parâmetro (em vez de usar a constante fixa `NY_TIME_ZONE` internamente): `getTimeZoneDateParts(ms, timeZone)`, `isSameTZDay(ms, cell, timeZone)`, `formatTZTime(ms, timeZone)`. Ganha também `US_TIMEZONES: { value: string; label: string }[]` (as 4 opções pro dropdown) e `DEFAULT_TIME_ZONE = "America/New_York"`.

**`src/components/TimeZoneContext.tsx` (novo)** — `TimeZoneProvider({ timeZone, children })` + hook `useTimeZone(): string` (lê do Context; se usado fora de um Provider, cai no `DEFAULT_TIME_ZONE` como fallback seguro, nunca quebra). Evita ter que passar `timeZone` como prop nova em cada um dos 5 componentes que hoje usam o utilitário de fuso — cada um só chama `useTimeZone()` internamente.

**Componentes existentes que passam a usar `useTimeZone()` em vez do fuso fixo:** `CalendarMonthView.tsx`, `CalendarWeekView.tsx`, `CalendarDayView.tsx`, `AtasList.tsx`, `AtaDetailPageClient.tsx` (e `formatCallDate.ts` ganha o parâmetro `timeZone` também, chamado com o valor do Context nos dois lugares que o usam).

**Páginas server-side que passam a buscar a preferência e prover o Context:** `src/app/[client]/calendario/page.tsx`, `src/app/[client]/atas/page.tsx`, `src/app/[client]/atas/[id]/page.tsx` — cada uma chama `fetchClientSettings(clientId)` e envolve o client component correspondente (`CalendarPageClient`/`AtasPageClient`/`AtaDetailPageClient`, via um novo prop `timeZone` que cada um repassa pro `TimeZoneProvider`) com o valor real.

**Nova rota `src/app/api/conta/[client]/route.ts`** — `GET` (retorna `{ timeZone }`, mesmo padrão de auth das outras rotas) e `PUT` (recebe `{ timeZone }` no corpo, valida contra `US_TIMEZONES`, chama `updateClientSettings`).

**Nova página `src/app/[client]/conta/page.tsx` + `src/components/ContaPageClient.tsx`** — mesmo padrão de página cliente já usado nas outras (`CLIENTS.find` → `notFound()`, `verifyClientToken` → `AccessDenied`). Nesta rodada, `ContaPageClient` mostra só a seção de fuso horário: dropdown com as 4 opções + botão "Salvar", com feedback de sucesso/erro. As outras seções da Conta (Brand, Tempo de contrato, Briefing, Indicação) ficam como placeholder visual mínimo ("em breve") ou simplesmente fora da página até serem desenhadas — **decisão: fora da página por enquanto**, a página mostra só o que já existe (fuso horário), sem seções vazias/"em breve" (YAGNI — não construir UI pra recursos que ainda não têm desenho).

**`src/components/Sidebar.tsx` (modificar)** — adiciona "Conta" em `STANDALONE_ITEMS`, depois de "Atas".

## Fora de escopo

- Brand, Tempo de contrato, Briefing, Indicação de amigos — cada um vira uma spec/plano separado depois.
- Qualquer fuso fora dos 4 dos EUA.
- Qualquer efeito da preferência de fuso em páginas além de Calendário e Atas (ex: Dashboard, Tasks, Conteúdos não usam fuso hoje e não são afetados).

## Testes / verificação

- Sem suíte de testes automatizada (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, dados reais/teste via curl, e checagem visual: trocar o fuso de um cliente de teste na página Conta e confirmar que o Calendário e a página Atas dele passam a mostrar os horários no fuso novo, enquanto outro cliente (sem alterar) continua em `America/New_York`.
