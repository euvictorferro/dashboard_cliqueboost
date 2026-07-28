# Redesign da página Atas — Design

## Contexto

A página "Atas" foi construída numa rodada anterior desta sessão: lista simples em accordion (título + data dentro do card, clique expande/recolhe o texto no mesmo lugar), já em produção de dados (1 ata real da Laís, inserida manualmente a partir de uma nota real do Granola). O Victor pediu um redesign visual e funcional, com 2 imagens de referência da própria interface do Granola.

## Decisões confirmadas com o Victor

1. **Aba "Transcrição"**: fora de escopo nesta rodada. A ferramenta `get_meeting_transcript` do MCP da Granola é paga (confirmado via documentação oficial), e a conta do Victor é individual/free — não há como puxar transcrição real hoje. A página de detalhe mostra só o conteúdo da nota, sem tabs.
2. **Formato do conteúdo ("Notas")**: renderizado como Markdown de verdade via `react-markdown` (dependência nova, leve e bem conhecida) — títulos e bullets ficam formatados como na referência da Granola, não texto corrido.
3. **Fuso do horário da call**: `America/New_York`, reaproveitando `src/lib/nyTime.ts` (mesmo padrão já usado no Calendário) — consistência de fuso em todo o app.
4. **Navegação**: clicar numa nota da lista abre uma página nova (`/[client]/atas/[id]`), não mais um accordion expandindo no lugar.

## Mudança de schema

A coluna `call_notes.call_date` (tipo `date`, só dia) vira `call_notes.call_at` (tipo `timestamptz`, data+hora completos) — necessário pra mostrar o horário da call na lista e no detalhe. Migration renomeia a coluna e converte o tipo. A única linha real existente hoje (ata da Laís, `call_date = '2026-07-09'`) precisa de um ajuste manual pós-migration pra ganhar o horário real da call (11:00 EDT, já conhecido via Granola) — sem isso, a conversão automática de `date` pra `timestamptz` zeraria a hora (meia-noite).

## Arquitetura

**`supabase/migrations/0005_call_notes_call_at.sql` (novo)** — `alter table call_notes rename column call_date to call_at; alter table call_notes alter column call_at type timestamptz using call_at::timestamptz;`

**`src/lib/callNotes.ts` (modificar)** — `CallNote` passa a ser `{ id: string; title: string; callAt: number; content: string }` (`callAt` em ms, mesmo padrão de `ContentCard.dueDate` já usado no resto do projeto). `fetchCallNotes` seleciona `call_at` em vez de `call_date`, mapeia pra `Date.parse(row.call_at)`, ordena por `call_at` decrescente. Nova função `fetchCallNote(clientId, id): Promise<CallNote | null>` — busca uma única ata (`.eq("client_id", clientId).eq("id", id).maybeSingle()`), usada pela página de detalhe.

**`src/lib/formatCallDate.ts` (novo)** — `formatCallDateHeader(callAt: number, options?: { withYear?: boolean }): string`, reaproveitando `getNYDateParts` de `nyTime.ts`. Produz `"sex., 24 de jul."` (lista) ou `"sex., 24 de jul. de 2026"` (detalhe, com `withYear: true`). Compartilhado entre `AtasList.tsx` e `AtaDetailPageClient.tsx` pra não duplicar os arrays de dia da semana/mês.

**`src/app/api/atas/[client]/[id]/route.ts` (novo)** — `GET`, mesmo padrão de auth das outras rotas (`CLIENTS.find` → 404, `verifyClientToken` → 401), chama `fetchCallNote`; retorna `{ note }` em caso de sucesso, `404` se a ata não existir/não pertencer a esse cliente.

**`src/components/AtasList.tsx` (reescrito)** — agrupa as notas (já vêm ordenadas por `callAt` decrescente da API) por dia-calendário em NY, renderizando um cabeçalho de data fora da caixa antes de cada grupo. Cada nota vira uma linha (`Link` do Next.js pra `/[client]/atas/[id]?key=...`, não mais um `button` com estado de accordion): ícone de documento à esquerda (num box arredondado neutro), título, horário (`formatNYTime`) alinhado à direita. Recebe `clientId`/`accessKey` como novas props (pra montar o link). Estado vazio inalterado.

**`src/components/AtasPageClient.tsx` (modificar)** — passa `clientId`/`accessKey` pro `AtasList` (só isso muda).

**`src/app/[client]/atas/[id]/page.tsx` (novo)** — mesmo padrão das outras páginas cliente (`CLIENTS.find` → `notFound()`, `verifyClientToken` → `AccessDenied`), renderiza `Sidebar` (`active="atas"`) + `AtaDetailPageClient`.

**`src/components/AtaDetailPageClient.tsx` (novo)** — busca a ata via `GET /api/atas/[client]/[id]`, trata os estados (carregando/erro/não encontrada/sucesso). Em sucesso: link "← Voltar" pra `/[client]/atas`, cabeçalho com título + `formatCallDateHeader(note.callAt, { withYear: true })` + horário, e o conteúdo renderizado via `<ReactMarkdown>` com componentes customizados (título, parágrafo, lista) estilizados com as classes Tailwind já usadas no resto do projeto (sem precisar do plugin `@tailwindcss/typography`).

**Dependência nova**: `react-markdown`.

## Fora de escopo

- Aba "Transcrição" (depende de upgrade de plano da Granola, decisão do Victor, fora deste desenho).
- Qualquer edição/exclusão de atas pelo cliente (view-only, como já era).
- Migração retroativa de fuso horário de outras partes do app — só afeta a página Atas.

## Testes / verificação

- Sem suíte de testes automatizada (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, dados reais de teste inseridos via curl (removidos ao final, exceto o ajuste do horário real da ata da Laís, que é permanente), e checagem visual no Browser pane.
- Conferir especificamente: o horário exibido bate com o fuso de NY (comparado ao valor bruto do timestamp); o agrupamento por dia não duplica nem perde nenhuma ata quando há várias no mesmo dia; o conteúdo em Markdown renderiza títulos/bullets corretamente mesmo pra ata já existente (que foi salva como texto simples com bullets "-", sem cabeçalhos "#" — deve ao menos formatar os bullets como lista, mesmo sem títulos em negrito).
