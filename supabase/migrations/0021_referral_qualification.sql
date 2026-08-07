-- Indicação só qualifica se o 1º pagamento do indicado for >= o plano mínimo (US$ 350).
-- disqualified_at marca indicações cujo 1º pagamento ficou abaixo do piso (decisão permanente).
alter table referral_leads add column if not exists disqualified_at timestamptz;
