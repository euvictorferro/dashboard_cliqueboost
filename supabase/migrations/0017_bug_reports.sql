-- supabase/migrations/0017_bug_reports.sql
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  page text not null,
  description text not null,
  screenshot_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de referral_leads/chat_messages.
alter table bug_reports enable row level security;
