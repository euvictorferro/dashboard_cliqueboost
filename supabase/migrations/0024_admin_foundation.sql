-- supabase/migrations/0024_admin_foundation.sql
-- Fundação do Admin Panel (spec 2026-08-07): multi-tenant desde o dia 1.
create table if not exists agencies (
  id text primary key,          -- slug, ex: 'cliqueboost'
  name text not null,
  created_at timestamptz not null default now()
);
insert into agencies (id, name) values ('cliqueboost', 'Clique Boost')
  on conflict (id) do nothing;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  user_id uuid not null unique,  -- id do Supabase Auth
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Substitui o array CLIENTS hardcoded de src/lib/clients.ts.
create table if not exists clients (
  id text primary key,           -- slug da URL, ex: 'tiago'
  agency_id text not null references agencies(id),
  name text not null,
  instagram_business_id text,
  clickup_list_id text,          -- integração legada, morre na fase 2
  trello_board_id text,          -- integração legada, morre na fase 3
  ad_account_id text,
  ads_active boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table agencies enable row level security;
alter table admin_users enable row level security;
alter table clients enable row level security;

-- Seed: clientes atuais de src/lib/clients.ts (valores transcritos do arquivo).
insert into clients (id, agency_id, name, instagram_business_id, clickup_list_id, trello_board_id, ad_account_id, ads_active)
values
  ('debora', 'cliqueboost', 'Débora Segnini', '17841460379583584', '901714744652', '6a45322767a3396275720779', '2747334925666942', false),
  ('lais', 'cliqueboost', 'Laís Daltrozo', '17841401799523851', '901714211778', '6a1d9bfebe2405767f61e0d6', '2095558858011678', false),
  ('sam', 'cliqueboost', 'Sam', '17841403158327784', '901711532887', '68dacb7ba8957ca2511e9071', null, false),
  ('nelson', 'cliqueboost', 'Nelson', '17841433504082304', '901711532905', '6a62cc0c3349ba1222b431e0', '959090240381783', false),
  ('tiago', 'cliqueboost', 'Tiago Zamboni', '17841401844913174', '901713981087', '6a15e2cce98811c102520e22', null, false),
  ('bela', 'cliqueboost', 'Bela Castro', '17841445125553950', '901711532881', '68f4f4c34ad83399f540858a', null, false)
on conflict (id) do nothing;
