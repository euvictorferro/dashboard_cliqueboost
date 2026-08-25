-- supabase/migrations/0027_client_accounts_onboarding.sql
-- Tour guiado no primeiro acesso (depois de trocar as credenciais temporárias, se aplicável).
alter table client_accounts add column if not exists has_seen_onboarding boolean not null default false;
