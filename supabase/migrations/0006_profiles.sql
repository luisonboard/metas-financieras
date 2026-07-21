-- Fase 6 — Metas conjuntas: perfiles públicos mínimos (email/nombre) visibles entre
-- co-miembros de una meta compartida. Se usan para el toast de Realtime
-- ("¡{nombre} aportó $X!") y la lista de miembros en la UI.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Security definer: evita que la política de profiles dependa de RLS sobre goal_members
-- para decidir si dos usuarios comparten una meta (mismo patrón que is_goal_member).
create or replace function shares_goal_with(_viewer uuid, _target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from goal_members gm1
    join goal_members gm2 on gm1.goal_id = gm2.goal_id
    where gm1.user_id = _viewer and gm2.user_id = _target
  )
$$;

create policy profiles_select on profiles for select
  using (id = auth.uid() or shares_goal_with(auth.uid(), id));

create policy profiles_upsert_self on profiles for insert
  with check (id = auth.uid());

create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Crea/actualiza el perfil automáticamente al registrarse o cambiar el email en auth.users,
-- para no depender de que el cliente lo sincronice explícitamente (cubre además OAuth).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function handle_new_user();

-- Backfill para cuentas creadas antes de esta migración.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
