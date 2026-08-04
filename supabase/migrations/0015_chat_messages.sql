create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;
