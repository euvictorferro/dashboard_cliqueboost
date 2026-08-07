# Conteúdos — IA de identificação de takes (Fase 2)

## Contexto

A Fase 1 (em produção) deu ao cliente um lugar dedicado, dentro do próprio card do post, pra subir os vídeos brutos (takes) daquele post especificamente, organizados em pastas no Google Drive (`Clientes/<cliente>/<post>`). Os arquivos sobem hoje com o nome original de fábrica (ex: `IMG_1234.mp4`) — o editor ainda precisa abrir cada vídeo manualmente pra descobrir qual take é qual, comparando com o roteiro escrito na descrição do card do Trello.

Esta fase fecha esse gap: ao final de um lote de upload, o sistema transcreve os vídeos novos, lê o roteiro (texto livre, sem estrutura formal, na descrição do card do Trello) e usa um LLM pra casar cada vídeo com o take correspondente, renomeando o arquivo no Drive (ex: `take1.mp4`, `take2.mp4`). Vídeos que a IA não consegue casar com confiança mantêm o nome original e geram um aviso no card do Trello pro editor conferir manualmente — nunca renomeia no escuro.

## Escopo

- **Gatilho automático**: dispara sozinho ao final do lote de upload no frontend (mesmo ponto onde hoje `ContentCardVideoField.tsx` chama `refreshVideos()`), sem exigir clique extra do cliente.
- **Transcrição via Groq Whisper API** (`whisper-large-v3-turbo`) — hospedado, sem infra própria, é a opção mais barata disponível hoje pra esse volume.
- **Matching por LLM**, não regex: a descrição do card não tem formato estruturado hoje (não há garantia de "Take 1:", "Take 2:" etc.), então o casamento entre roteiro e transcrições é feito por um LLM lendo a descrição crua + as transcrições de todos os vídeos pendentes do post de uma vez, devolvendo um mapeamento estruturado (JSON).
- **Rename seletivo**: só os vídeos com match de alta confiança são renomeados no Drive. Os de baixa confiança ou sem match mantêm o nome original e entram num comentário no card do Trello (`addComment`, já existe em `trello.ts`) listando o que precisa de revisão manual.
- **Idempotência**: vídeos já renomeados (nome já no padrão `take\d+`) não são retranscritos/reprocessados em uploads incrementais subsequentes do mesmo post.
- **Sem tabela nova no Supabase** — mesmo padrão da Fase 1: Drive e Trello são a fonte de verdade, processamento sob demanda, sem cache local.

## Fora de escopo

- Reprocessar/renomear manualmente pelo cliente ou editor dentro do app (quem quiser corrigir um nome faz direto no Drive, como hoje).
- Qualquer edição/corte/compressão de vídeo — só transcrição pra fim de identificação, o arquivo em si não é tocado além do rename.
- Notificação por email/WhatsApp sobre takes identificados — o comentário automático no Trello já resolve a descoberta pro editor.
- Retry automático de transcrição em caso de falha da Groq — falha nessa fase só significa que o vídeo fica com nome original (mesmo estado de "não processado ainda"), sem bloquear o upload em si.

## Arquitetura

### `src/lib/googleDrive.ts` (função nova)

- `renameFile(fileId: string, name: string): Promise<void>` — `PATCH files/{fileId}` via o helper `driveFetch` já existente (mesmo padrão de `findOrCreateClientFolder`).

### `src/lib/videoTakes.ts` (novo, server-only)

- `transcribeVideo(fileId: string): Promise<string>` — busca os bytes do vídeo no Drive (`files.get?alt=media`) e envia pra Groq Whisper API (`whisper-large-v3-turbo`), retorna o texto transcrito.
- `matchTakesToScript(description: string, transcripts: { fileId: string; name: string; transcript: string }[]): Promise<{ fileId: string; take: string | null; confidence: "high" | "low" }[]>` — chamada de LLM (provider a definir na implementação — projeto ainda não integra nenhum SDK de IA) com a descrição do card e as transcrições, prompt pedindo JSON estruturado de volta com o take sugerido e o nível de confiança por vídeo.

### Rota nova: `POST /api/content/[client]/card/[cardId]/videos/match-takes`

Mesmo padrão de autenticação (`verifyClientToken`) das demais rotas de `/api/content`.

1. Busca a descrição do card via Trello.
2. Lista os vídeos da pasta do post (`listVideosInFolder`).
3. Filtra os que ainda não têm nome no padrão `take\d+` (evita reprocessar).
4. Transcreve os pendentes (`transcribeVideo`, em sequência ou paralelo controlado).
5. Chama `matchTakesToScript` com a descrição + transcrições.
6. Aplica `renameFile` nos de `confidence: "high"`.
7. Se houver algum de baixa confiança ou sem match, chama `addComment` no card do Trello listando os arquivos (nome original) que precisam de revisão manual.

### Frontend: `src/components/ContentCardVideoField.tsx`

- Ao final de `handleFilesSelected` (mesmo ponto onde hoje roda `refreshVideos()`), dispara `POST .../match-takes` de forma assíncrona — não bloqueia a UI, é mais lento por causa da transcrição.
- Exibe um estado leve tipo "Identificando takes..." enquanto roda, e recarrega a lista de vídeos (nomes atualizados) ao terminar.

## Env vars novas

- `GROQ_API_KEY`
- Chave do provider de LLM escolhido pro matching (`OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` — decisão de implementação).

## Testes

- Card de teste com roteiro descrevendo 2-3 takes distintos na descrição; subir 2-3 vídeos correspondentes; confirmar rename correto no Drive.
- Subir um vídeo sem relação com o roteiro junto ao lote — confirmar que NÃO é renomeado e que gera comentário no Trello avisando.
- Rodar o fluxo duas vezes no mesmo post (upload incremental) — confirmar que vídeos já renomeados (`take\d+`) não são retranscritos.
- Simular falha da Groq (ex: chave inválida temporariamente) — confirmar que o upload em si não quebra, só o rename não acontece.
- `npx tsc --noEmit` e `npm run build` limpos.
