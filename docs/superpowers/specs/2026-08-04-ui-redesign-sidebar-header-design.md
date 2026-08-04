# UI Redesign — Sidebar + Header (nova identidade visual)

## Contexto

Início da fase de UI/UX combinada com o Victor. Escopo desta rodada: Sidebar, Header (novo), Conta/Configurações, Bunker, Atas/Agendamento, Booster AI. **Dashboard, Conteúdos e Tasks ficam como estão** — não fazem parte do redesign.

Direção visual escolhida: repensar do zero, inspirado num estilo neutro/shadcn (referência trazida pelo Victor: paleta cinza neutro, bordas finas, `rounded-md`, hover sutil em preto/branco 5%, ícones lucide finos, grupos com headings uppercase pequenos, item ativo em bloco escuro sólido). Validado via mockup no companion visual — aprovado.

Esta spec cobre a primeira peça: **Sidebar + Header**. As demais páginas (Conta, Bunker, Atas, Booster AI) entram em specs seguintes, já usando essa base visual.

## Escopo

### Sidebar — novo visual

- Paleta neutra: fundo `#fafafa`, borda `#e5e5e7`, texto `#4b5563` (inativo) / `#111827` (ativo/hover), item ativo em bloco escuro sólido (`#111827` bg, texto branco) — substitui a barrinha lateral roxa atual.
- Logo real (`<Logo />`, já existe) no topo, sem card de marca extra.
- Busca com **Cmd+K** logo abaixo do logo (por enquanto só navegação entre páginas/seções, sem busca de conteúdo).
- Estrutura de nav mantém os itens atuais: Dashboard, Tasks, Social Media (grupo colapsável com Conteúdos/Calendário/Bunker), Atas, Booster AI — mesma ordem de hoje.
- Sub-itens (dentro de Social Media) recuados com linha vertical fina à esquerda, mesmo padrão do mockup.
- Card de Conta no rodapé mantém o conteúdo (avatar+nome+e-mail+dropdown) já construído na rodada anterior, só com o novo estilo visual (cores/bordas neutras em vez das cores brand atuais).
- Sidebar ganha botão de **colapsar/expandir** (esconde labels, mostra só ícones, ou esconde completamente — decidir no detalhe da implementação).

### Header novo

- Barra fixa no topo do conteúdo de cada página (hoje não existe nenhum header — páginas começam direto no conteúdo).
- Mostra: botão de colapsar a sidebar + breadcrumb (`Nome do Cliente / Nome da Página`).
- Aparece em toda página autenticada de cliente (mesmo componente `Sidebar`/layout usado hoje).

### Cmd+K (busca)

- Atalho de teclado (`Cmd+K` / `Ctrl+K` no Windows) abre um modal de busca.
- Escopo inicial: só navegação — lista as páginas disponíveis (Dashboard, Tasks, Conteúdos, Calendário, Bunker, Atas, Booster AI, Conta) e filtra por texto digitado; selecionar uma leva pra ela. Sem busca de conteúdo (tasks, atas etc) por enquanto.

## Fora de escopo desta spec

- Redesign de Dashboard, Conteúdos, Tasks (não entram no UI/UX desta fase).
- Redesign de Conta, Bunker, Atas, Booster AI (specs seguintes, usando esta base).
- Busca de conteúdo real dentro do Cmd+K (só navegação por enquanto).
- Banner/pipeline de indicações (fica pro brainstorm próprio já combinado).

## Verificação

- Abrir qualquer página de cliente e confirmar visualmente que a sidebar e o header seguem o novo estilo.
- Cmd+K abre o modal de busca, filtra por texto, Enter/clique navega.
- Botão de colapsar esconde/mostra a sidebar.
- Nada quebra nas páginas que não fazem parte do redesign (Dashboard, Conteúdos, Tasks continuam funcionando, só herdam a sidebar/header novos).
