-- Corrige que .upsert() sobre goals siga fallando con 42501 aun con goals_insert correcto:
-- INSERT ... ON CONFLICT DO UPDATE (lo que genera un upsert) exige satisfacer también la
-- política de UPDATE, incluso para una fila nueva sin conflicto real. goals_update solo
-- permitía acceso vía goal_members, y esa fila de membresía todavía no existe en el primer
-- upsert de una meta nueva. Fix: el dueño (owner_id) siempre tiene acceso directo, sin
-- depender de goal_members (que sigue existiendo para dar acceso a otros miembros).

drop policy if exists goals_select on goals;
create policy goals_select on goals for select
  using (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()));

drop policy if exists goals_update on goals;
create policy goals_update on goals for update
  using (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()))
  with check (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()));

drop policy if exists goals_delete on goals;
create policy goals_delete on goals for delete
  using (owner_id = auth.uid() or is_goal_member(goals.id, auth.uid()));
