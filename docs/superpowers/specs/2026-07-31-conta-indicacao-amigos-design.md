# Conta — Indicação de Amigos

## Contexto

Última das 5 sub-partes do item "Conta" do roadmap (depois de Fuso horário, Brand→revertido, Tempo de contrato, Perfil & Faturamento — falta ainda Briefing, que fica pra outra rodada). Cada cliente ganha um link de indicação (estilo Lovable/Claude) pra compartilhar. Como ainda não existe cadastro/login de cliente novo no site (roadmap item 6, não iniciado), o link não pode automaticamente transformar um clique em cliente — ele leva a uma página pública de captação de interesse, e o cadastro de "quem virou cliente de fato" continua manual (mesmo padrão de Atas/Faturamento).

## Escopo

- **Link de indicação**: reaproveita o `client_id` já existente como código — não há geração de código nova. Formato: `https://dash.cliqueboost.io/r/<client_id>` (ex: `/r/tiago`).
- **Página pública `/r/[client_id]`**: fora da área logada (sem `?key=`), acessível por qualquer um. Mostra "Você foi indicado pela Clique Boost" + formulário simples (nome, WhatsApp). Se `client_id` não existir em `CLIENTS`, 404.
- **Envio do formulário**: grava um lead vinculado ao cliente que indicou (`referrer_client_id`). Isso É o "registro do clique" — não há tracking de pageview sem submissão (decisão consciente pra não construir infra de analytics à toa).
- **Card "Indicação de amigos" na página Conta**: mostra o link completo (com botão "Copiar") + lista dos leads que esse cliente já indicou (nome, contato, data), só leitura.
- **Sem recompensa/desconto** — não existe campo pra isso ainda, porque não tem nada combinado hoje (confirmado com o Victor). Adiciona quando existir.

## Fora de escopo

- Cadastro/login de cliente novo de fato (depende do roadmap item 6, "Login do cliente").
- Qualquer automação de recompensa por indicação.
- Tracking de clique sem submissão de formulário.
- Edição do link pelo cliente (é sempre o `client_id`, fixo).

## Arquitetura

### Banco de dados

Migration `0012_referral_leads.sql`:
```sql
create table if not exists referral_leads (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id text not null,
  name text not null,
  contact text not null,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table referral_leads enable row level security;
```
(Padrão idêntico a `call_notes`/`client_payments` — RLS já vem junto desta vez, sem esperar um review pra pegar o esquecimento.)

### Código

- `src/lib/referralLeads.ts` (novo): `fetchReferralLeads(clientId): Promise<{id, name, contact, createdAt}[]>` (ordenado por `created_at desc`) e `createReferralLead(referrerClientId, name, contact): Promise<void>`.
- `src/app/r/[code]/page.tsx` (novo, público, Server Component): valida `CLIENTS.find(c => c.id === code)` → 404 se não existir; renderiza um Client Component com o formulário.
- `src/components/ReferralLeadForm.tsx` (novo, `"use client"`): campos nome/WhatsApp, POST pra `/api/referrals`, estado de sucesso/erro.
- `src/app/api/referrals/route.ts` (novo, POST, **sem** `verifyClientToken` — rota pública de verdade, protegida só por validação de `client_id` existente + validação básica dos campos): recebe `{ referrerClientId, name, contact }`, valida que `referrerClientId` existe em `CLIENTS`, chama `createReferralLead`.
- `src/app/api/conta/[client]/route.ts` (GET, modificar): adiciona `referralLeads` na resposta, buscando em paralelo com o resto (`Promise.all`).
- `src/components/ContaPageClient.tsx` (modificar): novo card "Indicação de amigos" — link montado como `${window.location.origin}/r/${clientId}`, botão copiar (usa `navigator.clipboard`), lista de leads (mesmo padrão visual da lista de pagamentos).

## Testes

- Verificação ao vivo: acessar `/r/tiago` sem key, confirmar que a página carrega; acessar `/r/cliente-inexistente`, confirmar 404.
- Enviar o formulário de teste, confirmar que aparece na página Conta do Tiago (lista de indicados).
- Limpar dado de teste: `referral_leads.id` é chave própria de linha (igual `client_payments`) — apagar pelo `id` específico retornado no insert, nunca por `referrer_client_id`.
- Confirmar que o botão "Copiar" copia a URL certa (checar `navigator.clipboard.writeText` foi chamado com o valor esperado, ou confirmar via leitura da área de transferência se o ambiente de teste permitir).
