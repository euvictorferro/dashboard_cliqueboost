-- Rate limit genérico por chave (ex: "extract-tasks:cliente-x"). Mesmo padrão do
-- record_login_attempt, mas reutilizável em qualquer rota cara (IA etc), não só login.
create table if not exists rate_limits (
  bucket text not null,
  hit_at timestamptz not null default now()
);
create index if not exists rate_limits_bucket_time on rate_limits (bucket, hit_at);

alter table rate_limits enable row level security;

-- Registra um hit e devolve quantos hits a chave teve na janela. O app bloqueia acima do limite.
-- Limpa linhas velhas na mesma chamada pra tabela não crescer sem fim.
create or replace function record_rate_hit(p_bucket text, p_window_seconds integer)
returns integer
language plpgsql
as $$
declare
  hits integer;
begin
  delete from rate_limits where hit_at < now() - interval '1 day';
  insert into rate_limits (bucket) values (p_bucket);
  select count(*) into hits
    from rate_limits
    where bucket = p_bucket
      and hit_at > now() - (p_window_seconds || ' seconds')::interval;
  return hits;
end;
$$;
