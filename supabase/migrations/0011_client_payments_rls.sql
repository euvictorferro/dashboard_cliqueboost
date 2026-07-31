-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
-- client_payments foi criada na migration 0010 sem essa linha (achado do review final) — corrigido aqui.
alter table client_payments enable row level security;
