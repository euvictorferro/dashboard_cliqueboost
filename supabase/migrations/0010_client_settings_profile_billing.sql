-- supabase/migrations/0010_client_settings_profile_billing.sql
alter table client_settings add column if not exists contact_email text;
alter table client_settings add column if not exists plan_name text;
alter table client_settings add column if not exists payment_status text;

create table if not exists client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  paid_at date not null,
  amount numeric,
  created_at timestamptz not null default now()
);
