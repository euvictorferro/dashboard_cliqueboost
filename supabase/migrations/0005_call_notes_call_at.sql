alter table call_notes rename column call_date to call_at;
alter table call_notes alter column call_at type timestamptz using call_at::timestamptz;
