# Spec: Página Conteúdos (Kanban do Trello)

Branch: `feature-conteudos-trello`. Item #3 do roadmap Fase A (`docs/superpowers/ROADMAP-plataforma.md`).

## Contexto

A Clique Boost já usa o Trello de verdade como calendário/banco de ideias de conteúdo por cliente. Assim como a página Tasks acabou virando um espelho só-leitura do ClickUp (em vez de um sistema novo do zero), "Conteúdos" segue o mesmo caminho: espelha o board real do Trello de cada cliente, sem duplicar dado nem exigir que a equipe mude de ferramenta.

Board do Trello confirmado por cliente (mapeamento `client.id` → board):

| client.id | Nome do board | Board ID |
|---|---|---|
| debora | Debora Segnini | 6a45322767a3396275720779 |
| lais | Lais Daltrozo | 6a1d9bfebe2405767f61e0d6 |
| sam | Sam Fernandes | 68dacb7ba8957ca2511e9071 |
| nelson | Nelson | 6a62cc0c3349ba1222b431e0 |
| tiago | Tiago Zamboni | 6a15e2cce98811c102520e22 |
| bela | Bela Castro | 68f4f4c34ad83399f540858a |

As listas (colunas) variam por cliente — não existe um conjunto fixo. Exemplos reais confirmados:
- Débora: Ideias, Stories Diários, Semana 1-4, Postados
- Laís: Backlog, Última Semana, Semana 1-4, Postado
- Bela: Backlog, 📱 Stories, Semana 1-4, Postado

Investigação real feita antes do design: testei os cards reais do board da Débora (47 cards). `due` (data prevista) e `idMembers` (responsável) estão vazios em 100% dos cards hoje — o controle de "quando" é feito pela própria coluna ("Semana X"), não pelo campo de data do Trello. Só 3 de 47 cards têm anexo (sempre um link, nunca upload de arquivo). Labels (`Instagram`, `Facebook`, etc., com cor própria do Trello) são usados em todos os cards.

## Decisões (via brainstorming com o Victor)

1. **Fonte de dados**: espelha o board real do Trello de cada cliente — só leitura, sem escrita nessa versão.
2. **Layout**: Kanban de verdade — colunas lado a lado, com scroll horizontal, uma coluna por lista do Trello (nomes e ordem exatamente como estão no board de cada cliente, não hardcoded).
3. **Campos do card**: nome, descrição, labels coloridos, data prevista, responsável, link de anexo quando existir. Data prevista e responsável entram mesmo estando vazios hoje em quase todos os cards — o Victor quer os campos prontos pra quando a equipe passar a preencher.
4. **"Bunker de Ideias"**: não é uma feature separada — a coluna "Ideias"/"Backlog" que já existe em cada board aparece normal, junto das outras colunas do Kanban. Sem formulário de envio de ideia nessa versão (isso seria a primeira escrita real no Trello via app, fora de escopo agora).

## Arquitetura

- **`src/lib/clients.ts`**: `Client` ganha um campo opcional `trelloBoardId?: string`, preenchido pros 6 clientes conforme a tabela acima.
- **`src/lib/trello.ts`** (novo, server-only — mesmo aviso de `meta.ts`/`clickup.ts`: nunca importar de um componente `"use client"`):
  - `hasTrelloCredentials(): boolean` — checa `process.env.TRELLO_API_KEY` e `process.env.TRELLO_TOKEN`.
  - `fetchClientBoard(boardId: string): Promise<ContentList[]>` — 2 chamadas em paralelo: `GET /boards/{id}/lists` (nome, id, ordem) e `GET /boards/{id}/cards?attachments=true` (nome, descrição, labels, due, idMembers, attachments — 1 chamada só, sem N+1 por card; `attachments=true` é obrigatório, testado ao vivo nesta sessão, sem ele o campo vem vazio). Agrupa os cards na lista correspondente (`idList`) e ordena tanto as listas quanto os cards dentro de cada lista pelo campo `pos` que o Trello já devolve (mesma ordem visual que o board real tem).
- **`src/app/api/content/[client]/route.ts`** (novo): mesmo padrão de auth (`verifyClientToken`) das rotas irmãs (`/api/tasks/[client]`, `/api/organic/[client]`) — resolve `client.trelloBoardId` → chama `fetchClientBoard` → devolve JSON.
- **`src/app/[client]/conteudos/page.tsx`** (novo): resolve `client`/`accessKey` do mesmo jeito que `tasks/page.tsx` já faz (checagem de token própria, já que layouts do Next.js não recebem `searchParams` — mesma limitação já documentada na feature anterior), renderiza `<Sidebar active="conteudos">` + `<ContentPageClient>`.
- **`Sidebar.tsx`**: ganha um 3º item, "Conteúdos", com um ícone novo (coluna de kanban — 3 retângulos verticais).

## Componentes

- **`ContentBoard.tsx`** (novo): recebe as listas já buscadas, renderiza uma coluna por lista, lado a lado, com `overflow-x-auto` na direção horizontal. Cada coluna tem o nome da lista real (sem tradução/hardcode) e a contagem de cards, no mesmo estilo visual dos cabeçalhos de seção já usados em Tasks.
- **`ContentCard.tsx`** (novo): nome, descrição (truncada, sem quebrar o card), labels (pills coloridos, cor exata que vem do Trello — um card pode ter mais de um), data prevista ("Sem prazo" quando vazio), responsável ("Sem responsável" quando vazio), anexos (ícone + abre em nova aba) — se houver mais de um anexo no mesmo card, mostra todos como uma lista pequena de links, não só o primeiro.
- **`ContentPageClient.tsx`** (novo, `"use client"`): mesmo padrão de `TasksPageClient.tsx` — busca `/api/content/[client]`, estados de carregando/erro, renderiza `ContentBoard` quando os dados chegam.

## Fluxo de dados

1. `conteudos/page.tsx` verifica o token (como `tasks/page.tsx` já faz) e renderiza `Sidebar` + `ContentPageClient`.
2. `ContentPageClient` busca `/api/content/${client.id}?key=${accessKey}` ao carregar.
3. A rota resolve `client.trelloBoardId`, chama `fetchClientBoard`, devolve as listas com os cards já agrupados e ordenados.
4. `ContentBoard` renderiza uma coluna por lista, na ordem que o Trello define.

## Tratamento de erros

- Falha na API do Trello → mensagem inline "Não foi possível carregar os conteúdos agora." Sem mock (não existe mock natural pra isso, mesma decisão já tomada em Tasks).
- Cliente sem `trelloBoardId` configurado → mensagem "Nenhum board configurado pra esse cliente."
- Autenticação: mesmo padrão já existente (token inválido → `AccessDenied`).

## Testes / verificação

- Sem suíte automatizada (padrão já estabelecido) — verificação via `curl` direto na API do Trello (já validado nesta sessão) e checagem visual no Browser pane com o board real de um cliente com volume (Débora, 47 cards).

## Fora de escopo (explícito)

- Criar, editar, mover ou excluir cards (escrita no Trello) — inclusive o "Bunker de Ideias" original do roadmap, que descrevia o cliente enviando uma ideia nova.
- Upload de anexos.
- Qualquer automação/acompanhamento semanal de perfis referenciados (isso é Fase B, precisa de scraping pago).
- Sincronização em tempo real — sempre busca ao vivo no carregamento da página.
