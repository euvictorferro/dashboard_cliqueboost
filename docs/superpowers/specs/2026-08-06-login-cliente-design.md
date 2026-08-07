# Login de Cliente (email/senha) — substitui o link `?key=`

## Contexto

Hoje o acesso do cliente ao dashboard é via link com token na URL (`/[client]?key=<token>`), verificado contra a tabela `client_tokens` no Supabase (`src/lib/access.ts`). Não existe conta de verdade, senha, nem logout real — `/sair` hoje é só uma tela estática, o token continua válido pra sempre se alguém reusar o link.

Como parte da decisão de profissionalizar o produto (e caminho pra vender pra outras agências), o acesso do cliente final passa a ser por **login com email e senha**, via Supabase Auth. Continua **single-tenant** (só clientes da Clique Boost, hardcoded em `src/lib/clients.ts`) — login de dono de agência (multi-tenant) fica pra quando a venda pra outras agências virar concreta.

## Escopo

- Login por email/senha usando `supabase.auth.signInWithPassword` — aproveita hash de senha, rate limiting e fluxo de reset de senha prontos do Supabase.
- **1 conta = 1 cliente** (não é por pessoa) — mesmo modelo de hoje, só troca o mecanismo de token por credencial.
- Contas criadas manualmente por vocês (Supabase Dashboard → Authentication → Add user), sem self-signup público.
- Substitui completamente o sistema de `?key=` — links antigos deixam de funcionar. Não há período de convivência dos dois mecanismos.
- Sessão própria (cookie assinado, não a sessão "oficial" do Supabase Auth via `@supabase/ssr`) — ver seção Arquitetura pro porquê.

## Fora de escopo

- Login de dono de agência / multi-tenant.
- Múltiplos usuários por cliente (várias pessoas da mesma empresa, cada uma com login próprio).
- Self-signup público.
- "Esqueci minha senha" na v1 — Supabase Auth já suporta nativamente (`resetPasswordForEmail`), mas fica pra depois; por enquanto reset é manual (vocês trocam a senha direto no Supabase Dashboard se o cliente esquecer).

## Arquitetura

### Por que sessão própria em vez de `@supabase/ssr`

O app usa a Service Role Key do Supabase pra tudo (nunca usa Row Level Security por usuário autenticado) — a sessão "oficial" do Supabase Auth (com refresh token, sincronizada entre middleware/server components/route handlers via `@supabase/ssr`) não compra nada a mais aqui, e é a parte historicamente mais cheia de detalhe fino de configurar certo no App Router. Em vez disso: `signInWithPassword` só valida a senha (usa o `@supabase/supabase-js` que já existe no projeto, sem lib nova); depois disso, o servidor assina o **próprio** cookie de sessão (JWT simples, `{ clientId }`, HS256 com uma secret nova em env var), sem refresh token pra gerenciar.

### Dados novos

- Tabela nova `client_accounts`: `user_id` (uuid, referencia `auth.users.id`) ↔ `client_id` (text, bate com os ids de `CLIENTS` em `src/lib/clients.ts`). Migration em `migrations/00XX_client_accounts.sql`, seguindo o padrão das migrations existentes no projeto.
- Env var nova: `SESSION_SECRET` (string aleatória, usada pra assinar/verificar o JWT do cookie).

### Fluxo de login

1. `POST /api/auth/login` recebe `{ email, senha }`.
2. Chama `supabase.auth.signInWithPassword({ email, password })` (client Supabase com a **anon key**, não a service role — precisa adicionar `SUPABASE_ANON_KEY` como env var nova, hoje o projeto só tem a service role).
3. Se autenticou: busca `client_id` em `client_accounts` pelo `user_id` retornado.
4. Assina um JWT `{ clientId, exp: <7 dias> }` com `SESSION_SECRET`, seta como cookie httpOnly (`session`), `secure` em produção, `sameSite: "lax"`.
5. Resposta `{ clientId }` — o frontend redireciona pra `/[clientId]`.
6. Falha em qualquer etapa (senha errada, sem conta em `client_accounts`) → mesma mensagem genérica "Email ou senha inválidos" (não revela qual etapa falhou).

### Proteção de rota

- `middleware.ts` novo na raiz do projeto: intercepta `/[client]/**` e `/api/**`, **exceto** `/login`, `/api/auth/login`, `/r/**`, `/api/webhooks/**`, `/sair`.
- Lê o cookie `session`, verifica a assinatura do JWT. Sem cookie válido → redireciona pra `/login` (páginas) ou `401` (rotas de API).
- Se a rota tem segmento `[client]` na URL e o `clientId` do JWT não bate com esse segmento → mesmo tratamento de "não autorizado" (impede cliente A acessar dados do cliente B trocando a URL).

### Troca mecânica nos ~30 arquivos existentes

Todo arquivo hoje segue o mesmo padrão (representativo, `src/app/[client]/tasks/page.tsx`):

```ts
const { key } = await searchParams;
const authorized = await verifyClientToken(found.id, key);
if (!authorized) return <AccessDenied />;
// ...
<AppFrame clientId={found.id} accessKey={key!} ...>
```

Vira:

```ts
const authorized = await verifyClientSession(found.id);
if (!authorized) return <AccessDenied />;
// ...
<AppFrame clientId={found.id} ...>
```

`verifyClientSession(clientId): Promise<boolean>` (novo, em `src/lib/access.ts`, substitui `verifyClientToken`) lê o cookie via `next/headers`, sem precisar de nenhum parâmetro de URL.

Como a proteção real agora é o middleware (roda antes de qualquer page/route handler), `verifyClientSession` dentro da page é uma segunda checada defensiva, não a única linha de defesa.

O prop `accessKey` (hoje passado manualmente por ~15 componentes client-side pra montar as URLs de `fetch`) é removido em cascata — chamadas `fetch` do navegador pra mesma origem já mandam o cookie httpOnly sozinhas, não precisa mais compor `?key=...` nas URLs internas de API.

Cada rota de API (`src/app/api/**`) troca da mesma forma: para de ler `key` do `searchParams`, passa a chamar `verifyClientSession(clientId)`.

### Logout

`src/app/sair/page.tsx` vira uma rota de ação (`POST /api/auth/logout` ou Server Action) que limpa o cookie `session`, e a página passa a ter um botão "Sair" real em vez de só um texto estático. Botão de logout precisa aparecer em algum lugar do `AppFrame` (hoje não existe, só a URL solta `/sair`).

### Página de login

Nova página `/login` (fora do `[client]`): formulário simples email + senha, chama `POST /api/auth/login`, mostra erro genérico se falhar, redireciona em caso de sucesso. Sem exigência de branding elaborado nesta spec — reaproveita `Logo` e estilo dos outros formulários simples do app (ex: mesma linha visual de `AccessDenied`/`sair`).

## Erros e casos de borda

- Senha errada / email não cadastrado / cliente sem `client_accounts` → mensagem genérica única, sem distinguir motivo.
- Cookie expirado (7 dias) → tratado igual a "sem sessão", redireciona pro login.
- Cliente tenta acessar `/[outro-client]` estando logado → bloqueado pelo middleware antes de qualquer dado carregar.
- `SESSION_SECRET` ausente → `verifyClientSession`/middleware falham fechado (nega acesso), mesmo padrão defensivo já usado em `verifyClientToken` hoje.

## Testes

Sem suíte automatizada no projeto (padrão já estabelecido). Verificação ao vivo:
- Login com credencial válida entra e redireciona certo.
- Login com senha errada mostra erro genérico, não entra.
- Usuário logado como cliente A tentando abrir `/outro-cliente` é barrado.
- Logout limpa o cookie de verdade — depois dele, qualquer página protegida redireciona pro login.
- Link antigo `?key=...` não funciona mais.
- `npx tsc --noEmit` e `npm run build` limpos.
