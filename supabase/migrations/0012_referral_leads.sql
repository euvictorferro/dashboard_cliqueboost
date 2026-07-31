-- supabase/migrations/0012_referral_leads.sql
create table if not exists referral_leads (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id text not null,
  name text not null,
  contact text not null,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table referral_leads enable row level security;
