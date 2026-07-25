create table if not exists content_competitors (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  handle text not null,
  platform text not null check (platform in ('instagram', 'tiktok', 'linkedin')),
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table content_competitors enable row level security;
