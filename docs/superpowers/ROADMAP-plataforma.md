# Roadmap — Clique Boost, plataforma completa

Fonte: notas do Victor no Obsidian (`[Clique Boost] - Second Brain/Dashboard App Insights.md`, seção `# Insights:`).
Reorganizado por dependência de API paga, não só pela prioridade original (L1-L4), pra decidir o que dá pra começar já.

## Fase A — sem API paga (pode começar agora)

Ordem sugerida por menor esforço / maior valor imediato:

1. **Comparativo de datas** (L1) — filtro "Personalizado" com 2 datas, linha roxa vs. linha azul nos gráficos de métricas. Não se aplica à seção Público. Reaproveita a Graph API que já usamos, sem custo novo.
2. **Tasks** (L2) — página estilo ClickUp: tabela com nome/status (a fazer, em progresso, concluído). V1 nativa via Supabase, sem puxar da API do ClickUp ainda (isso fica pra Fase B, é opcional).
3. **Conteúdos** (L2) — Kanban estilo Trello (colunas customizáveis, cards com data/descrição/anexo/tags) + "Bunker de Ideias" em versão simples: cliente manda um link/vídeo de referência, a gente salva o link e o perfil de origem — sem o acompanhamento automático semanal (isso precisa de scraping pago, vai pra Fase B).
4. **Calls** (L2) — agendamento estilo Calendly nativo (Supabase: horários disponíveis, botão "Remarcar Call"). Sem a integração automática com Granola por enquanto (Fase B).
5. **Conta** (L2), parte sem custo:
   - Briefing (puxar do Google Forms/Sheets, gratuito)
   - Brand (paleta, fontes, logo — armazenado no Supabase)
   - Tempo de contrato (calculado)
   - Indicação de amigos (código de referência, gratuito)
   - *Fora daqui por enquanto*: faturas pagas/próxima fatura (depende de saber qual sistema de cobrança vocês usam — Stripe? outro?)
6. **Login do cliente** (L3) — e-mail/senha via Supabase Auth (gratuito), sem mudar a URL atual (`dash.cliqueboost.io/client_name`).
7. **Painel admin** (L3) — `dash.cliqueboost.io/admin_id`, gerencia tasks/cards/etc. de cada cliente. Nativo, sem API paga.
8. **Criador de formulários** (L3) — estilo Typeform, nativo via Supabase.

## Fase B — depende de API paga ou integração a confirmar

1. **Análise de IA das métricas** (L1) — bot "social media experiente" (Claude/OpenAI API, custo por chamada) + scraping do perfil do Instagram pra transcrever vídeos/analisar gancho e edição.
2. **Booster AI** (L2) — chat com IA sobre a conta do cliente — mesma dependência de LLM paga do item acima.
3. **Bunker de Ideias, modo avançado** — acompanhamento automático semanal de perfis referenciados — precisa de scraping pago (tipo Apify).
4. **Conta — faturamento** — faturas pagas/próxima fatura, depende de qual sistema de cobrança a Clique Boost usa hoje.
5. **Calls — atas automáticas do Granola** — possível já ter acesso via integração conectada, mas precisa confirmar antes de arquitetar.

## Fase C — automação (L4, depende da Fase B)

- Cliente preenche briefing → sistema já gera paleta de cores, tipografia e estratégia sozinho via IA, delegando publicação de conteúdo (ex: via Buffer).
