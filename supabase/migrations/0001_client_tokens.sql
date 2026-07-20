create table if not exists client_tokens (
  client_id text primary key,
  token text not null unique,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table client_tokens enable row level security;
