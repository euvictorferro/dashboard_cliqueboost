-- supabase/migrations/0028_native_tasks.sql
-- Admin Panel Fase 2 (spec 2026-08-25): kanban de tasks nativo, mata o ClickUp.
alter table clients add column if not exists is_test boolean not null default false;

create table if not exists task_statuses (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  name text not null,
  color text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  client_id text not null references clients(id),
  status_id uuid not null references task_statuses(id),
  title text not null,
  description text not null default '',
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  assignee_admin_user_id uuid references admin_users(id),
  due_at timestamptz,
  position integer not null default 0,
  created_by uuid not null references admin_users(id),
  created_at timestamptz not null default now()
);
create index if not exists tasks_client_id_idx on tasks (client_id);
create index if not exists tasks_status_id_idx on tasks (status_id);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_admin_user_id uuid references admin_users(id),
  author_client_id text references clients(id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint task_comments_single_author check (
    (author_admin_user_id is not null) <> (author_client_id is not null)
  )
);
create index if not exists task_comments_task_id_idx on task_comments (task_id);

create table if not exists task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_checklist_items_task_id_idx on task_checklist_items (task_id);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  uploaded_by_admin_user_id uuid not null references admin_users(id),
  created_at timestamptz not null default now()
);
create index if not exists task_attachments_task_id_idx on task_attachments (task_id);

create table if not exists task_tags (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists task_tag_links (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id uuid not null references task_tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

alter table task_statuses enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_checklist_items enable row level security;
alter table task_attachments enable row level security;
alter table task_tags enable row level security;
alter table task_tag_links enable row level security;
-- ponytail: sem policies ainda (mesma decisão registrada em ARCHITECTURE.md) — todo acesso
-- passa por getSupabaseAdmin() (Service Role, ignora RLS). Policies reais entram junto da
-- virada multi-tenant.

-- Colunas do kanban por padrão (compartilhadas por toda a agência na v1 — customização por
-- cliente fica pra quando houver demanda real).
insert into task_statuses (agency_id, name, color, position)
values
  ('cliqueboost', 'A Fazer', '#94a3b8', 0),
  ('cliqueboost', 'Em Andamento', '#f59e0b', 1),
  ('cliqueboost', 'Concluído', '#22c55e', 2)
on conflict do nothing;
