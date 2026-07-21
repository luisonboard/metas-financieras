-- Corrige 42501 en upsert de goal_members: goal_members_select dependía únicamente de
-- is_goal_member(...), una subconsulta contra la propia tabla vía función security definer.
-- Al hacer upsert (INSERT ... ON CONFLICT DO UPDATE con RETURNING), esa subconsulta no
-- garantiza ver de forma fiable la fila recién escrita dentro del mismo statement. Se agrega
-- un chequeo directo por columna (user_id = auth.uid()), que siempre es visible al instante
-- para la propia fila, sin pasar por una subconsulta.

drop policy if exists goal_members_select on goal_members;
create policy goal_members_select on goal_members for select
  using (user_id = auth.uid() or is_goal_member(goal_id, auth.uid()));
