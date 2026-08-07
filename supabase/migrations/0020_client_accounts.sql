-- supabase/migrations/0020_client_accounts.sql
create table if not exists client_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null unique,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de bug_reports/referral_leads/client_ratings.
alter table client_accounts enable row level security;
