create table if not exists daily_metric_cache (
  ig_id text not null,
  metric text not null,
  date text not null, -- YYYY-MM-DD
  value integer not null,
  fetched_at timestamptz not null default now(),
  primary key (ig_id, metric, date)
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table daily_metric_cache enable row level security;
