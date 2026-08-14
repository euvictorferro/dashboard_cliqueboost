# Landing Page pública (cliqueboost.io) — Design

**Data:** 2026-08-14
**Status:** aprovado (estrutura), foco atual = landing page em si; fluxos de backend do formulário ficam pra depois.

## Contexto

O admin panel (Fase 1) está pronto mas não publicado. Prioridade mudou: construir a landing page pública que vai ocupar o domínio apex `cliqueboost.io` (separado de `[client].../` que é o app dos clientes e `admin.cliqueboost.io`). Essa landing **vende os serviços da agência** (Marketing 360), não o aplicativo — o dashboard é mencionado só como prova de tecnologia própria.

Público-alvo: corretores individuais/pequenas equipes nos EUA que vendem ativos financeiros de alto ticket (imóveis, life insurance, outros produtos financeiros/corretagem). Vivem de autoridade pessoal e indicação, sem marketing interno.

## Fora de escopo (por enquanto)

- Backend do formulário de aplicação (tabela Supabase `landing_leads`, envio via Resend, notificações). Fica pra uma spec/fase futura.
- WhatsApp automatizado (sem integração pronta no Marketplace; aprovação de número pode levar dias).
- Landing como ferramenta de venda do aplicativo — o app é só prova de tecnologia, não é a oferta.

## Localização

- `src/app/page.tsx` deixa de ser o índice interno de clientes e vira a landing pública. O índice interno atual (lista de links pra `/[client]`) é realocado (destino exato decidido na hora da implementação — provável candidato: fundido ao `/admin` ou removido, já que login dá acesso direto).
- Bilíngue via **toggle EN/PT no header** — dicionário de strings em `src/lib/landingCopy.ts` (`{ en: {...}, pt: {...} }`), sem lib de i18n externa, sem rotas novas. Preferência de idioma persiste em `localStorage`.

## Estrutura de seções (ordem final)

1. **Hero** — headline + subheadline persuasiva sobre a agência, CTA primário. Sem prova social aqui (autoridade em construção).
2. **Problema/Dor** — 3 sintomas concretos (sem presença no Instagram, sem tempo pra marketing, poucas vendas apesar do esforço), amarrados numa cadeia causal até "poucas vendas".
3. **Virada/Promessa** — transição curta + promessa central: "You sell and film. We handle everything else." (Marketing 360 resumido).
4. **O que está incluído** — grid dos 7 serviços: criação de website, estratégia de social media, conteúdo viral, tráfego pago multi-plataforma (Meta, Google, LinkedIn, Pinterest, X Ads), edição de vídeo, design de posts, copywriting. Automação com IA mencionada como diferencial extra, não oferta principal.
5. **Como funciona / processo** — 3-4 passos (aplica → chamada de diagnóstico → onboarding → conteúdo/tráfego rodando).
6. **Prova social** — depoimentos (vídeo/texto) + logos/nomes de clientes atendidos. Sem números inflados — autenticidade, não escala (autoridade ainda em construção).
7. **Diferencial de tecnologia** — bloco curto com prints reais do dashboard próprio, reforçando "agência com tecnologia própria". Não é pitch do app.
8. **FAQ** — objeções comuns (preço, contrato, tempo de resultado, nichos atendidos).
9. **CTA final + formulário de aplicação (UI apenas)** — repete a promessa, formulário curto (nome, nicho, onde atua, maior dor). Nesta fase o formulário existe na UI mas **sem submissão real** — placeholder (ex: desabilitado com nota "em breve" ou captura local sem persistir) até a fase de backend ser especificada.
10. **Footer** — logo, contato, redes sociais.

## Componentes

`src/components/landing/`: `Header` (com toggle EN/PT), `Hero`, `PainPoints`, `Promise`, `Services`, `Process`, `Testimonials`, `TechDifferentiator`, `Faq`, `ApplicationForm`, `Footer`. Um componente por seção, seguindo a convenção existente do projeto (pasta por página/funcionalidade).

## Estilo

Reaproveita tokens/paleta já existentes em `globals.css` e componentes de `components/ui/` e `components/layout/Logo`. Sem design system novo.

## Testes

Sem lógica não-trivial nesta fase (página é majoritariamente apresentação). Nenhum teste dedicado necessário — YAGNI.
