-- Rate limit de login por IP (anti brute force). Mesmo padrão do increment_chat_usage:
-- um RPC atômico, sem dependência externa (Redis etc).
create table if not exists login_attempts (
  ip text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_time on login_attempts (ip, attempted_at);

alter table login_attempts enable row level security;

-- Registra a tentativa e devolve quantas tentativas o IP fez na janela.
-- O app bloqueia quando o retorno passa do limite. Limpa linhas velhas na mesma chamada
-- pra tabela não crescer sem fim.
create or replace function record_login_attempt(p_ip text, p_window_seconds integer)
returns integer
language plpgsql
as $$
declare
  attempts integer;
begin
  delete from login_attempts where attempted_at < now() - interval '1 hour';
  insert into login_attempts (ip) values (p_ip);
  select count(*) into attempts
    from login_attempts
    where ip = p_ip
      and attempted_at > now() - (p_window_seconds || ' seconds')::interval;
  return attempts;
end;
$$;
