-- supabase/migrations/0018_client_ratings.sql
create table if not exists client_ratings (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  month_ref date not null,
  stars numeric(2,1) not null check (stars >= 0.5 and stars <= 5 and stars * 2 = round(stars * 2)),
  feedback text,
  created_at timestamptz not null default now(),
  unique (client_id, month_ref)
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de bug_reports/referral_leads.
alter table client_ratings enable row level security;
