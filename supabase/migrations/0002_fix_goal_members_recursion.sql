-- Corrige "infinite recursion detected in policy for relation goal_members" (código 42P17).
-- La política goal_members_select consultaba goal_members dentro de su propia definición,
-- lo que fuerza a Postgres a re-evaluar la misma política una y otra vez. Se reemplaza por
-- una función security definer que consulta la tabla sin pasar de nuevo por RLS.

create or replace function is_goal_member(_goal_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from goal_members m where m.goal_id = _goal_id and m.user_id = _user_id)
$$;

drop policy if exists goal_members_select on goal_members;
create policy goal_members_select on goal_members for select
  using (is_goal_member(goal_id, auth.uid()));

drop policy if exists goals_member on goals;
create policy goals_member on goals for all
  using (is_goal_member(goals.id, auth.uid()))
  with check (is_goal_member(goals.id, auth.uid()));

drop policy if exists goal_contributions_member on goal_contributions;
create policy goal_contributions_member on goal_contributions for all
  using (is_goal_member(goal_contributions.goal_id, auth.uid()))
  with check (is_goal_member(goal_contributions.goal_id, auth.uid()));
