# Spec: Capa de imagem, labels acima do título, altura de coluna (página Conteúdos)

Branch: `feature-conteudos-refinamento` (mesma branch do refinamento anterior, ainda não mesclada). Segue diretamente o segundo round de feedback do Victor após revisar o preview desse refinamento.

## Contexto

O Victor revisou o preview do refinamento anterior (pop-up de card + visual estilo Trello) e pediu 4 ajustes:

1. **Bug**: colunas do board esticavam pra acompanhar a altura da coluna com mais cards. **Já corrigido** (commit `f786029`) — causa raiz era a ausência de `items-start` no flex row do board, que faz o `align-items: stretch` padrão forçar todas as colunas a acompanharem a mais alta. Fora de escopo deste documento.
2. **Pedido de produto**: quando um card do Trello tem uma imagem definida como "capa" (`cover`), mostrar essa imagem no card do board e no pop-up de detalhe, igual o Trello real faz.
3. **Pedido de produto**: labels (pills coloridos) devem aparecer acima do nome do card, não abaixo — replicando a ordem visual real do Trello.
4. **Pedido de produto**: o pop-up de detalhe deve ficar mais parecido com o card real do Trello — resolvido pelos itens 2 e 3 (capa + reordenação), sem ir além disso (confirmado com o Victor: sem painel de comentários vazio, sem mudar o tema escuro do dashboard para o tema claro do Trello).

Investigação técnica feita antes do design, usando as credenciais reais (`TRELLO_API_KEY`/`TRELLO_TOKEN` em `.env.local`):

- O campo `idAttachmentCover` no card aponta pro `id` do anexo usado como capa. Esse anexo, quando é uma imagem enviada por upload, tem um array `previews` com várias URLs de tamanhos diferentes (ex: 70x50, 250x150, 150x150, cada uma com `scaled: true|false`).
- **As URLs de preview não carregam com a autenticação simples via `?key=&token=` que o resto da API usa** (testei: retorna 401/403). Precisam de um header `Authorization: OAuth oauth_consumer_key="...", oauth_token="..."` — testei ao vivo e confirmei HTTP 200 com esse header. Isso significa que o navegador do cliente (que não tem sessão do Trello) não consegue carregar a imagem direto — precisamos de uma rota de proxy no nosso backend.
- Prevalência real de capas nos 6 boards dos clientes: Débora 1/47, Laís 2/49, Sam 2/13, Nelson 0/0, Tiago 5/23, Bela 0/43 — 10 de ~175 cards no total, presente em 4 dos 6 boards. Minoria, mas vale construir.
- `fetchClientBoard` já busca todos os anexos de cada card numa chamada só (`attachments=true` no `GET /boards/{id}/cards`), incluindo o array `previews` — não precisa de chamada nova por card, só adicionar `idAttachmentCover` aos campos buscados.

## Decisões (via brainstorming com o Victor)

1. **Branch**: continuar na `feature-conteudos-refinamento` (ainda não mesclada) — evita empilhar uma terceira branch.
2. **Proxy de imagem**: rota própria (`/api/content/[client]/cover-proxy`) que busca a imagem no Trello com o header OAuth correto e devolve os bytes pro `<img src>` do navegador do cliente apontar. Valida que a URL pedida começa com `https://trello.com/1/cards/` antes de buscar, pra não virar um proxy aberto pra qualquer URL.
3. **Tamanho do preview**: usa sempre o maior preview não-escalado (`scaled: false`) disponível do anexo de capa — mesma imagem serve tanto pro thumbnail do card quanto pro banner do pop-up (CSS decide o tamanho de exibição via `object-cover`), sem baixar dois tamanhos diferentes.
4. **Ordem no card do board**: capa (quando existe) → labels → título → descrição → linha de metadados (data/responsável/anexos) — capa e labels sobem pro topo, resto sem mudança.
5. **Pop-up de detalhe**: capa em banner de largura total no topo (quando existe), com título e botão de fechar (X) logo abaixo dela — não sobrepõe o X na imagem (decisão explícita: a cor de fundo da foto varia por card, sobrepor o X arriscaria ficar ilegível em alguns casos). Estrutura de campos (Labels/Descrição/Data/Responsável/Anexos) sem mudança.
6. **Erro de imagem** (removida, expirada, falha de rede): a rota de proxy devolve 404, o `<img>` esconde a capa via `onError` e o card/pop-up volta pro layout sem capa, sem mensagem de erro visível — mesma filosofia já usada pra data/responsável vazios.
7. **Escopo do "igualzinho ao Trello"**: capa + reordenação de labels resolvem o pedido — sem painel de comentários vazio só pela aparência, sem mudar o tema escuro do dashboard pro tema claro do Trello.

## Arquitetura

- **`src/lib/trello.ts`**: `ContentCard` ganha `coverImageUrl: string | null`. `fetchClientBoard` passa a buscar `idAttachmentCover` nos campos do card; quando presente, localiza o anexo correspondente em `c.attachments`, escolhe o maior preview com `scaled: false` (fallback pro maior `scaled: true` se não houver nenhum não-escalado) e guarda sua `url` como `coverImageUrl`. Sem anexo de capa ou sem preview disponível → `null`.
- **`src/app/api/content/[client]/cover-proxy/route.ts`** (novo): recebe `?key=<token do cliente>&url=<preview URL do Trello, URL-encoded>`. Segue o mesmo padrão de auth das rotas irmãs (`verifyClientToken`, 401 se inválido). Valida `url.startsWith("https://trello.com/1/cards/")` — rejeita com 400 qualquer outra coisa. Busca a URL com `Authorization: OAuth oauth_consumer_key="${TRELLO_API_KEY}", oauth_token="${TRELLO_TOKEN}"`; em caso de sucesso, devolve os bytes com o `Content-Type` original e `Cache-Control: private, max-age=3600`; em caso de falha (403/404/erro de rede), devolve 404.
- **`ContentPageClient.tsx` → `ContentBoard.tsx` → `ContentCard.tsx`/`ContentCardModal.tsx`**: `clientId` e `accessKey` passam a descer por toda a cadeia (hoje só `ContentPageClient` os tinha), pra montar a URL do proxy em cada `<img>`.

## Componentes

- **`ContentCard.tsx`** (modificado): quando `card.coverImageUrl` não é `null`, renderiza `<img>` de largura total (~96px de altura, `object-cover`, cantos arredondados só no topo) apontando pro proxy, antes das labels. `onError` no `<img>` esconde o elemento (estado local `coverFailed`), card volta ao layout sem capa.
- **`ContentCardModal.tsx`** (modificado): mesma lógica de capa, banner de ~160px de altura no topo do pop-up, título e X abaixo dele. Resto dos campos sem mudança.
- **`ContentBoard.tsx`** (modificado): passa `clientId`/`accessKey` adiante pros dois componentes acima — sem mudança de layout além disso (a correção de altura de coluna já foi commitada separadamente).

## Fluxo de dados

1. `ContentPageClient` busca `/api/content/[client]` (sem mudança) — a resposta já vem com `coverImageUrl` por card.
2. `ContentBoard` repassa `clientId`/`accessKey` pra cada `ContentCard`/`ContentCardModal`.
3. Cada `<img>` de capa aponta pra `/api/content/[client]/cover-proxy?key=...&url=<preview do Trello>`.
4. A rota de proxy autentica o cliente, valida a URL, busca a imagem no Trello com o header OAuth certo e devolve os bytes.

## Tratamento de erros

- Card sem capa → `coverImageUrl: null`, nenhum `<img>` renderizado (sem mudança de layout).
- Proxy recebe token inválido → 401 (mesmo padrão das rotas irmãs).
- Proxy recebe URL fora de `https://trello.com/1/cards/` → 400 (proteção contra proxy aberto).
- Trello recusa ou a imagem não existe mais → proxy devolve 404, `<img onError>` esconde a capa, sem mensagem visível.

## Testes / verificação

Sem suíte automatizada (padrão já estabelecido). Verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual: board da Débora (1 card com capa) e do Tiago (5 cards com capa) — confirmar que a imagem carrega no card do board e no pop-up; board da Bela (nenhuma capa) — confirmar que nada quebra e o layout permanece idêntico ao anterior.

## Fora de escopo (explícito)

- Painel "Comments and activity" vazio só pela aparência.
- Mudar o tema do pop-up/board do escuro (dashboard) pro claro (Trello).
- Sobrepor o botão de fechar (X) na imagem de capa do pop-up.
- Qualquer forma de upload, remoção ou edição de capa (a página continua só-leitura).
