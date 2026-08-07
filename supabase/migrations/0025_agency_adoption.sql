-- supabase/migrations/0025_agency_adoption.sql
-- Tabelas pré-admin ganham agency_id, semeado com a Clique Boost.
alter table client_settings add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table referral_leads add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table client_payments add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table call_notes add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table client_calls add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table chat_messages add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table bug_reports add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table client_ratings add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);

-- Pra criar o primeiro admin (rodar depois desta migration):
-- 1. Criar o usuário no Supabase Auth (painel → Authentication → Users → Add user).
-- 2. Rodar, trocando <uuid-do-auth> pelo id gerado:
-- insert into admin_users (agency_id, user_id, name, email)
--   values ('cliqueboost', '<uuid-do-auth>', 'Victor Ferro', 'contato.cliqueboost@gmail.com');
