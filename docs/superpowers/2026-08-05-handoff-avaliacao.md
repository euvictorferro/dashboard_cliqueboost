# Handoff — continuar em novo chat, feature Avaliação

Cole isso como primeira mensagem no chat novo.

---

## Contexto do projeto

Repo: `/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost` (Next.js App Router +
TypeScript + Tailwind v4 + Supabase). Branch: `feature-conteudos-refinamento` — **NÃO mesclar
em main**, fica só em preview até o Victor aprovar (ele confirma isso a cada sessão).

**Como eu trabalho aqui:**
- Uso as skills superpowers: `brainstorming` → `writing-plans` → `subagent-driven-development`
  pra features novas de verdade (spec em `docs/superpowers/specs/`, plano em
  `docs/superpowers/plans/`, implementação com subagentes + revisão em cada task + revisão
  final da branch). Pra ajustes rápidos/visuais que o Victor já aprovou na hora, aplico direto
  sem essa cerimônia.
- Depois de cada mudança: `npx tsc --noEmit -p .` → `npm run build` → `git commit` → `vercel
  deploy` (preview) → mando o link pro Victor.
- **Link de teste padrão** (cliente `debora`, token fixo):
  `https://<preview-url>/debora?key=e5bff4d1825a067cfab62539526e9a3c` (troca `debora` pela
  página, ex: `/debora/conta?key=...`).
- **Testar visualmente de verdade** (não só pedir pro Victor conferir): uso os tools
  `mcp__playwright__*` pra navegar/clicar/tirar screenshot no preview. Como o preview tem
  Vercel Deployment Protection, preciso liberar acesso antes:
  ```
  vercel project protection enable --protection-bypass   # pega o secret no output
  vercel project protection                                # confirma/recupera o secret se perdeu
  ```
  Uso o secret como query param na URL: `?...&x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`.
  **Sempre desativo depois:**
  `vercel project protection disable --protection-bypass --protection-bypass-secret <secret>`.
- **Nunca commitar os artefatos temporários do Playwright** (screenshots `.png`, snapshots
  `.yml` que eu salvo pra examinar) — já aconteceu de ir sem querer no `git add -A`. `.gitignore`
  já tem `.playwright-mcp/` adicionado; ainda assim, sempre `git status --short` antes de
  commitar, ou `rm` os arquivos de teste antes do `git add`.

## O que foi feito nesta sessão (tudo commitado e deployado)

1. **Booster AI**: tela inicial (hero) quando não há mensagens ainda ("Booster pronto pra te
   ajudar" + composer centralizado), mensagens em `flex-col-reverse` (nascem coladas na barra
   de digitar), input fixo no rodapé da viewport.
2. **Calendário**: header único com nav (mês/hoje/próximo) + segmented Mês/Semana/Dia/Lista,
   busca, filtro por label do Trello, hover-card no mês, chips de evento sólidos.
3. **Atas**: `CallScheduler` reescrito — calendário + horários lado a lado (tamanho padrão,
   sem espaço vazio), estado confirmado com check verde + "Remarcar call"/"Salvar no
   calendário" (Google/Outlook/.ics).
4. **Bugs de layout gerais**: margem preta no rodapé das páginas (causa: `AppFrame` esticava a
   coluna de conteúdo até a altura da sidebar — trocado pra `items-start`), scroll por coluna
   no Kanban de Conteúdos (com "Adicionar card" fixo no rodapé de cada coluna), scroll
   independente em Bunker.
5. **Dropdown de conta** (`AccountCard`): "Ajustes" (renomeado de Configurações), toggle de
   tema em pílula (sol/lua/monitor, só a bolinha mostra o ícone do modo atual), "Sair" em
   vermelho. Abre no hover, não precisa mais clicar.
6. **Página de Conta — redesenho completo** (spec + plano + subagent-driven-development):
   5 seções (Perfil, Fuso horário, Faturamento, Indicação de amigos, Segurança) — depois
   simplificado de "sub-sidebar trocando painel" pra **página única rolando com âncoras +
   scroll-spy** (Victor achou o painel-por-vez muito vazio). Fuso horário mostra cidade +
   relógio ao vivo + toggle 12h/24h (preferência em localStorage). Confirmado: **todos os dados
   de Faturamento (`client_settings.plan_name/payment_status`, `client_payments`) são 100%
   manuais** — não tem Stripe nem nenhuma integração de pagamento no projeto, é o Victor quem
   me passa os dados e eu insiro direto no Supabase quando pedido.
7. **Feature "Report de Bug"** (spec → plano de 5 tasks → subagent-driven-development):
   dropdown de conta → modal (página com problema + descrição + até 3 prints) → confirmação
   ("Enviamos o erro para nosso time..."). Tabela `bug_reports` + bucket `bug-report-screenshots`
   no Supabase (Victor já aplicou a migration `0017` e criou o bucket — **testado ponta a
   ponta, funcionando**). Sem painel admin nem notificação automática (decisão explícita:
   Victor pede pra eu checar quando quiser).
8. **Bug real encontrado e corrigido**: o `BugReportModal`, por nascer dentro da `Sidebar`
   (que usa `position: sticky`, criando seu próprio contexto de empilhamento), ficava preso
   atrás do conteúdo da página mesmo com z-index alto — corrigido com `createPortal(...,
   document.body)`. **Aprendizado geral pro projeto**: qualquer modal/popup que nasça dentro da
   Sidebar (ou de qualquer ancestral com `position: sticky/fixed` ou `transform`) precisa de
   portal pro `<body>`, não só z-index alto — bug candidato a se repetir na feature de
   Avaliação se o popup nascer num lugar parecido.

## Roadmap — visão geral do que falta (pra não perguntar de novo)

- **Briefing, Brand, Criador de formulários**: vão pro **Admin** (painel que ainda não existe),
  não pro portal do cliente — confirmado pelo Victor.
- **Login real (Supabase Auth)**: fora de escopo por enquanto, "Sair" é só tela informativa.
- **Pipeline de indicações com estágios** (clique → lead → call → fechou): mencionado, sem
  spec ainda, fica pra depois.
- Depois da Avaliação: refinamento geral de design da plataforma + landing page / OAuth page /
  referral page / página de erro etc. (mencionado pelo Victor como "próximos passos", ainda
  sem brainstorm).

## Próxima tarefa: feature Avaliação (popup de rating mensal)

Spec dada pelo Victor (ainda **não** passou por brainstorming/spec/plano — começar do zero):

- Popup aparece pro cliente **todo último dia do mês** (se ele não acessar nesse dia, aparece
  na próxima vez que acessar).
- Mensagem inicial: algo como "Avalie nosso app pra que possamos evoluir!" + 2 botões: "Agora
  não" e "Avaliar".
- Ao clicar "Avaliar", o popup vira formulário: avaliação em estrelas de **0.5 em 0.5** (1,
  1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5) + campo de texto opcional.
- Se o cliente não avaliar ("Agora não" ou fechar), o popup **volta a aparecer toda vez** que
  ele acessar, até avaliar de verdade — cada vez com uma mensagem diferente/mais engraçada tipo
  "sei que já te pedi, mas avalia a gente aí".
- Motivação de negócio: dado pro go-to-market.

**Pontos que provavelmente precisam de pergunta ao Victor antes de desenhar** (meu instinto,
confirmar com ele): onde esses ratings ficam salvos (tabela nova, mesmo padrão 100% manual de
visualização — sem painel admin ainda); se "todo último dia do mês" é por calendário corrido ou
tem alguma folga (ex: mostra do dia 28 ao 1º do mês seguinte pra garantir que apareça mesmo se
o cliente não abrir exatamente no último dia); se cada rating é atrelado a um mês específico
(ex: cliente não pode avaliar approve mês passado de novo) ou é sempre "a avaliação mais
recente"; database já tem exemplo de tabela parecida pra reaproveitar padrão (`referral_leads`,
`bug_reports` — RLS ligado sem policies, só Service Role Key).

**Comece invocando a skill `superpowers:brainstorming`** pra desenhar isso com o Victor antes
de qualquer código, como fizemos com Conta e Report de Bug.
