-- supabase/migrations/0026_client_accounts_must_reset.sql
-- Contas temporárias (email @cliqueboost.io + senha provisória, criadas por nós) forçam o
-- cliente a trocar email/senha no primeiro acesso antes de usar o resto do app.
alter table client_accounts add column if not exists must_reset_credentials boolean not null default false;
