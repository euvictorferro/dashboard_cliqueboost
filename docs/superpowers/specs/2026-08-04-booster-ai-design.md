# Booster AI — Chat com IA restrito aos dados do cliente

## Contexto

Item do roadmap original (`Dashboard App Insights.md`, L2 "Agente de AI personalizado — página 'Booster AI'"): um chat onde o cliente conversa com um bot que conhece os números e conteúdos da própria conta. Retomado nesta rodada, depois de fechar Sidebar (reordenada: Dashboard, Tasks, Social Media, Atas, Conta) e a fatia de Agendamento de Call + Extração de Tasks. O Victor já vai fornecer a `ANTHROPIC_API_KEY` — esta é a última funcionalidade planejada que depende dela por enquanto.

## Escopo

### Fontes de dados que o bot acessa

Todas as quatro já existentes no app, sem introduzir fonte nova:
- **Métricas** (`getOrganicSnapshot` de `src/lib/metrics.ts`) — alcance, engajamento, seguidores, top posts por período (7d/30d/90d).
- **Conteúdos** (`fetchClientBoard` de `src/lib/trello.ts`) — cards do quadro Trello do cliente (ideias, status, datas).
- **Tasks** (`fetchClientTasks` de `src/lib/clickup.ts`) — tarefas do ClickUp do cliente.
- **Atas** (`fetchCallNotes` de `src/lib/callNotes.ts`) — atas de reuniões já registradas.

### Isolamento por cliente (segurança)

- O `clientId` vem exclusivamente da rota autenticada (`verifyClientToken`, mesmo padrão de toda `/api/atas/...`) — nunca do corpo da requisição nem de algo que o modelo possa influenciar.
- Cada tool exposta ao modelo recebe o `clientId`/IDs associados (Trello board, ClickUp list) já fixados pelo servidor antes de chamar a IA — o modelo nunca recebe um parâmetro "client_id" que possa preencher livremente. Fisicamente não há como o bot buscar dado de outro cliente.
- Se `client.trelloBoardId` ou `client.clickupListId` não existir (campos opcionais em `Client`), a tool correspondente retorna uma mensagem estruturada tipo `{ error: "not_configured" }` em vez de quebrar — o modelo informa ao cliente que aquela informação não está disponível.
- Prompt de sistema instrui o modelo a responder só sobre a conta do próprio cliente (nome do cliente incluído no prompt) e a não especular sobre outras contas/clientes da agência.

### Tool use (agentic loop)

- Loop server-side: manda a mensagem + histórico recente pro Claude com as 4 tools disponíveis (`tool_choice: "auto"`, não forçado) → se o modelo pedir uma tool, o servidor executa a função real correspondente, devolve o resultado como `tool_result`, repete → quando o modelo responde só com texto, essa é a resposta final, que é transmitida via streaming pro navegador.
- Sem RAG/embeddings — volume de dados por cliente é pequeno o suficiente pra caber direto no contexto de uma chamada de tool.

### Streaming

- A rota de chat usa a Messages API da Anthropic em modo streaming (`stream: true`), repassando os eventos como Server-Sent Events pro cliente via `ReadableStream` do Next.js — mesmo runtime Node usado no resto do projeto, sem biblioteca nova.
- Chamadas de tool não são "streamadas" (só a resposta final em texto); durante uma chamada de tool, a UI mostra um indicador de "pesquisando..." em vez de texto parcial.

### Persistência

- Nova tabela `chat_messages`: `id`, `client_id`, `role` (`"user"` | `"assistant"`), `content` (texto), `created_at`. RLS ligado, sem policies (Service Role only), mesmo padrão do resto do projeto.
- Ao abrir a página, carrega as últimas N mensagens (definir N generoso o bastante pra dar contexto, ex: 50) via `GET /api/booster-ai/[client]/messages`.
- Mensagens de tool call/tool result **não são persistidas** — só a pergunta do usuário e a resposta final em texto do assistente. Isso mantém o histórico legível (o cliente não precisa ver "chamando buscar_metricas...") e simplifica: cada rodada de conversa, ao ser recarregada do histórico, começa do zero de contexto de tools (sem histórico de tool calls antigos re-enviados pro modelo) — aceitável porque cada pergunta nova pode re-disparar as tools que precisar.

### Limite de uso

- Contagem de mensagens do tipo `role = "user"` em `chat_messages` no dia corrente (`created_at::date = hoje`, calculado no fuso do cliente — reaproveita `fetchClientSettings` pro timezone).
- Acima de 50 mensagens de usuário no dia, a rota de chat recusa novas mensagens com erro claro (`429`), e a UI mostra aviso "Limite diário de mensagens atingido, volta amanhã."

## Fora de escopo

- RAG/embeddings, busca semântica sobre histórico de atas antigas — o volume atual não justifica.
- Multi-idioma — bot responde em português, como o resto do app.
- Ações (o bot não cria/edita tasks, conteúdos ou atas através do chat nesta versão — só consulta e responde). Fica pra uma rodada futura se fizer sentido.
- Analytics/scraping de perfil do Instagram (isso é a feature separada "Análise AI das métricas" do roadmap, L1, ainda não desenhada).
- Rate limit por IP ou por token (o limite é só por `client_id`/dia).

## Arquitetura

### Banco de dados

Nova migration `0015_chat_messages.sql`:
```sql
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;
```

### Camada de dados

- `src/lib/chatMessages.ts` (novo): `fetchRecentMessages(clientId: string, limit: number): Promise<ChatMessage[]>`, `saveMessage(clientId: string, role: "user" | "assistant", content: string): Promise<void>`, `countMessagesToday(clientId: string, timeZone: string): Promise<number>`. `ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: number }`.

### Tools

- `src/lib/boosterAiTools.ts` (novo): define as 4 tools no formato da Anthropic API (`name`, `description`, `input_schema`) e um dispatcher `runTool(name: string, input: unknown, client: Client): Promise<unknown>` que chama a função real correspondente (`getOrganicSnapshot`, `fetchClientBoard`, `fetchClientTasks`, `fetchCallNotes`) usando os IDs já resolvidos do `client` (nunca aceita `clientId` vindo do `input` do modelo).

### Rota de chat

- `src/app/api/booster-ai/[client]/chat/route.ts` (novo) — `POST`, streaming. Fluxo: `verifyClientToken` → checa limite diário → salva a mensagem do usuário → roda o loop agente (Anthropic Messages API + tools) → transmite a resposta final via stream → ao terminar, salva a resposta completa do assistente.
- `src/app/api/booster-ai/[client]/messages/route.ts` (novo) — `GET`, retorna `{ messages: ChatMessage[] }` das últimas 50.

### UI

- `src/app/[client]/booster-ai/page.tsx` (novo) — mesmo padrão server component de auth das outras páginas (`verifyClientToken`, `Sidebar` com `active="booster-ai"`).
- `src/components/BoosterAiPageClient.tsx` (novo) — lista de mensagens + input, consome streaming via `fetch` com leitura de `ReadableStream` (sem biblioteca de chat nova).
- `src/components/Sidebar.tsx` — adiciona `"booster-ai"` ao tipo `ActiveKey`, item novo "Booster AI" entre Atas e Conta (dentro de `ITEMS_AFTER_SOCIAL`, antes de Conta).

## Verificação

- Com `ANTHROPIC_API_KEY` configurada, abrir `/[client]/booster-ai`, perguntar "como foi meu alcance nos últimos 30 dias?" e confirmar que o bot chama `buscar_metricas` e responde com números reais do cliente.
- Perguntar algo sobre atas/tasks/conteúdos e confirmar que a tool certa é chamada.
- Recarregar a página e confirmar que o histórico persiste.
- Mandar mais de 50 mensagens no mesmo dia (ou simular via insert direto na tabela) e confirmar que a 51ª é recusada com a mensagem de limite.
- Confirmar visualmente que a resposta aparece com efeito de streaming, não tudo de uma vez.
