# Report de Bug — cliente reporta problema pela plataforma

## Contexto

Não existe hoje nenhum canal estruturado pro cliente avisar quando algo quebra na
plataforma — só WhatsApp direto com o Victor. Ele quer um formulário simples dentro do
dashboard: cliente escolhe a página com problema, descreve o que aconteceu, anexa print(s), e
isso fica guardado. Sem painel admin ainda (é outro item de roadmap) e sem notificação por
e-mail/Slack — o Victor pede pra eu checar quando quiser saber se tem algo novo, mesmo padrão
já usado pro faturamento manual.

## Escopo

### 1. Entry point

Novo item **"Reportar bug"** no dropdown de conta (`AccountCard.tsx`), na lista junto com
Ajustes/Tema/Sair (entre Ajustes e o bloco de Tema, antes do Sair). Abre um modal
(`BugReportModal`) por cima da página atual — sem navegar pra rota nova.

### 2. Formulário

Dentro do modal:

- **Dropdown "Página com o problema"**: opções = as 8 páginas de cliente (Dashboard, Tasks,
  Conteúdos, Calendário, Atas, Bunker, Booster AI, Conta) + **"Outra"**. Pré-seleciona a página
  em que o cliente estava quando abriu o modal (via o `pageLabel` que o `AppFrame`/`Header` já
  recebem — sem heurística nova, é só passar esse valor como default do modal).
- **Textarea "O que aconteceu?"**: obrigatório, sem limite de caracteres.
- **Upload de imagens**: até 3 arquivos, mesmos tipos aceitos hoje no upload de foto
  (`image/png`, `image/jpeg`; adiciona `image/webp` por ser comum em prints) e mesmo teto de
  tamanho (2MB por arquivo — igual ao upload de logo). Preview em miniatura de cada imagem
  selecionada, com botão de remover antes de enviar.
- **Botão "Enviar"**: desabilitado enquanto a descrição estiver vazia ou o envio estiver em
  andamento.

### 3. Confirmação

Depois do envio bem-sucedido, o conteúdo do modal é substituído (mesmo modal, não fecha
sozinho) por:

- Ícone de check verde (mesmo ícone/estilo já usado na confirmação de call agendada do
  `CallScheduler`).
- "Enviamos o erro para nosso time."
- "Nosso time de developers vai analisar o erro e corrigi-lo assim que possível. Agradecemos
  pelo seu feedback."
- Botão "Fechar" (ou clicar fora do modal) — fecha e reseta o formulário pro próximo uso.

Em caso de erro de envio, mensagem de erro simples + deixa o formulário preenchido pra
tentar de novo (não perde o que o cliente já escreveu).

### 4. Fora de escopo

- Painel pro Victor ver os reports dentro da própria plataforma — é Admin, fica pra depois.
- Notificação automática (e-mail/Slack/push) quando um report chega.
- Editar/responder/marcar como resolvido — é só criação, sem fluxo de acompanhamento ainda.
- Rate limiting / anti-spam — só 6 clientes autenticados por token, risco desprezível por
  enquanto.

## Arquitetura

### Banco de dados (nova migration)

```sql
-- supabase/migrations/0017_bug_reports.sql
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  page text not null,
  description text not null,
  screenshot_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de referral_leads/chat_messages.
alter table bug_reports enable row level security;
```

Bucket novo no Supabase Storage: **`bug-report-screenshots`** (público, mesmo padrão de
`client-logos`) — precisa ser criado manualmente no dashboard do Supabase (buckets não vão em
migration SQL, confirmado na spec anterior da Conta).

### Backend

- `src/lib/bugReports.ts` (server-only, mesmo padrão de `referralLeads.ts`):
  `createBugReport(clientId: string, page: string, description: string, screenshotUrls:
  string[]): Promise<void>`.
- `src/app/api/bug-reports/[client]/route.ts` — `POST`: valida token
  (`verifyClientToken`), valida `page`/`description` não vazios, sobe os arquivos de imagem
  recebidos (`FormData`, campo `screenshots`, até 3) pro bucket `bug-report-screenshots` sob o
  path `${clientId}/${crypto.randomUUID()}.${ext}` (mesmo padrão de extensão/validação de tipo
  do upload de logo, mas sem `upsert` — cada report é um arquivo novo, não substitui nada),
  monta a lista de URLs públicas, chama `createBugReport`, responde `{ ok: true }`.

### Frontend

- `src/components/BugReportModal.tsx` (novo, `"use client"`): recebe `clientId`, `accessKey`,
  `currentPageLabel` (pra pré-selecionar o dropdown), `onClose`. Estado: campos do formulário +
  `status: "form" | "sending" | "sent" | "error"`. Renderiza o formulário ou a tela de
  confirmação conforme o `status`.
- `src/components/AccountCard.tsx` (modificado): adiciona o item "Reportar bug" no dropdown,
  com estado local `bugModalOpen` que renderiza `<BugReportModal />` quando `true`. Precisa do
  `pageLabel` da página atual — como `AccountCard` só recebe `clientId`/`accessKey` hoje, o
  `pageLabel` sobe como prop nova vinda do `AppFrame` (que já tem esse valor, recebido de cada
  `page.tsx`).

## Verificação

- Abrir qualquer página de cliente, abrir o dropdown de conta, clicar em "Reportar bug".
- Confirmar que o dropdown de página já vem pré-selecionado com a página atual.
- Preencher descrição, anexar 1-2 imagens, enviar — confirmar tela de confirmação com o texto
  exato pedido.
- Confirmar no Supabase (Table Editor) que a linha foi criada em `bug_reports` com os campos
  certos e que as URLs de screenshot abrem as imagens.
- Tentar enviar sem descrição — botão deve ficar desabilitado.
- Fechar o modal e reabrir — formulário deve estar limpo (não deve reaproveitar dados do envio
  anterior).
