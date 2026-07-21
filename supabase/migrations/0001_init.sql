-- Presupuesto Diario — esquema inicial + RLS (Fase 5)
-- Convención: columnas snake_case en SQL; el cliente mapea a los tipos camelCase de src/domain/types.ts.

create table if not exists periods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  initial_money numeric not null,
  start_date date not null,
  next_payday_date date not null,
  next_salary_amount numeric not null default 0,
  status text not null check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists periods_user_id_idx on periods (user_id);

create table if not exists categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists categories_user_id_idx on categories (user_id);

create table if not exists expenses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null,
  category_id uuid,
  amount numeric not null,
  date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists expenses_user_id_idx on expenses (user_id);
create index if not exists expenses_period_id_idx on expenses (period_id);

create table if not exists extra_incomes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null,
  amount numeric not null,
  date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists extra_incomes_user_id_idx on extra_incomes (user_id);
create index if not exists extra_incomes_period_id_idx on extra_incomes (period_id);

create table if not exists goals (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('active', 'achieved', 'abandoned')),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists goal_members (
  id uuid primary key,
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (goal_id, user_id)
);
create index if not exists goal_members_user_id_idx on goal_members (user_id);
create index if not exists goal_members_goal_id_idx on goal_members (goal_id);

create table if not exists goal_contributions (
  id uuid primary key,
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists goal_contributions_goal_id_idx on goal_contributions (goal_id);

create table if not exists gamification (
  id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  best_streak int not null default 0,
  xp int not null default 0,
  level int not null default 1,
  achievements text[] not null default '{}',
  last_streak_check_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Row Level Security -------------------------------------------------------

alter table periods enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;
alter table extra_incomes enable row level security;
alter table goals enable row level security;
alter table goal_members enable row level security;
alter table goal_contributions enable row level security;
alter table gamification enable row level security;

-- Regla general: user_id = auth.uid() para select/insert/update en tablas "propias".
create policy periods_owner on periods for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy categories_owner on categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy expenses_owner on expenses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy extra_incomes_owner on extra_incomes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy gamification_owner on gamification for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chequeo de membresía en una función security definer: evita que la política de
-- goal_members se re-evalúe a sí misma (error 42P17 "infinite recursion detected in policy").
create or replace function is_goal_member(_goal_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from goal_members m where m.goal_id = _goal_id and m.user_id = _user_id)
$$;

-- goal_members: cada quien ve las membresías de las metas a las que pertenece
-- (no solo su propia fila), para poder listar co-miembros. Solo gestiona su propia fila.
-- El OR con user_id = auth.uid() evita depender solo de la subconsulta is_goal_member (vía
-- función) para ver la propia fila recién escrita dentro de un mismo upsert.
create policy goal_members_select on goal_members for select
  using (user_id = auth.uid() or is_goal_member(goal_id, auth.uid()));
create policy goal_members_insert on goal_members for insert
  with check (user_id = auth.uid());
create policy goal_members_update on goal_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goal_members_delete on goal_members for delete
  using (user_id = auth.uid());

-- goals: el INSERT se autoriza por owner_id (la fila de goal_members todavía no puede existir,
-- su FK apunta a este goal.id). El resto de operaciones acepta owner_id O membresía: un
-- upsert (INSERT ... ON CONFLICT DO UPDATE) exige satisfacer también la política de UPDATE
-- incluso para una fila nueva sin conflicto, así que el dueño necesita acceso directo ahí
-- también, sin depender de que su propia fila de goal_members ya exista.
create policy goals_insert on goals for insert
  with check (owner_id = auth.uid());

create policy goals_select on goals for select
  using (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()));

create policy goals_update on goals for update
  using (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()))
  with check (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()));

create policy goals_delete on goals for delete
  using (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()));

-- goal_contributions: acceso si existe fila en goal_members para ese goal_id (la meta y su
-- membresía ya existen para cuando se registra un aporte, así que no hay bootstrapping aquí).
create policy goal_contributions_member on goal_contributions for all
  using (is_goal_member(goal_contributions.goal_id, auth.uid()))
  with check (is_goal_member(goal_contributions.goal_id, auth.uid()));

-- Realtime ------------------------------------------------------------------

alter publication supabase_realtime add table goal_contributions;
alter publication supabase_realtime add table goal_members;
