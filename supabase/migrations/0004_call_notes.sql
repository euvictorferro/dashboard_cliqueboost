create table if not exists call_notes (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  title text not null,
  call_date date not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table call_notes enable row level security;
