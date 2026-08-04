create table if not exists chat_usage (
  client_id text not null,
  day date not null,
  count integer not null default 0,
  primary key (client_id, day)
);

alter table chat_usage enable row level security;

create or replace function increment_chat_usage(p_client_id text, p_day date)
returns integer
language sql
as $$
  insert into chat_usage (client_id, day, count)
  values (p_client_id, p_day, 1)
  on conflict (client_id, day)
  do update set count = chat_usage.count + 1
  returning count;
$$;
