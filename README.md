# Dashboard Clique Boost

Dashboard de métricas (Meta/Instagram orgânico, TikTok orgânico e Meta Ads) por cliente da Clique Boost.
Next.js 16 (App Router) + Tailwind v4 + Recharts. Deploy: Vercel, subdomínio planejado `dash.cliqueboost.io`.

## Rodando local

```bash
npm install
npm run dev
```

## Estado atual (v1)

- Dados **mockados** (`src/lib/metrics.ts`, `src/lib/ads.ts`) — determinísticos por cliente/período, prontos para trocar pela chamada real assim que as credenciais existirem.
- 6 clientes fixos em `src/lib/clients.ts` (Débora, Laís, Sam, Nelson, Tiago, Bela). Nenhum tem `adsActive: true` ainda — mude a flag quando a conta de Ads do cliente estiver rodando de verdade.
- Aba Ads mostra o overlay de "sem anúncios ativos" (blur + cadeado + CTA WhatsApp) quando `adsActive` é `false`.
- TikTok ainda não tem integração nem espaço próprio no dashboard — combinado com o Victor que não é prioridade agora (clientes usam pouco).
- Botão "Baixar relatório (PDF)" é um stub (`src/components/ExportPdfButton.tsx`) — falta desenhar o layout do relatório antes de implementar a geração real.

## Pendências para sair do mock

1. **Meta App** (developers.facebook.com) vinculado ao Business Manager da Clique Boost, com permissões `instagram_basic`, `pages_read_engagement`, `ads_read`, e um token de usuário do sistema (não expira).
2. Para cada cliente: Instagram Business Account ID (Meta Business Suite → Configurações → Contas → Instagram) e, para Laís/Débora, o Ad Account ID do Meta Ads.
3. Número de WhatsApp real da Clique Boost em `WHATSAPP_LINK` (`src/lib/ads.ts`) — hoje é placeholder.
4. Projeto Supabase novo (decidido: não reaproveitar o do app Social Media Clique Boost) — usar para cache de métricas e armazenar tokens com RLS. Variáveis em `.env.example`.
5. Vincular o repo na Vercel (só é possível com o repo não-vazio, já resolvido neste commit) e apontar `dash.cliqueboost.io` — a Vercel vai fornecer o registro CNAME para cadastrar na Hostinger.

## Variáveis de ambiente

Ver `.env.example`.
