-- supabase/migrations/0013_client_calls.sql
create table if not exists client_calls (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  scheduled_at timestamptz not null,
  google_event_id text not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

alter table client_calls enable row level security;
