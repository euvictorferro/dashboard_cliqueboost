# Admin Panel Clique Boost — Spec v1

**Data:** 2026-08-07 · **Status:** aprovado pelo Victor (briefing em sessão)

## Visão

Segunda ponta do app: a agência gerencia toda a operação por `admin.cliqueboost.io`, substituindo gradualmente ClickUp (tasks), Trello (conteúdos), Google Forms (briefings) e o trabalho manual em Supabase/Stripe (clientes/indicações). É também a fundação do futuro SaaS multi-agência ("app para agências by Clique Boost") — primeiro valida na operação própria, depois abre pra outros donos de agência.

**Princípio de transição:** nada do que roda pros clientes hoje é desligado antes do substituto estar pronto. Cada módulo novo só "vira a chave" quando cobre o uso real.

## Estrutura técnica

- **Mesmo repositório e mesmo deploy** do dashboard. `admin.cliqueboost.io` e `dash.cliqueboost.io` apontam pro mesmo app Vercel; o `proxy.ts` detecta o host e roteia (`admin.*` → árvore `/admin`).
- **Auth de admin separada da de cliente**: tabela `admin_users`, login por email/senha e Google OAuth (Supabase Auth), sessão própria com cookie distinto (`admin_session`, mesmo mecanismo HMAC de `lib/session.ts`). 2-6 usuários, todos veem tudo — **sem roles na v1**.
- **Multi-tenant desde o dia 1**: tabela `agencies` (semente: Clique Boost) e coluna `agency_id` em toda tabela nova. Custo marginal agora, evita migração dolorosa na virada SaaS.
- **RLS real entra nesta virada**: as tabelas novas nascem com policies desenhadas (por agência e por cliente). A migração da camada de dados pra JWT de usuário acontece módulo a módulo conforme o admin substitui as fontes externas (ver dívida registrada no ARCHITECTURE.md).

## Modelo de dados (novo)

```
agencies            id, name, created_at
admin_users         id, agency_id, user_id (supabase auth), name, email
clients             id (slug), agency_id, name, instagram_business_id,
                    clickup_list_id*, trello_board_id*, ads_active, ad_account_id
                    -- substitui o CLIENTS hardcoded de lib/clients.ts
                    -- *colunas de integração legada, morrem nas fases 2-3
tasks               id, agency_id, client_id, title, description, status,
                    assignee_admin_user_id, due_at, position, created_by, created_at
task_comments       id, task_id, author_admin_user_id, body, created_at
task_statuses       id, agency_id, client_id?, name, color, position
                    -- colunas do kanban, customizáveis por cliente
content_lists       id, agency_id, client_id, name, position
content_cards       id, agency_id, client_id, list_id, name, description,
                    labels jsonb, cover_url, due_at, position, created_at
content_card_videos id, card_id, drive_file_id, take_name, created_at
forms               id, agency_id, title, fields jsonb, created_at
form_submissions    id, form_id, client_id?, answers jsonb, submitted_at
ai_actions          id, agency_id, client_id?, kind, input, output,
                    status (draft|approved|rejected), created_at
                    -- toda execução do agente passa por aqui (aprovação humana)
```

Tabelas existentes (client_settings, referral_leads, client_payments, chat_*, call_notes…) ganham `agency_id` numa migration de adoção, com valor semeado da Clique Boost.

## Módulos e fases de entrega

### Fase 1 — Clientes + Indicações (primeira entrega, maior alívio imediato)

**Clientes**
- Lista de clientes com status resumido (plano, pagamento, contrato)
- Criar cliente novo pelo admin: dados, IDs de integração, credenciais de login do cliente geradas na hora (Supabase Auth + client_accounts) — **mata o processo `clients.ts` + deploy + SQL manual**
- Editar configurações: fuso, logo, email de contato, plano, status, vínculo Stripe (customer/subscription id)
- Visão espelho: abrir o dashboard de qualquer cliente de dentro do admin (sidebar → Clientes → fulano → vê o que ele vê)
- Migração: `lib/clients.ts` passa a ler da tabela `clients` (cacheada); o arquivo morre

**Indicações**
- Lista geral de todas as indicações (todas as origens), com os status já existentes (pending/converted/rewarded/disqualified)
- Ação "marcar conversão": selecionar qual cliente novo corresponde ao lead → preenche `converted_client_id` — hoje é SQL manual
- O desconto continua automático via webhook Stripe (piso US$ 350 já implementado); o admin mostra o resultado e permite reprocessar/aplicar manual em exceção

**Faturamento (consolidado)**
- Painel: MRR, pagamentos do mês, quem pagou/atrasou, histórico por cliente (dados do Stripe + client_payments)
- Ações mínimas: vincular cliente↔Stripe customer, aplicar/remover desconto — o objetivo é **usar o painel do Stripe o mínimo possível**, sem reconstruir billing completo

### Fase 2 — Tasks (mata o ClickUp)

- Kanban por cliente: colunas de status (customizáveis), drag-and-drop, prazo, responsável, comentários
- Visões cruzadas: "Minhas tarefas" e "Todas do time", com filtros (cliente, responsável, prazo)
- Fora da v1: automações, recorrências, templates (avaliar depois do uso real)
- Virada: quando o time estiver operando 100% no kanban próprio, a página Tasks do dashboard do cliente passa a ler das tabelas novas (hoje lê ClickUp); `lib/clickup.ts` morre

### Fase 3 — Conteúdos (mata o Trello)

- Board de conteúdos no banco próprio, modelado a partir do que o dashboard do cliente já consome (listas, cards, labels, capas, vídeos/takes — paridade com o uso real do Trello, não com o Trello inteiro)
- Upload de vídeo/takes continua no Google Drive (fluxo `videoTakes.ts` preservado, só muda a origem do card)
- **Virada atômica por decisão do Victor:** quando o módulo ficar pronto, o dashboard do cliente migra pra ler do banco novo no mesmo momento — sem período de dupla digitação. Script de importação dos boards Trello existentes (cards, listas, labels, capas)
- Calendário do cliente (que hoje é o Trello com datas) passa a ler das tabelas novas automaticamente

### Fase 4 — Briefings / Forms (mata o Google Forms)

- Construtor de formulários: campos (texto, múltipla escolha, upload, escala…), montados pela agência
- Cada form gera um link público (`/f/<id>`) pro cliente ou prospect preencher — sem login
- Respostas caem no admin, anexadas ao cliente (ou a um lead)
- Casos de uso: briefing inicial de onboarding, questionário de brand guide, briefing de campanha

### Fase 5 — Agente IA da agência + Painel agregado

**Agente IA** (chat, evolução do padrão Booster AI com acesso total à agência)
- Ferramentas de leitura: métricas de todos os clientes, tasks, conteúdos, briefings respondidos, faturamento, indicações
- Execuções (todas passam por `ai_actions` com aprovação humana antes de valer):
  - **Estratégia de conteúdo do mês** por cliente → vira cards rascunhados no board
  - **Estratégia de tráfego pago** → documento estruturado por cliente
  - **Brand guide assistido**: a partir do briefing preenchido, gera sugestões de paleta/fontes/tom de voz pro cliente aprovar
  - **Distribuir tasks**: transforma estratégia aprovada em tasks no kanban com responsáveis e prazos
- Conhecimento: Claude + dados internos do sistema. **Biblioteca de referências da internet fica pra v2** (sessão dedicada de design quando chegar lá)

**Painel agregado**
- Visão da agência: todos os clientes lado a lado (crescimento, alertas de queda, saúde da conta)
- Métricas de operação: tasks atrasadas por responsável, conteúdos no prazo, produtividade

*A IA é a última fase de propósito: precisa dos módulos 1-4 populados pra ter o que ler e onde agir.*

## Fora da v1 (registrado, não esquecido)

- Roles/permissões por nível (social media vê só conteúdo etc.)
- Automações, recorrências e templates de tasks
- Biblioteca de referências externas pra IA (swipe files)
- Billing completo (criar planos, cobranças avulsas, reembolsos)
- White-label/branding por agência (entra na virada SaaS; o `agency_id` já deixa o terreno pronto)
- Onboarding animado da plataforma do cliente (task #2 do roadmap, independente desta spec)

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Escopo total é grande (5 fases) | Entrega por fase; cada fase é utilizável sozinha e "vira a chave" de uma ferramenta externa |
| Virada atômica dos conteúdos (Trello→banco) | Script de importação testado num cliente antes; Trello fica read-only como backup por 30 dias |
| Duas auth no mesmo app (cliente + admin) | Cookies distintos, árvores de rota distintas, proxy separa por host — sem compartilhamento de sessão |
| Migração `clients.ts` → tabela | Fase 1 mantém leitura compatível (mesma interface de `lib/clients.ts`), rotas existentes não mudam |

## Critérios de sucesso da v1

1. Cliente novo é criado pelo admin em minutos, sem deploy nem SQL
2. Indicação é convertida e premiada sem abrir Supabase nem Stripe
3. Time opera tasks e conteúdos 100% na ferramenta própria (ClickUp e Trello cancelados)
4. Briefing de cliente novo é enviado e respondido pela plataforma (Google Forms cancelado)
5. Victor pede uma estratégia de conteúdo pro agente e aprova os cards gerados
