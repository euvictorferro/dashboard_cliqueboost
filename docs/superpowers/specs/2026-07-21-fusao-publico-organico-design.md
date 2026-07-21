# Fusão da aba "Público" dentro de "Orgânico" + redesign chart-forward

## Contexto

A aba "Público" (demografia de audiência) foi construída e aprovada tecnicamente, com dado real funcionando (spec anterior: `2026-07-20-publico-demografia-design.md`). Depois de ver em produção, o Victor achou o visual "sem graça" — tudo em listas de barra horizontal, repetindo "Sem dado suficiente" em cada card quando a conta não tem engajamento suficiente. Pediu duas mudanças: (1) trocar o gráfico de "Alcance por origem e tipo de conteúdo" por gráfico de pizza, e (2) eliminar a aba "Público" como conceito separado, levando o conteúdo pra dentro da aba "Orgânico", com um visual mais trabalhado.

Validado por 2 rodadas de mockup visual aprovadas nesta sessão.

## Decisões

**Navegação**: a aba "Público" deixa de existir. `Dashboard.tsx` volta a ter só `Orgânico | Ads`. O conteúdo de audiência (Gênero, Idade, Países, Cidades, Alcance por origem/tipo de conteúdo) vira a **última seção da página Orgânico**, depois do Top 5 posts.

**Dois filtros de período, sem conflito**: o filtro livre existente (1/7/14/30/60/90 dias) continua controlando seguidores/alcance/engajamento/posts, como já funciona hoje. A nova seção de audiência mantém seu **próprio filtro** (Esta semana/Este mês/Últimos 30/90 dias — as únicas janelas que a Meta aceita pra demografia), visualmente perto do título da seção, não junto do filtro principal, pra ficar claro que controlam coisas diferentes.

**Visual chart-forward**:
- **Gênero**: gráfico de pizza (Recharts `PieChart`), com legenda ao lado mostrando label + %.
- **Idade**: gráfico de barras (Recharts `BarChart`), mas em **ordem natural de faixa etária** (13-17 → 65+), não ordenado por %. A API/mock hoje devolve todas as faixas ordenadas por %; o componente de gráfico reordena pra ordem etária antes de desenhar — não precisa mudar a camada de dados.
- **Países**: lista ranqueada com bandeira (emoji, derivado do código ISO do país) + nome + % — mantém o estilo de barra horizontal que já existe hoje.
- **Cidades**: mesma lista ranqueada, sem bandeira (cidade não tem bandeira própria).
- **Alcance por origem e tipo de conteúdo**: os dois blocos de texto viram dois gráficos de pizza pequenos lado a lado (seguidor-vs-não-seguidor; posts/stories/reels/anúncios).

**Coluna "Engajados" vazia**: hoje, quando a conta não bate o mínimo de 100 engajamentos no período, cada um dos 4 cards mostra seu próprio "Sem dado suficiente" na coluna Engajados — repetitivo. Novo comportamento: calcular uma vez se **qualquer** uma das 4 dimensões de Engajados tem dado (`age`/`gender`/`country`/`city` não vazios); se nenhuma tiver, a seção inteira de Engajados some (os 4 gráficos ficam com largura cheia, só a coluna Seguidores) e aparece **um único aviso**, uma vez, no topo da seção de audiência — não mais 4 vezes.

Isso é uma granularidade nova: o `hasEnoughData` que já existe no `AudienceSnapshot` continua servindo pro caso mais raro (nem Seguidores nem Engajados têm dado — a conta é pequena demais até pra demografia de seguidor) — nesse caso extremo a seção inteira continua sendo substituída pelo aviso atual. O novo cálculo de "Engajados tem dado" é derivado no componente, sem mudar o formato de `AudienceSnapshot`.

## O que NÃO muda

- `/api/audience/[client]` e toda a busca de dado (`src/lib/meta.ts`, `src/lib/audience.ts`) continuam exatamente iguais — essa mudança é só de apresentação.
- O restante da página Orgânico (seguidores, alcance, engajamento, top posts) não muda.
- A aba Ads não muda.

## Arquitetura / componentes

- `src/components/Dashboard.tsx`: `Tab` volta a ser só `"organic" | "ads"`; nav volta a ter só 2 entradas; `AudiencePanel` passa a ser renderizado sempre dentro do bloco `tab === "organic"`, no final, em vez de condicionado a uma aba própria.
- `src/components/AudiencePanel.tsx`: continua sendo o dono do fetch e do filtro de período próprio — só muda o que ele renderiza internamente.
- `src/components/DemographicCompare.tsx`: substituído por componentes especializados por tipo de visualização (gráfico de pizza reutilizável, gráfico de barras de idade, lista ranqueada de geografia), já que "chart-forward" significa que cada dimensão tem uma visualização diferente, não uma barra genérica repetida.
- Reaproveita a paleta de cores da marca já usada em todo o dashboard (`#7c3aed`, `#0080ff`, etc.) — sem inventar cor nova.
- Reaproveita o Recharts, já usado no gráfico de Alcance e nos sparklines — sem dependência nova.

## Testes

Mesma filosofia do projeto inteiro (sem framework de testes): `npx tsc --noEmit`, `npm run build`, e verificação visual no navegador com dado real da Laís (mesma conta usada em toda a sessão) — confirmar que os gráficos de pizza/barra renderizam com os números corretos, que a coluna Engajados some quando vazia (caso da Laís hoje) e aparece quando outro cliente tiver dado suficiente, e que os dois filtros de período (livre + o de audiência) continuam independentes um do outro.
