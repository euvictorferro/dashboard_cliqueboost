# Conteúdos — Upload de Vídeos (Fase 1)

## Contexto

Hoje os clientes mandam os vídeos brutos (takes) pro editor via WhatsApp. Quando um cliente grava material pra 2-3 posts no mesmo dia, os 20-30 arquivos chegam misturados, sem indicação de qual vídeo pertence a qual post — o editor perde tempo separando manualmente antes de começar a editar.

Esta fase resolve a parte estrutural do problema: dar ao cliente um lugar dedicado, dentro do próprio card do post (onde ele já lê o roteiro/briefing), pra subir os vídeos daquele post especificamente. Cada post tem sua própria pasta — a mistura deixa de ser possível.

Fica fora desta fase (fase 2, futura): qualquer IA que leia o roteiro na descrição do card e identifique automaticamente qual arquivo de vídeo corresponde a qual take, renomeando os arquivos de acordo. Nesta fase, os arquivos sobem com o nome original de fábrica (ex: `IMG_1234.mp4`).

## Escopo

- **Armazenamento em Google Drive**, não no Supabase — vídeo é pesado, e não queremos competir por espaço/custo com os dados do produto. Reaproveita o mesmo service account já usado pelo Google Calendar (`GOOGLE_SERVICE_ACCOUNT_KEY`), com escopo de Drive adicionado.
- **Estrutura de pastas**: `Clientes/<nome do cliente>/<nome do post>`. A pasta "Clientes" (ID `11gqARfhiX3DY8sllBYLB6PNSHyakWfl7`) já existe e foi compartilhada como Editor com `clique-boost-app@clique-boost-app.iam.gserviceaccount.com`. As subpastas de cliente e de post são criadas automaticamente pelo sistema na primeira necessidade — Victor não precisa criar nada manualmente.
- **Upload direto do navegador pro Drive** (não passa pelo nosso servidor) — evita limite de tamanho de request da Vercel e deixa o envio mais rápido. O backend só negocia a sessão de upload com o Drive.
- **Nova seção "Vídeos"** dentro do `ContentCardModal` já existente: seletor de arquivos (máx. 20 por post, só tipo vídeo), barra de progresso por arquivo, lista dos já enviados (nome + tamanho) com botão de remover.
- **Handoff pro editor**: no primeiro vídeo enviado de um post, o link da pasta do Drive daquele post é adicionado automaticamente como anexo (link) no card do Trello correspondente — o editor continua trabalhando 100% dentro do Trello, sem precisar abrir o dashboard.
- **Sem tabela nova no Supabase.** A pasta do Drive é a fonte de verdade (mesmo padrão já usado com o Trello para os cards — sem cache local). O vínculo card↔pasta é resolvido via `appProperties` do Google Drive (metadata custom na própria pasta), não por uma tabela.

## Fora de escopo

- IA de identificação de takes / renomeação automática baseada no roteiro (fase 2).
- Qualquer transcrição, compressão ou processamento de vídeo.
- Conta Google Workspace dedicada (usa a conta pessoal do Victor por enquanto; trocar depois é só apontar `GOOGLE_DRIVE_CLIENTS_FOLDER_ID` pra pasta nova).
- Reordenar/renomear manualmente pelo cliente dentro do nosso app (quem precisar renomear algo faz direto no Drive).
- Notificação (email/WhatsApp) pro editor quando um vídeo novo chega — o link no Trello já resolve a descoberta.

## Arquitetura

### Google Drive — acesso e estrutura

- `src/lib/googleDrive.ts` (novo, server-only): client autenticado via JWT usando `GOOGLE_SERVICE_ACCOUNT_KEY` (mesmo padrão de `googleCalendar.ts`), mas com escopo `https://www.googleapis.com/auth/drive`.
- Nova env var: `GOOGLE_DRIVE_CLIENTS_FOLDER_ID=11gqARfhiX3DY8sllBYLB6PNSHyakWfl7`.
- `findOrCreateClientFolder(clientName): Promise<string>` — busca por `name = clientName` e `parents = GOOGLE_DRIVE_CLIENTS_FOLDER_ID` via `files.list`; cria com `files.create` se não existir. Retorna o folder ID.
- `findOrCreatePostFolder(clientFolderId, cardId, cardName): Promise<{ id: string; isNew: boolean }>` — busca por `appProperties has { key='trelloCardId' and value='<cardId>' }` dentro de `clientFolderId` (robusto a renomeação do card); cria com `appProperties: { trelloCardId: cardId }` e `name: cardName` se não existir. `isNew` indica se a pasta acabou de ser criada (chave pra saber se é o primeiro upload — ver seção Trello abaixo).
- `listVideosInFolder(folderId): Promise<{ id, name, size, webViewLink }[]>` — `files.list` filtrando `mimeType contains 'video/'`.
- `initResumableUpload(folderId, fileName, mimeType, fileSize): Promise<string>` — inicia upload resumível (`POST` com `uploadType=resumable` nos metadados do Drive API), retorna a **session URI** que o Drive devolve no header `Location`. Essa URI já é auto-suficiente: o navegador faz o `PUT` do arquivo direto nela, sem precisar reenviar credencial nenhuma.
- `deleteFile(fileId): Promise<void>` — `files.delete`.

### Rotas de API (server-only, mesmo padrão de `verifyClientToken` das outras rotas de `/api/content`)

- `GET /api/content/[client]/card/[cardId]/videos` — resolve a pasta do post (cria se não existir) e retorna a lista de vídeos já enviados.
- `POST /api/content/[client]/card/[cardId]/videos/init` — recebe `{ fileName, mimeType, fileSize }`; valida tipo (`video/*`) e que a pasta tem menos de 20 arquivos; resolve/cria a pasta do post; chama `initResumableUpload`; **se a pasta acabou de ser criada** (`isNew`), adiciona o link da pasta (`webViewLink`) como anexo do card no Trello via `addAttachment` (já existe em `trello.ts`, usado hoje só pra links de referência — reaproveitar); devolve `{ uploadUrl }` pro navegador.
- `DELETE /api/content/[client]/card/[cardId]/videos/[fileId]` — confirma que o arquivo pertence à pasta do post daquele card (lista a pasta e checa se `fileId` está nela, evita apagar arquivo de outro card por ID adivinhado) e chama `deleteFile`.

### Fluxo de upload no navegador

1. Cliente seleciona (ou arrasta) até 20 arquivos de vídeo no novo componente `VideoUploadSection` (dentro de `ContentCardModal.tsx`).
2. Pra cada arquivo, em sequência (não em paralelo, pra manter simples e não sobrecarregar a conexão do cliente): `POST .../videos/init` → recebe `uploadUrl` → `fetch(uploadUrl, { method: "PUT", body: file })` direto pro Drive, com barra de progresso via `XMLHttpRequest` (`fetch` não expõe progresso de upload; usa `XHR` só nesse ponto específico).
3. Ao concluir todos, recarrega a lista via `GET .../videos`.
4. Botão de remover chama `DELETE .../videos/[fileId]` e atualiza a lista local.

### Limites e validação

- Máximo 20 vídeos por post — checado no `POST .../videos/init` (conta os já existentes na pasta) e refletido no botão de upload do frontend (desabilita ao atingir 20).
- Tipo de arquivo: só `video/*` — checado no `<input accept="video/*">` e novamente no backend (`mimeType` recebido no `init`).
- Tamanho: sem limite nosso — o Drive resumable upload aceita arquivos grandes nativamente; a única contenção é o espaço disponível na conta Google do Victor (por enquanto pessoal — trocar `GOOGLE_DRIVE_CLIENTS_FOLDER_ID` se precisar migrar pra uma conta com mais espaço).

## Testes

- Verificação ao vivo: abrir um card de teste, subir 2-3 vídeos pequenos, confirmar que aparecem na lista com progresso, e que a pasta `Clientes/<cliente>/<post>` foi criada no Drive.
- Confirmar que o link da pasta aparece como anexo no card do Trello **só na primeira vez** (segundo upload no mesmo post não duplica o anexo).
- Remover um vídeo pela lista e confirmar que some do Drive de verdade.
- Tentar subir um 21º vídeo e confirmar bloqueio.
- Tentar subir um arquivo não-vídeo (ex: PDF) e confirmar rejeição.
- `npx tsc --noEmit` e `npm run build` limpos.
