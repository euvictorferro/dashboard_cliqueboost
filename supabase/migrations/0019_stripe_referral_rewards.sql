alter table client_settings add column if not exists stripe_customer_id text;
alter table client_settings add column if not exists stripe_subscription_id text;

alter table referral_leads add column if not exists converted_client_id text;
alter table referral_leads add column if not exists discount_applied_at timestamptz;
