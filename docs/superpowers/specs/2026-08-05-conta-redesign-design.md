# Página de Conta — redesenho completo

## Contexto

A página `/[client]/conta` nunca teve um desenho de verdade — é uma coluna estreita
(`max-w-md`, muito menor que o `max-w-[1600px]` do resto do dashboard) com 4 cards
empilhados (Perfil, Fuso horário, Faturamento, Indicação de amigos), listas de texto puro
pra pagamentos/indicações e nenhuma hierarquia visual. O Victor não tem mais paciência com
ela — quer redesenho completo (visual, organização e conteúdo), na mesma leva de UI/UX que já
resitilizou Sidebar/Header/Calendário/Booster AI/CallScheduler nesta branch.

Referência visual trazida pelo Victor: um painel de usuário estilo Clerk admin — avatar
grande e circular à esquerda, identidade (e-mail + metadado) logo abaixo, lista de ações em
texto simples com ícone (ações destrutivas em vermelho), e à direita cards brancos com borda
fina onde cada campo é um bloco preenchido cinza-claro (label em cinza acima, valor em texto
escuro dentro da caixa), com badges de status em pill (ex: "Verified" verde).

## Escopo

### 1. Estrutura da página

Duas colunas, dentro do `max-w-[1600px]` padrão (chega de coluna estreita):

- **Sub-sidebar fixa à esquerda** (~240px, não colapsável — é só desta página):
  - Card de identidade no topo: avatar do cliente (mesmo padrão de iniciais+cor de
    `src/lib/avatar.ts`, 80px), nome, e-mail de contato.
  - Abaixo, lista de navegação vertical (ícone + label, texto simples — sem bloco sólido de
    fundo como a Sidebar principal, seguindo o visual mais leve da referência): **Perfil ·
    Fuso horário · Faturamento · Indicação de amigos · Segurança**. Item ativo com texto na
    cor da marca (`text-brand-primary`) + barra vertical fina à esquerda; os outros em
    `text-muted-foreground`.
- **Conteúdo à direita**, troca de seção 100% client-side (estado local, sem navegação de
  rota — a página continua sendo uma única URL `/conta`), mostrando cards brancos com borda
  fina (`rounded-lg border border-border bg-card`, sem a sombra `shadow-soft` antiga).

### 2. Sistema visual dos campos (novo, usado em todas as seções)

Adota o padrão da referência em vez do input com borda atual:

- Label em `text-xs text-muted-foreground` acima do campo.
- Campo como bloco preenchido `bg-muted rounded-md px-3 py-2.5` (sem borda visível), texto do
  valor em `text-sm font-medium text-card-foreground`. Campos editáveis (email, fuso horário)
  usam esse mesmo visual num `<input>`/`<select>` de verdade; campos somente-leitura (nome)
  usam um `<p>` com a mesma aparência.
- Badge de status: pill pequena (`rounded-full px-2 py-0.5 text-xs font-medium`), verde
  (`bg-brand-success/10 text-brand-success`) pra estados positivos (ex: pagamento em dia),
  âmbar/vermelho pra atenção — usada no Faturamento.

### 3. Seção Perfil

- Cabeçalho horizontal: avatar grande (120px, mesmo padrão iniciais+cor) à esquerda com botão
  "Trocar foto" abaixo dele (mesmo endpoint de upload que já existe,
  `POST /api/conta/[client]/logo`).
- À direita do avatar, dois campos no padrão da seção 2: **Nome** (somente leitura, vem de
  `CLIENTS`) e **E-mail de contato** (editável, mesmo `PUT /api/conta/[client]/email` de
  hoje, com badge "Salvo" quando `emailSaveStatus === "saved"` em vez do texto verde solto
  atual).

### 4. Seção Fuso horário

Um card com label + `<select>` no padrão da seção 2 (mesmas opções de `US_TIMEZONES`) e botão
salvar — mesmo endpoint `PUT /api/conta/[client]` de hoje, só o visual novo.

### 5. Seção Faturamento

- Três blocos de destaque lado a lado no topo do card (**Plano**, **Status de pagamento** com
  badge colorida, **Tempo de contrato**) — texto grande (`text-lg font-bold`), não mais um
  grid 2x2 apertado.
- **Histórico de pagamentos** como lista tabular: cada pagamento é uma linha com borda inferior
  fina, data à esquerda e valor à direita alinhado (`tabular-nums`), em vez do `<li>` de texto
  solto atual. Mesmos dados de `payments` (endpoint inalterado).

### 6. Seção Indicação de amigos

- Campo do link de indicação no padrão da seção 2 (bloco preenchido, somente leitura) + botão
  "Copiar" ao lado (mesmo `handleCopyLink` de hoje).
- **Quem você já indicou**: lista tabular igual à de pagamentos (nome / contato / data em
  colunas alinhadas, com borda inferior fina), mesmos dados de `referralLeads`.

### 7. Seção Segurança (nova)

Card único, sem nenhuma ação disponível: título "Segurança" + parágrafo explicando que login
por e-mail/senha está no roadmap e que o acesso hoje é feito pelo link único enviado a cada
cliente. Puramente informativo.

### 8. Fora de escopo

- Nenhuma rota de API nova nem mudança de schema — todas as 6 seções reaproveitam os
  endpoints que já existem em `/api/conta/[client]/*`.
- Upload de foto continua sendo o mesmo mecanismo (sem crop/preview novo).
- Login real, geração/regeneração de link de acesso, 2FA — ficam fora, é só o aviso da seção 7.
- Navegação por âncora/URL entre seções (ex: `?section=faturamento`) — troca é só estado local
  em memória; recarregar a página sempre volta pra "Perfil".

## Arquitetura

### Componentes novos

- `src/components/ContaSidebar.tsx` — recebe `clientId`, `client` (nome), `email`, `active`
  (seção atual) e `onSelect`; renderiza o card de identidade + a lista de navegação da seção 1.
- `src/components/ContaField.tsx` — pequeno componente de apresentação pro padrão de campo da
  seção 2 (`label`, `value`/`children`, `badge?`), reaproveitado pelas seções de Perfil, Fuso
  horário e Indicações.
- Um subcomponente por seção (`ContaPerfilSection.tsx`, `ContaFusoSection.tsx`,
  `ContaFaturamentoSection.tsx`, `ContaIndicacoesSection.tsx`, `ContaSegurancaSection.tsx`),
  cada um recebendo só os dados/handlers que precisa — evita um `ContaPageClient.tsx` de 300+
  linhas fazendo tudo (o problema que já existe hoje).

### Modificado

- `src/components/ContaPageClient.tsx` — vira o orquestrador: mantém o `fetch` inicial e os
  handlers de salvar (mesma lógica de hoje), guarda a seção ativa em `useState`, e renderiza
  `ContaSidebar` + a seção correspondente. Estrutura de dados (`Payment`, `ReferralLead`, etc)
  inalterada.

## Verificação

- Abrir `/[client]/conta`, confirmar que a página usa a largura cheia (`max-w-[1600px]`) com
  sub-sidebar à esquerda e conteúdo à direita.
- Clicar em cada item da sub-sidebar (Perfil, Fuso horário, Faturamento, Indicação de amigos,
  Segurança) e confirmar que troca o conteúdo sem reload, com o item ativo destacado.
- Em Perfil: trocar a foto (upload real) e editar/salvar o e-mail, confirmar que persiste ao
  recarregar a página.
- Em Fuso horário: trocar o fuso e salvar, confirmar no Calendário/Atas que o horário exibido
  mudou.
- Em Faturamento: confirmar que plano/status/contrato aparecem nos blocos de destaque e que o
  histórico de pagamentos (se houver dados no cliente de teste) aparece em lista tabular.
- Em Indicação de amigos: copiar o link, confirmar que funciona; confirmar que a lista de
  indicados (se houver) aparece em colunas alinhadas.
- Em Segurança: confirmar que mostra só o aviso, sem nenhum campo editável.
