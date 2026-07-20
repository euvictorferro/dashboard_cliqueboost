# Dashboard Clique Boost

Dashboard de métricas (Meta/Instagram orgânico, TikTok orgânico e Meta Ads) por cliente da Clique Boost.
Next.js 16 (App Router) + Tailwind v4 + Recharts. Deploy: Vercel, subdomínio planejado `dash.cliqueboost.io`.

## Rodando local

```bash
npm install
npm run dev
```

## Estado atual (v1)

- **Cada cliente tem sua própria URL** — `/[client]` (ex: `/debora`, `/lais`), sem seletor trocando entre clientes. `/` é só um índice interno (uso do Victor) listando os 6 links, não é a home do produto.
- **Métricas orgânicas com dado real** via `/api/organic/[client]` (`src/lib/meta.ts`) para quem já tem Instagram conectado ao Usuário do Sistema da Meta: Laís, Tiago, Bela e Sam. Cai automaticamente pro mock (`src/lib/metrics.ts`) se o cliente não tiver `instagramBusinessId`, não houver credencial Meta configurada, ou a chamada falhar por qualquer motivo (ex: Débora e Nelson, ainda sem acesso liberado) — nunca quebra o dashboard do cliente.
  - Duas limitações reais da Graph API, já tratadas no código: insights com `period=day` só aceitam janelas de até 30 dias (chunking automático pra 60/90 dias); o histórico de `follower_count` só cobre os últimos 30 dias a partir de hoje, então a variação % de seguidores aparece como "novo" em vez de percentual pra janelas onde o período anterior cai fora dessa janela.
  - Ads (`src/lib/ads.ts`) continua mockado — não é prioridade agora porque a aba fica bloqueada (`adsActive: false`) até algum cliente ter tráfego pago rodando de verdade.
- 6 clientes fixos em `src/lib/clients.ts` (Débora, Laís, Sam, Nelson, Tiago, Bela), com `instagramBusinessId`/`adAccountId` reais onde já disponíveis. Nenhum tem `adsActive: true` ainda — mude a flag quando a conta de Ads do cliente estiver rodando de verdade.
- Filtro de período é um dropdown (ícone de filtro), não mais uma barra de botões.
- Cada métrica orgânica mostra a variação % vs. o período anterior equivalente.
- Aba Ads mostra o overlay de "sem anúncios ativos" (blur + cadeado + CTA WhatsApp) quando `adsActive` é `false`.
- TikTok ainda não tem integração nem espaço próprio no dashboard — combinado com o Victor que não é prioridade agora (clientes usam pouco).
- Botão "Baixar relatório (PDF)" é um stub (`src/components/ExportPdfButton.tsx`) — falta desenhar o layout do relatório antes de implementar a geração real.
- Design usa a skill `frontend-design` (instalada em `.claude/skills/`, `.agents/skills/`): fonte Fraunces (serif) para hero/eyebrows + Inter pro resto, hero stat de "Seguidores líquidos" como elemento de destaque, métricas agrupadas por Audiência/Engajamento/Conteúdo em vez de grid única.
- **Sem autenticação ainda** — a URL de cada cliente não é secreta nem protegida. Antes de mandar o link pro cliente final, avaliar se precisa de algo (token na URL, login simples) pra não vazar dado de um cliente pro outro.

## Pendências

1. ~~Meta App + token de sistema~~ ✅ feito — App `Clique Boost Dashboard`, token do Usuário do Sistema `dashboard-api` em `.env.local` (nunca commitado).
2. **Débora e Nelson** ainda sem Instagram acessível pelo Usuário do Sistema — falta compartilhar a conta com a BM da Clique Boost e depois atribuir o `dashboard-api` a ela (mesmo processo já feito pra Laís/Tiago/Bela/Sam). Nelson também não tem o Instagram Business ID cadastrado em `src/lib/clients.ts`.
3. Ad Account ID da Laís e da Débora já cadastrados, mas a integração real de Ads ainda não foi feita (aba continua mockada/bloqueada — só vira prioridade quando `adsActive` for ligado pra alguém).
4. Número de WhatsApp real da Clique Boost em `WHATSAPP_LINK` (`src/lib/ads.ts`) ✅ feito.
5. Projeto Supabase novo (decidido: não reaproveitar o do app Social Media Clique Boost) — URL e Service Role Key já em `.env.local`, mas o projeto ainda não é usado por nenhum código (não há cache de métricas nem persistência ainda).
6. Vincular o repo na Vercel (só é possível com o repo não-vazio, já resolvido) e apontar `dash.cliqueboost.io` — a Vercel vai fornecer o registro CNAME para cadastrar na Hostinger. Ao vincular, replicar as variáveis de `.env.local` nas Environment Variables do projeto Vercel.

## Variáveis de ambiente

Ver `.env.example`.
