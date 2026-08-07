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
│   └── sair/               # Logout
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
│   ├── session.ts          #   Sessão própria (HMAC via cookie httpOnly)
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

- `lib/clients.ts` é hardcoded (1 agência = Clique Boost). O plano de longo prazo é multi-tenant (`agency_id` → `client_id` → `user_id`) para vender a outras agências.
- ~21 avisos de lint da regra `react-hooks/set-state-in-effect` (não afetam produção).
- "Esqueci a senha" no login é um `mailto:` — sem fluxo de reset automatizado ainda.
