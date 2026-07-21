-- Corrige "new row violates row-level security policy for table goals" (42501).
-- goals_member exigía una fila en goal_members para autorizar el INSERT, pero esa fila de
-- goal_members no puede existir todavía (su FK apunta a goals.id, que recién se está creando):
-- un huevo-y-gallina. Se separa: el INSERT se autoriza por owner_id = auth.uid(); el resto
-- de operaciones (select/update/delete) sigue controlado por membresía en goal_members.

drop policy if exists goals_member on goals;

create policy goals_insert on goals for insert
  with check (owner_id = auth.uid());

create policy goals_select on goals for select
  using (is_goal_member(goals.id, auth.uid()));

create policy goals_update on goals for update
  using (is_goal_member(goals.id, auth.uid()))
  with check (is_goal_member(goals.id, auth.uid()));

create policy goals_delete on goals for delete
  using (is_goal_member(goals.id, auth.uid()));
