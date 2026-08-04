# Atas — Agendamento de Call + Extração de Tasks

## Contexto

Retomando o roadmap original (`Dashboard App Insights.md`, item L2 "Armazenamento de Atas"), duas peças ficaram de fora da primeira versão da página Atas (`2026-07-27-atas-design.md`): agendamento de call estilo Calendly, e conversão de atas em tasks. Nesta rodada de brainstorm o Victor decidiu fechar as duas antes de partir pro UX/UI da versão cliente. Outras pendências do roadmap (Briefing, Bunker de Ideias "de verdade", Login real via Supabase Auth, Análise AI de métricas, Booster AI) ficam propositalmente fora — Briefing fica pra quando existir página de admin; o resto fica pra rodadas futuras.

## Escopo

### 1. Agendamento de call (Google Calendar)

- Um único Google Calendar (o do Victor) é a fonte de verdade de disponibilidade — não há múltiplos responsáveis por cliente.
- Na página Atas, uma seção mostra horários livres reais (calculados via Google Calendar API) para os próximos dias. Cliente escolhe um slot e confirma.
- Ao confirmar, o sistema cria um evento no Google Calendar do Victor com o cliente como detalhe/descrição do convidado (e-mail de contato do cliente, se existir em `client_settings.contact_email`; senão, sem convidado formal) e grava um registro em `client_calls`.
- Se já existe uma call futura agendada pro cliente, o botão de agendar vira **"Remarcar Call"**: cancela (deleta) o evento antigo no Google Calendar, marca o registro antigo como `status = "cancelled"`, e abre o fluxo de escolha de novo horário.
- Autenticação/autorização do cliente na rota segue o padrão existente (`verifyClientToken`).

### 2. Extração de tasks a partir de uma ata (via IA)

- Na página de detalhe de uma ata (`/[client]/atas/[id]`), um botão **"Extrair tasks"**.
- Ao clicar, chama uma rota da API que manda o conteúdo da ata pra um modelo Claude (via Anthropic API, `ANTHROPIC_API_KEY`) pedindo extração estruturada de itens de ação (título curto + descrição).
- Para cada item extraído, cria uma task no ClickUp via API, na lista (`clickupListId`) do cliente dono da ata — mesma integração que já alimenta a página Tasks hoje.
- Extração é automática (sem etapa de revisão/aprovação antes de criar no ClickUp) — decisão consciente do Victor.
- Depois de extrair, o botão mostra "Tasks criadas" com a contagem, e marca a ata como processada (`call_notes_processed`, ver schema) pra não duplicar se o botão for clicado de novo — se clicado de novo mesmo assim, reprocessa e cria novas tasks (não há dedupe de conteúdo, só trava contra duplo-clique/loading state).

## Fora de escopo

- Múltiplos calendários/responsáveis por cliente.
- Qualquer automação disparada pela inserção de uma ata nova (a inserção continua manual, via chat com Claude Code — só a extração de tasks fica no app, atrás de um botão).
- Revisão/aprovação humana das tasks extraídas antes de irem pro ClickUp.
- Sincronização bidirecional com o Google Calendar (ex: se o Victor cancelar o evento direto no Google, o status em `client_calls` não atualiza sozinho nesta versão).
- Lembretes/notificações de call (e-mail, WhatsApp etc).

## Arquitetura

### Banco de dados

Nova migration `0013_client_calls.sql`:
```sql
create table if not exists client_calls (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  scheduled_at timestamptz not null,
  google_event_id text not null,
  status text not null default 'scheduled', -- 'scheduled' | 'cancelled'
  created_at timestamptz not null default now()
);

alter table client_calls enable row level security;
```

Nova migration `0014_call_notes_processed.sql`:
```sql
alter table call_notes add column if not exists tasks_extracted_at timestamptz;
```
(Campo simples pra saber se/quando a extração já rodou — usado só pro texto do botão, não bloqueia reprocessar.)

Ambas seguem o padrão já usado no projeto: RLS ligado, sem policies (acesso só via Service Role no servidor).

### Google Calendar

- Novo `src/lib/googleCalendar.ts` — client autenticado via Service Account (o Victor cria a Service Account no Google Cloud Console e compartilha o Google Calendar com o e-mail dela) com funções `fetchFreeSlots(daysAhead: number)`, `createCallEvent(...)`, `cancelCallEvent(eventId: string)`.
- Novas env vars: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON da service account).
- Novo `src/lib/clientCalls.ts` — camada de dados sobre `client_calls` (fetch da call ativa do cliente, insert, cancel).
- Novas rotas: `GET /api/atas/[client]/slots` (horários livres), `POST /api/atas/[client]/schedule` (agenda/remarca).

### Extração de tasks

- Novo `src/lib/taskExtraction.ts` — chama Anthropic API (`ANTHROPIC_API_KEY`) com o texto da ata, retorna lista estruturada de `{ title, description }` (usando tool use / structured output da API, não parsing de texto livre).
- `src/lib/clickup.ts` ganha `createTask(listId: string, title: string, description: string): Promise<void>` (hoje só tem update/fetch, não create).
- Nova rota `POST /api/atas/[client]/[id]/extract-tasks`: busca a ata, chama extração, cria as tasks no ClickUp, marca `tasks_extracted_at`, retorna a contagem criada.

### UI

- `AtasPageClient.tsx`: adiciona seção/CTA de agendamento (mostra call futura se houver, ou grade de horários livres pra escolher).
- Página de detalhe da ata (`[id]/page.tsx` + client component): adiciona botão "Extrair tasks" com estado de loading/sucesso.

## Verificação

- Agendar uma call de teste e confirmar que o evento aparece no Google Calendar real do Victor, com horário certo.
- Remarcar essa call e confirmar que o evento antigo some do Google Calendar e um novo aparece.
- Clicar "Extrair tasks" numa ata de teste com ações claras no texto e confirmar que as tasks aparecem no ClickUp, na lista certa do cliente, e também na página Tasks do dashboard (que já lê do ClickUp).
- Testar em ambiente local exige `ANTHROPIC_API_KEY` e credenciais do Google Calendar configuradas — o Victor fornece antes do planejamento/execução.
