create table if not exists client_settings (
  client_id text primary key,
  time_zone text not null default 'America/New_York'
);

alter table client_settings enable row level security;
