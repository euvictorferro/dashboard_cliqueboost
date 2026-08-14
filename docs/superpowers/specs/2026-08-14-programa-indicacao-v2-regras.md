# Programa de Indicação v2 — Regras (design)

**Data:** 2026-08-14
**Status:** regras aprovadas pelo Victor; implementação do workflow completo fica pra depois (esquema simples atual — card + modal + WhatsApp — já está em produção, ver commits `cca6a8d`/`41f6b17`).

## Contexto

O esquema simples de indicação (card "Compartilhe a Clique" na sidebar, modal com link/QR/botões de compartilhamento, `/r/[code]` redirecionando pro WhatsApp) já está no ar. Este documento fecha as **regras de recompensa** pra quando o workflow completo (captura de lead, vínculo automático, aplicação de desconto) for implementado — substituindo a regra atual (só o indicador ganha 20% numa fatura, indicação precisa assinar plano ≥ US$350, sem limite de empilhamento), que está hardcoded em `src/lib/referralLeads.ts` + `src/app/api/webhooks/stripe/route.ts` (`applyReferralDiscount`).

## Regras

1. **Indicador (quem indica):** ganha 20% de desconto numa fatura por cada indicação convertida. Empilha até **3 indicações por fatura/ciclo de cobrança** → desconto máximo de **60%** numa fatura. O contador de "quantas indicações contaram nessa fatura" reseta a cada novo ciclo — indicações além da 3ª no mesmo ciclo não geram desconto adicional naquele ciclo, mas seguem contando normalmente em ciclos futuros (não é limite vitalício).
2. **Indicado (quem foi indicado):** ganha **20% de desconto fixo, uma única vez, na primeira fatura**. Não empilha sob nenhuma circunstância (nem se, hipoteticamente, mais de um link levasse ao mesmo novo cliente).
3. **Valor mínimo pra qualificar:** o plano contratado pela pessoa indicada precisa custar **pelo menos US$400** (o plano Starter, o mais básico da Clique Boost) — essa é a condição de qualificação tanto pro desconto do indicador quanto pro desconto do indicado.
4. **Validade:** programa **por tempo indeterminado**, sem data de expiração definida.

## Exemplo — o que o indicador recebe no final do mês

O desconto do indicador é sempre aplicado numa fatura futura, com base em quantas indicações qualificadas (plano ≥ Starter) converteram naquele ciclo:

- **1 indicação convertida no mês:** 20% de desconto numa fatura.
- **2 indicações convertidas no mês:** 40% de desconto numa fatura.
- **3 indicações convertidas no mês:** 60% de desconto numa fatura — teto do ciclo.
- **4ª (ou mais) indicação convertida no mesmo mês:** **não soma mais desconto nesse ciclo** — o teto do mês já foi atingido nas 3 primeiras. Essa 4ª indicação não é descartada, só não gera desconto adicional *nesse* ciclo específico (ver "fora de escopo" abaixo: a lógica de contagem/carry-over ainda precisa ser desenhada quando o workflow completo for implementado — por exemplo, se essa indicação "sobrando" conta pro próximo mês ou não, ainda não foi decidido).
- **Mês seguinte, sem indicações novas:** 0% — o contador de indicações qualificadas zera a cada ciclo, o desconto não é recorrente por conta própria, precisa de indicação nova convertendo naquele ciclo específico pra gerar desconto de novo.

## Fora de escopo deste documento (fica pro "workflow completo")

- Como o time vai saber, na hora de cadastrar um novo cliente, quem o indicou — hoje o esquema simples não captura isso automaticamente (o link vai direto pro WhatsApp, sem formulário). Precisa decidir se volta a ter captura de lead, ou se fica manual (time pergunta e anota).
- Lógica de aplicação do desconto em cascata (até 3× 20% = até 60% numa fatura só) via Stripe — a implementação atual de `applyReferralDiscount` só lida com um cupom único de 20%, não com empilhamento por ciclo. Precisa de nova lógica pra contar quantas conversões "cabem" no ciclo atual do indicador antes de aplicar o(s) cupom(ns).
- Aplicação do desconto do lado do indicado (hoje só o indicador recebe recompensa no código existente) — precisa de lógica nova, não só ajuste de regra.
- Prevenção de fraude/auto-indicação (indicar a si mesmo ou familiar pra ganhar desconto sem trazer cliente real) — não discutido ainda.
- Se uma 4ª+ indicação convertida no mesmo ciclo (além do teto de 3) "sobra" pro próximo ciclo ou é perdida — não decidido ainda.
