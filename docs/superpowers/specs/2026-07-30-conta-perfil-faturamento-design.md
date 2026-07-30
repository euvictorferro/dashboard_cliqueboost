# Conta — Perfil & Faturamento (reversão de Marca + redesenho)

## Contexto

A rodada anterior ("Conta — Brand") construiu uma feature onde o cliente escolhe uma cor que repinta o dashboard inteiro (`--brand-primary` sobrescrito via `layout.tsx`). Depois de ver funcionando, o Victor decidiu que isso não é o que a página Conta deveria fazer — ele não quer que o cliente consiga trocar a aparência do dashboard. A intenção real da página Conta é ser uma página de conta/perfil de cliente de verdade, no estilo de uma conta de SaaS (ex: conta do Claude): informações básicas de perfil + informações de faturamento (plano, status de pagamento, histórico, tempo de contrato).

Esta spec cobre duas coisas: **reverter** a repintura de cor da Marca, e **redesenhar** a página Conta em duas seções novas: Perfil e Faturamento.

## Escopo

### Reversão — Marca (cor)

- Remove completamente a repintura do dashboard via `--brand-primary` dinâmico.
- Remove a coluna `brand_color`, a rota de salvar cor, o seletor de cor na UI, e o helper `hexToHslTriplet` (fica sem nenhum uso depois da remoção).
- O **logo continua existindo** — vira a "foto de perfil" do cliente na nova seção Perfil (mesmo bucket `client-logos`, mesma rota de upload, só reenquadrado visualmente e renomeado no rótulo).
- O dashboard inteiro volta a usar só a cor fixa da Clique Boost (era o comportamento antes da rodada Brand) — nenhuma outra tela muda.

### Novo — Card "Perfil"

- **Nome**: mostrado (vem de `CLIENTS` hardcoded), não editável pelo cliente.
- **E-mail cadastrado**: editável pelo cliente (campo + botão salvar, mesmo padrão do Fuso horário) — vai ser usado futuramente para notificações, mas isso é fora de escopo agora (só guardar o dado).
- **Foto de perfil**: upload (reaproveita a mesma rota/bucket do antigo "logo" da Marca).

### Novo — Card "Faturamento"

- **Plano contratado**: texto livre (ex: "Orgânico", "Orgânico + Ads", "Completo") — só leitura na UI do cliente, definido/atualizado pelo Victor manualmente.
- **Status de pagamento**: texto livre (ex: "Em dia", "Atrasado") — só leitura, definido pelo Victor manualmente.
- **Histórico de pagamentos**: lista de pagamentos (data + valor opcional), não só uma contagem — pensado para eventualmente ser alimentado automaticamente pela Stripe, mas populado manualmente por enquanto (mesmo padrão das Atas: o Victor pede pra inserir, eu insiro direto no banco).
- **Tempo de contrato**: já construído na rodada anterior, continua igual — só passa a fazer parte visualmente desta seção.

### Fora de escopo

- Qualquer integração real com Stripe ou outro processador de pagamento — dado 100% manual por enquanto.
- Edição de plano/status/histórico pelo próprio cliente — só o Victor atualiza (via mim, pedindo diretamente).
- Envio de notificações por e-mail — só guardamos o campo agora.
- Popular dados reais de qualquer cliente nesta rodada — a estrutura fica pronta, funcional e vazia; população real é sob demanda depois, como já vem sendo feito.

## Arquitetura

### Banco de dados

- Migration `0009_client_settings_drop_brand_color.sql`: `alter table client_settings drop column if exists brand_color;`
- Migration `0010_client_settings_profile_billing.sql`:
  ```sql
  alter table client_settings add column if not exists contact_email text;
  alter table client_settings add column if not exists plan_name text;
  alter table client_settings add column if not exists payment_status text;

  create table if not exists client_payments (
    id uuid primary key default gen_random_uuid(),
    client_id text not null,
    paid_at date not null,
    amount numeric,
    created_at timestamptz not null default now()
  );
  ```
  (`client_payments` não é keyed por `client_id` como PK — é uma tabela de histórico com várias linhas por cliente, `id` de linha é quem identifica cada pagamento. Isso muda a disciplina de limpeza de teste: aqui SIM se aplica "apagar pelo ID específico retornado no insert", igual `call_notes`.)

### Código

- Deletar: `src/app/[client]/layout.tsx`, `src/app/api/conta/[client]/brand/route.ts`, `src/lib/hexColor.ts`.
- `src/lib/clientSettings.ts`: remove `brandColor` do tipo `ClientSettings` e a função `updateClientBrand`; adiciona `contactEmail: string | null`, `planName: string | null`, `paymentStatus: string | null` ao tipo e ao `fetchClientSettings`; nova função `updateContactEmail(clientId, email)`.
- Novo `src/lib/clientPayments.ts`: `fetchClientPayments(clientId): Promise<{ id: string; paidAt: string; amount: number | null }[]>` — busca ordenado por `paid_at desc`.
- `src/app/api/conta/[client]/route.ts` (GET): passa a devolver `contactEmail`, `planName`, `paymentStatus`, `payments` (array), além de `timeZone`, `logoUrl`, `contractStart`, `contractDuration` (mantidos). Remove `brandColor` da resposta.
- Novo `src/app/api/conta/[client]/email/route.ts` (PUT): salva `contactEmail`, mesmo padrão de validação simples das rotas existentes (formato básico de e-mail).
- `src/app/api/conta/[client]/brand/route.ts`: deletado (era só pra cor).
- `src/app/api/conta/[client]/logo/route.ts`: mantido como está (upload continua igual, só muda o rótulo na UI que o consome).
- `src/components/ContaPageClient.tsx`: reestruturado em 2 cards — "Perfil" (nome, e-mail editável, foto de perfil) e "Faturamento" (plano, status, histórico de pagamentos, tempo de contrato) — remove o card antigo "Marca" e o seletor de cor.

## Testes

- Verificação ao vivo com o cliente sandbox Tiago: e-mail editável salva e recarrega; foto de perfil (upload) continua funcionando igual a antes; dashboard do Tiago (outras páginas) NÃO muda de cor mesmo definindo qualquer coisa em `client_settings`.
- `client_payments`: inserir 1-2 pagamentos de teste com `client_id = '__test__'` (client_id descartável — aqui não precisa ser Tiago, pois a verificação visual da lista pode ser feita com um `client_id` que não existe em `CLIENTS`, já que a chamada é feita direto na API/banco, não precisa renderizar página de um cliente real pra confirmar que a query funciona) — a menos que a verificação visual do card "Histórico de pagamentos" exija ver a lista renderizada de verdade na página, aí usar Tiago com a disciplina de sempre (limpar por ID específico ao final, não por `client_id`, já que aqui `id` de linha existe de verdade).
