# Arquitetura — Dashboard Clique Boost

Dashboard de resultados para clientes de agência de marketing. Cada cliente loga e vê métricas do Instagram, conteúdos, tarefas, calendário, atas de reunião e a própria conta.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (banco + auth) · Vercel (deploy)

## Mapa de pastas

```
src/
├── app/                    # Rotas (convenção do Next.js App Router)
│   ├── [client]/           # Páginas do cliente logado (/{clientId}/...)
│   │   ├── page.tsx        #   Dashboard (métricas Instagram)
│   │   ├── conteudos/      #   Board de conteúdos (Trello)
│   │   ├── tasks/          #   Tarefas (ClickUp)
│   │   ├── calendario/     #   Calendário de postagens
│   │   ├── atas/           #   Atas de reunião (Google Drive/Calendar)
│   │   ├── booster-ai/     #   Chat com IA (Anthropic)
│   │   ├── bunker/         #   Arquivos do cliente
│   │   └── conta/          #   Perfil, faturamento, indicações
│   ├── api/                # Rotas de API (uma pasta por domínio, espelham as páginas)
│   │   ├── auth/           #   login/logout (cookie de sessão assinado)
│   │   └── webhooks/stripe #   Chamado PELO Stripe, não pelo front
│   ├── login/              # Tela de login
│   ├── r/[code]/           # Landing pública de indicação
│   ├── sair/               # Logout
│   └── admin/              # Painel da agência (admin.cliqueboost.io) — sessão própria
│       ├── login/          #   Tela de login do admin
│       └── (authed)/       #   clientes/ indicacoes/ faturamento/ — protegidas por admin_session
│
├── components/             # Componentes React, agrupados por funcionalidade
│   ├── layout/             #   Casca do app: Sidebar, Header, tema, contexts
│   ├── ui/                 #   Genéricos reutilizáveis: ícones, tooltip, markdown
│   ├── dashboard/          #   Gráficos e cards de métricas
│   ├── conteudos/ tasks/ calendario/ atas/ conta/ login/ ...
│   └──                     #   (cada pasta = uma página do app)
│
├── lib/                    # Lógica de negócio e integrações (sem React, exceto pdf)
│   ├── supabase.ts         #   Cliente do banco
│   ├── session.ts          #   Sessão própria de cliente (HMAC via cookie httpOnly)
│   ├── adminSession.ts     #   Sessão própria de admin (mesmo mecanismo, cookie/secret distintos)
│   ├── access.ts           #   Autorização por rota
│   ├── meta.ts             #   API do Instagram/Meta
│   ├── trello.ts clickup.ts googleDrive.ts googleCalendar.ts stripe.ts
│   ├── clients.ts          #   Registro de clientes (hoje hardcoded — ver nota abaixo)
│   └── ...                 #   Um arquivo por domínio/integração
│
└── proxy.ts                # Middleware do Next (proteção de rotas)

supabase/migrations/        # Histórico SQL do banco — fonte da verdade do schema
docs/superpowers/ROADMAP-plataforma.md  # Roadmap do produto
```

## Convenções

- **Página nova** = pasta em `app/[client]/`, componente `*PageClient.tsx` na pasta correspondente de `components/`, rota de dados em `app/api/<dominio>/[client]/`.
- **Autenticação**: cookie `session` assinado (HMAC, `lib/session.ts`), validado pelo `proxy.ts` e por `lib/access.ts` em cada rota de API. Não usa a sessão do Supabase Auth (decisão registrada em `lib/session.ts`).
- **Comentários `ponytail:`** marcam simplificações intencionais com o motivo — leia antes de "consertar".
- Variáveis de ambiente: ver `.env.example`.

## Dívidas conhecidas

- `lib/clients.ts` lê da tabela `clients` (com fallback pro array hardcoded se a migration ainda não rodou ou faltar env). O CRUD vive no Admin Panel (`/admin/clientes`). O plano de longo prazo é multi-tenant (`agency_id` → `client_id` → `user_id`) para vender a outras agências — a tabela `agencies` e a coluna `agency_id` já existem (migrations 0024/0025), fundação lançada junto do Admin Panel Fase 1.
- ~21 avisos de lint da regra `react-hooks/set-state-in-effect` (não afetam produção).
- "Esqueci a senha" no login é um `mailto:` — sem fluxo de reset automatizado ainda.
- **RLS não é enforcada no banco (por decisão, não esquecimento).** As 15 tabelas têm
  `enable row level security` sem policies (deny-by-default pela anon key). MAS todo acesso a
  dados usa a Service Role Key (`getSupabaseAdmin`), que **ignora RLS**. A isolação entre
  clientes é feita na aplicação: `proxy.ts` (checa clientId no path) + `verifyClientSession`
  em cada rota. Escrever policies hoje seria inócuo — elas nunca executam sob service role.
  RLS real exige migrar a camada de dados pra JWT de usuário (`@supabase/ssr`), o que só paga
  o custo junto com a virada multi-tenant. Fazer as duas coisas juntas. A fundação multi-tenant
  (tabela `agencies`, coluna `agency_id` em toda tabela) já começou no Admin Panel Fase 1 —
  policies reais entram módulo a módulo conforme o admin substitui as fontes externas.
