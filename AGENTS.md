<!-- BEGIN:nextjs-agent-rules -->
See ARCHITECTURE.md for the project map (folders, conventions, known debts).

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Fase 2 — Regras de colaboração (Victor + Claude)

Estas regras valem em TODA sessão, independente do que sobrar de contexto anterior. Ler antes de qualquer trabalho de fase 2.

1. **Registro de tasks no ClickUp.** Space "App Clique Boost" tem os boards **Tasks** e **Ideias**. Toda ideia/feature/tarefa decidida em brainstorm vira uma task lá, status Backlog, título `[Feat] - Nome da ideia` + descrição com o contexto decidido. Responsável = "Claude" se for algo que eu executo por aqui; "Victor" se for algo que só ele consegue fazer (logins, decisões externas, contas de terceiros).
2. **Memória em Obsidian.** Decisões, aprendizados e contexto de desenvolvimento da fase 2 vão para `/Users/victorferro/Library/Mobile Documents/iCloud~mdobsidian/Documents/[Second Brain] - App Clique Boost`, não só na memória interna do Claude Code — isso é o repositório de memória entre projetos/ferramentas.
3. **Nunca deploy/merge para produção sem a senha "Avanti Clique".** Frases soltas tipo "está finalizado", "pode subir", "manda ver" NÃO autorizam deploy — só a senha exata, digitada pelo Victor, autoriza merge pra `main`/deploy em produção. Todo trabalho de fase 2 acontece na branch `plataforma-v2` (já existe), nunca em `main`. Commits/push só nessa branch (ou branch derivada dela), preview deployments apenas. Ver também memória `feedback_nao_publicar_producao`.

