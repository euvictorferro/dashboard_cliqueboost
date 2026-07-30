# Conta — Tempo de Contrato

## Contexto

Terceira sub-feature da página Conta (depois de Fuso horário e Brand). Mostra há quanto tempo o cliente está com a Clique Boost. Investigação em um projeto irmão (Social Media Clique Boost) mostrou que os dados reais de início de contrato lá não são confiáveis (`payment_confirmed_at` idêntico pra todos os clientes — parece backfill de migração, não data real; `created_at` também não bate com as durações que o Victor confirmou de memória). Decisão: construir a feature funcional agora, com o dado vazio (`null`), e popular/corrigir as datas reais depois, sob demanda do Victor (mesmo padrão manual já usado nas Atas).

## Escopo

- Reaproveitar a tabela `client_settings` (já `client_id text primary key`, usada por Fuso horário e Brand) em vez de criar tabela nova — mais uma coluna, não mais uma tabela.
- Campo é **só leitura** na UI do cliente. Não existe formulário de edição — quem atualiza a data é o Victor, pedindo diretamente (SQL/update pontual), como já acontece com as Atas.
- Duração exibida como texto: "X meses" (quando < 12 meses) ou "X anos e Y meses" (quando ≥ 12 meses), calculada a partir de `contract_start_date` até a data atual do servidor.
- Quando `contract_start_date` é `null`: mostrar "Ainda não configurado" em vez de quebrar ou mostrar 0.

## Arquitetura

- Migration `0008_client_settings_contract.sql`: `alter table client_settings add column if not exists contract_start_date date;`
- `src/lib/clientSettings.ts`: `ClientSettings` ganha `contractStart: string | null` (formato `YYYY-MM-DD`); `fetchClientSettings` seleciona `contract_start_date` junto.
- `src/lib/contractDuration.ts` (novo arquivo): `formatContractDuration(startDate: string | null, now: Date): string` — função pura, sem I/O, cobre os 3 casos (null, <12 meses, ≥12 meses).
- `src/app/api/conta/[client]/route.ts` (GET existente): resposta ganha `contractStart` (data crua) e `contractDuration` (string já formatada, calculada com `new Date()` no momento da request).
- `src/components/ContaPageClient.tsx`: novo card "Tempo de contrato" (mesmo estilo visual dos cards de Fuso horário/Brand), mostrando só a duração formatada — sem inputs, sem botão de salvar.

## Testes

- `contractDuration.ts` é função pura — testável isoladamente com casos fixos (null, 1 mês, 11 meses, 12 meses, 13 meses, 24 meses).
- Verificação ao vivo: inserir `contract_start_date` de teste num cliente sandbox (Tiago), confirmar texto certo na página Conta, depois reverter (mesma disciplina de limpeza já documentada em memória — `client_id` é PK aqui, então usar Tiago com checagem vazio-antes/depois, já que o teste precisa renderizar a página de verdade).

## Fora de escopo

- Popular as datas reais dos 6 clientes agora (fica pra depois, sob demanda do Victor).
- Qualquer UI de edição da data (nem para o cliente, nem admin) — atualização é manual via Victor/Claude direto no banco.
- Os campos `plan_id`/`payment_status` do projeto irmão — não fazem parte desta sub-feature.
