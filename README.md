# Dashboard Clique Boost

Dashboard de métricas (Meta/Instagram orgânico, TikTok orgânico e Meta Ads) por cliente da Clique Boost.
Next.js 16 (App Router) + Tailwind v4 + Recharts. **No ar em produção:** https://dash.cliqueboost.io
(Vercel, projeto `dashboard-cliqueboost` na conta Victor Ferro's projects).

## Rodando local

```bash
npm install
npm run dev
```

## Estado atual (v1) — em produção

- **Cada cliente tem sua própria URL protegida por token**: `https://dash.cliqueboost.io/[client]?key=TOKEN`. Sem o token certo, mostra "Acesso não autorizado" (fail-closed) — validado server-side (`src/lib/access.ts`) tanto na página quanto na rota de API, contra a tabela `client_tokens` no Supabase (RLS ligado, só a Service Role Key acessa). `/` é só um índice interno (uso do Victor), não é a home do produto.
- **Métricas orgânicas com dado real** via `/api/organic/[client]` (`src/lib/meta.ts`) para os **6 clientes**: Débora, Laís, Sam, Nelson, Tiago, Bela — todos com Instagram conectado ao Usuário do Sistema da Meta (`dashboard-api`) e confirmados com dado real em produção. Cai automaticamente pro mock (`src/lib/metrics.ts`) se algum cliente novo entrar sem `instagramBusinessId`/acesso liberado, ou se a chamada falhar por qualquer motivo — nunca quebra o dashboard do cliente.
  - Duas limitações reais da Graph API, já tratadas no código: insights com `period=day` só aceitam janelas de até 30 dias (chunking automático pra 60/90 dias); o histórico de `follower_count` só cobre os últimos 30 dias a partir de hoje, então a variação % de seguidores aparece como "novo" em vez de percentual pra janelas onde o período anterior cai fora dessa janela.
  - Ads (`src/lib/ads.ts`) continua mockado — não é prioridade agora porque a aba fica bloqueada (`adsActive: false`) até algum cliente ter tráfego pago rodando de verdade. Ad Account ID de Débora, Laís e Nelson já cadastrados e acessíveis, prontos pra quando a integração real de Ads for feita.
- 6 clientes fixos em `src/lib/clients.ts`, todos com `instagramBusinessId` real. Nenhum tem `adsActive: true` ainda.
- Filtro de período em dropdown (ícone de filtro). Cada métrica orgânica mostra variação % vs. período anterior.
- Aba Ads mostra overlay de "sem anúncios ativos" (blur + cadeado + CTA WhatsApp real) quando `adsActive` é `false`.
- TikTok fora de escopo por enquanto (combinado com o Victor — clientes usam pouco).
- Botão "Baixar relatório (PDF)" é um stub — falta desenhar o layout do relatório antes de implementar a geração real.
- Design usa a skill `frontend-design` — fonte Fraunces (serif) para hero/eyebrows + Inter pro resto, hero stat de "Seguidores líquidos" como elemento de destaque, métricas agrupadas por Audiência/Engajamento/Conteúdo.

## Links de acesso dos clientes

Os 6 tokens ficam na tabela `client_tokens` do Supabase (não neste repo). Formato do link:
`https://dash.cliqueboost.io/<client_id>?key=<token>`

## Pendências reais

1. Integração real de Ads (Marketing API) — não é urgente, aba segue bloqueada até algum `adsActive` virar `true`.
2. TikTok (não prioritário).
3. Relatório em PDF (layout ainda não definido).
4. Projeto Supabase (`client_tokens`) tem só a tabela de tokens — se quiser usar pra mais coisas (cache de métricas, histórico), ainda não foi feito.
5. Variáveis de ambiente de **Preview** na Vercel não foram configuradas (só Production) — CLI teve um bug pontual nessa etapa; não bloqueia o uso normal.

## Variáveis de ambiente

Ver `.env.example`. Em produção, já configuradas no projeto Vercel (`vercel env ls production`).
