# Sidebar — Card de Conta + Tema + Sair

## Contexto

Depois de fechar Atas (agendamento + extração de tasks) e Booster AI, o Victor revisou a UX da sidebar antes de partir pra fase de UI/UX de verdade. Duas mudanças saem desta rodada: o item "Conta" deixa de ser um ícone igual aos outros e vira um card fixo no rodapé (avatar + nome + e-mail), com um dropdown de Tema/Configurações/Sair. A parte de **Indicações com pipeline de estágios** (clicou no link → mandou mensagem → agendou call → fechou) foi discutida mas fica pra um brainstorm próprio depois — não faz parte desta spec.

## Escopo

### 1. Card de Conta no rodapé da sidebar

- Remove `"Conta"` de `ITEMS_AFTER_SOCIAL` (deixa de ser um item de nav comum, lista fica só `Atas → Booster AI`).
- Novo bloco fixo no rodapé do `<nav>`, separado do menu por uma borda (`border-t border-border`), empurrado pro fim via `mt-auto`.
- Mostra: avatar (círculo com iniciais do nome do cliente, cor derivada do próprio nome — sem upload), nome do cliente, e-mail de contato (`contact_email`, já existe em `client_settings`).
- `Sidebar` continua recebendo só `clientId`/`accessKey` como hoje — não precisa de prop nova em cada `page.tsx`:
  - Nome: resolvido localmente via `CLIENTS.find(c => c.id === clientId)` (já importável em componente client, sem segredo).
  - E-mail: buscado client-side, on mount, via `GET /api/conta/${clientId}?key=${accessKey}` (rota que já existe e já retorna `contactEmail` no payload) — sem rota nova.
- Clicar no card abre/fecha (toggle) um dropdown posicionado acima dele, com 3 opções: **Tema**, **Configurações**, **Sair**.
  - **Configurações** → link pra `/${clientId}/conta?key=...` (a página que já existe, sem mudança nela).
  - **Sair** → link pra uma página nova `/sair` (fora da área autenticada, sem `verifyClientToken`), com a mensagem "Você saiu — peça um novo link de acesso à Clique Boost". Não existe sessão/cookie real pra invalidar hoje (acesso é só token na URL) — é só uma tela informativa, preparando terreno pro login real (roadmap item 6, ainda não iniciado).
  - **Tema** → expande as 3 opções (Claro / Escuro / Sistema) inline no próprio dropdown.

### 2. Tema (Claro / Escuro / Sistema)

- Hoje o dark mode existe só via `@media (prefers-color-scheme: dark)` no `globals.css` — segue o SO, sem opção manual. Não há `next-themes` nem nenhuma lib de tema instalada.
- Implementação própria, sem biblioteca nova:
  - `globals.css` ganha `@custom-variant dark (&:where(.dark, .dark *));` (diretiva do Tailwind v4 pra fazer `dark:` responder a uma classe `.dark` no `<html>`, além do media query). As mesmas variáveis que hoje só existem dentro do `@media (prefers-color-scheme: dark) { :root { ... } }` passam a existir também dentro de um seletor `.dark { ... }` — mesmos valores, duplicados nos dois lugares (media query cobre "Sistema" quando o SO prefere escuro sem classe manual; a classe cobre a escolha explícita do cliente).
  - Novo `ThemeProvider` (Context + `useEffect`) em `src/components/ThemeProvider.tsx`: lê a preferência salva em `localStorage` (`"light" | "dark" | "system"`, chave `theme`) no mount, aplica a classe `dark` ou `light` no `<html>` (ou remove ambas se `"system"`), e expõe `theme`/`setTheme` via hook `useTheme()`.
  - `src/app/layout.tsx` envolve a árvore com `<ThemeProvider>`.
  - O bloco "Tema" do dropdown usa `useTheme()` pra mostrar qual opção está ativa e trocar ao clicar.

### 3. Fora de escopo

- Pipeline de indicações (estágios, WhatsApp bot, tracking de clique) — brainstorm separado.
- Login real (Supabase Auth) — "Sair" é só uma tela informativa por enquanto.
- Upload de foto de perfil de verdade — avatar é sempre gerado por iniciais.
- Persistir a preferência de tema no banco (fica só no `localStorage` do navegador, por dispositivo).

## Arquitetura

### Componentes novos

- `src/components/ThemeProvider.tsx` — Context Provider + hook `useTheme(): { theme: "light" | "dark" | "system"; setTheme: (t) => void }`. Lê/escreve `localStorage.theme`, aplica/remove classe `dark`/`light` em `document.documentElement`.
- `src/components/AccountCard.tsx` — recebe `clientId`, `accessKey`; busca nome via `CLIENTS.find`, e-mail via fetch a `/api/conta/[client]`; renderiza avatar + nome + e-mail + dropdown (Tema/Configurações/Sair).
- `src/app/sair/page.tsx` — página estática pública, sem auth, com a mensagem de logout.

### Modificados

- `src/components/Sidebar.tsx` — remove `"conta"` de `ITEMS_AFTER_SOCIAL`; renderiza `<AccountCard clientId={clientId} accessKey={accessKey} />` fixo no rodapé, fora do `<div>` de menu scrollável.
- `src/app/globals.css` — adiciona `@custom-variant dark (&:where(.dark, .dark *));` e duplica as variáveis do bloco `@media (prefers-color-scheme: dark)` dentro de um `.dark { ... }`.
- `src/app/layout.tsx` — envolve `children` com `<ThemeProvider>`.

## Verificação

- Abrir qualquer página de cliente e confirmar que o card de Conta aparece fixo no rodapé da sidebar, com iniciais + nome + e-mail reais.
- Clicar no card, confirmar que o dropdown abre com Tema/Configurações/Sair.
- Trocar entre Claro/Escuro/Sistema e confirmar que a interface muda de verdade (cores do `globals.css`), e que a escolha persiste ao recarregar a página (mesmo navegador).
- Clicar em Configurações, confirmar que abre `/conta` normalmente (nada mudou lá).
- Clicar em Sair, confirmar que abre `/sair` com a mensagem informativa, sem exigir token.
