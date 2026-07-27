# Página "Atas" (Calls do roadmap) — Design

## Contexto

O roadmap original (Fase A, item 4) descrevia "Calls" como agendamento estilo Calendly nativo, com integração automática de atas do Granola planejada pra Fase B ("precisa confirmar antes de arquitetar"). Ao brainstormar esse item com o Victor, o escopo mudou bastante em relação ao texto original:

- Não é agendamento/remarcação de call nesta versão — isso continua fora do dashboard (Victor combina horário manualmente com o cliente).
- É uma página de histórico de **atas** (resumos de calls já feitas) que o cliente acessa no próprio dashboard.
- Investigação confirmou (via busca real): a Granola tem API pública com webhooks, mas criar uma API key exige plano **Business/Enterprise** — a conta do Victor (`victorcliqueboost@gmail.com`) é individual/free. Integração automática 24/7 fica descartada por enquanto (seria upgrade de plano, decisão de negócio à parte).
- Alternativa encontrada durante o brainstorm: como o Victor já conversa com o Claude Code neste mesmo repositório, e a sessão do Claude já tem acesso configurado tanto ao Supabase (service role) quanto ao workspace Granola do Victor via MCP, o fluxo de "adicionar uma ata" vira: Victor pede ao Claude (nesta conversa, ex: "adiciona a ata da call de ontem com a Débora"), o Claude busca o conteúdo real no Granola (ou usa o texto que o Victor colar) e insere direto no Supabase. Não é automação rodando sozinha em produção — é uma ação do Victor durante uma sessão de chat com o Claude Code, não uma integração publicada no app.

## Decisões confirmadas com o Victor

- Página mostra só **atas de calls já feitas** — sem agendamento/remarcação nesta versão.
- Cada ata é um bloco de texto livre (título + data + o texto colado/buscado do Granola como veio), sem separar em campos estruturados (resumo/ações).
- Adicionar uma ata nova é feito pedindo ao Claude Code numa conversa (ele busca no Granola ou usa o texto fornecido e insere no Supabase) — não existe formulário de admin no app, nem é preciso o Victor abrir o Supabase manualmente.
- Página fica visível pro cliente em `/[client]/atas`, mesmo padrão de autenticação por token das demais páginas.
- Item novo "Atas" na Sidebar, junto com Dashboard/Tasks (fora do grupo "Social Media", já que não é conteúdo de rede social).

## Arquitetura

**Nova tabela Supabase `call_notes`:**
- `id uuid primary key default gen_random_uuid()`
- `client_id text not null`
- `title text not null`
- `call_date date not null`
- `content text not null` — o texto livre da ata
- `created_at timestamptz not null default now()`
- RLS ligado, sem policies (acesso só via service role — mesmo padrão de `content_competitors`).

Migration SQL vai numa task do plano; o Victor roda no SQL Editor do Supabase antes da task que depende da tabela (mesmo handoff já usado nas migrations anteriores deste projeto).

**`src/lib/callNotes.ts` (novo)** — camada de dados: `fetchCallNotes(clientId): Promise<CallNote[]>`, ordenado por `call_date` decrescente (mais recente primeiro). Tipo `CallNote = { id: string; title: string; callDate: string; content: string }`.

**`src/app/api/atas/[client]/route.ts` (novo)** — `GET`, segue o padrão de auth já usado em todas as outras rotas (`CLIENTS.find` → 404 se cliente não existe, `verifyClientToken` → 401 se token inválido), retorna `{ notes: CallNote[] }`.

**`src/components/Sidebar.tsx` (modificar)** — adiciona "Atas" em `STANDALONE_ITEMS`, ao lado de Dashboard/Tasks.

**`src/app/[client]/atas/page.tsx` + `src/components/AtasPageClient.tsx` (novos)** — mesmo padrão de página cliente já usado em Calendário/Bunker: server component valida token e renderiza `AtasPageClient`, que busca as atas via fetch client-side e renderiza a lista.

**`src/components/AtasList.tsx` (novo)** — lista de cards, cada um com título + data (formatada) sempre visíveis; clicar no card expande/recolhe o texto completo (accordion simples com `useState<string | null>` guardando o id expandido — sem precisar de modal novo). Estado vazio: "Nenhuma ata registrada ainda."

## Fora de escopo

- Agendamento/remarcação de calls (mantido fora do dashboard, como já é feito hoje).
- Integração automática com a API da Granola (exige upgrade de plano Business/Enterprise — decisão de negócio separada, não faz parte deste desenho).
- Qualquer formulário de admin no app pra escrever atas — a escrita acontece via Claude Code numa conversa, direto no Supabase.
- Edição/exclusão de atas pelo cliente (view-only).

## Testes / verificação

- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, teste real inserindo 1-2 atas de exemplo no Supabase e conferindo que aparecem certas na página, e checagem visual no Browser pane (lista, expandir/recolher, estado vazio).
