-- Substitutions the brewer has explicitly accepted for a recipe.
--
-- The matcher proposes stand-ins from the user's own inventory (malts from the
-- equivalence guide, hops from the Brouwland chart). Accepting one is a
-- judgement the engine cannot make for itself — most sharply for hops, where a
-- recipe line carries no use/time so a bittering charge and a whirlpool
-- addition are indistinguishable. Once accepted, the line counts as satisfied
-- and readiness recalculates.
--
-- Scoped per recipe on purpose: the same swap can be right in one beer and
-- wrong in another. The user's own (non-secret) data, so a plain table with
-- owner-only RLS — no Vault.

create table if not exists public.accepted_substitutions (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Brewfather recipe `_id`.
  recipe_id text not null,
  -- Stable identity for the recipe line: "<category> <normalized name>".
  -- Recipe ingredient ids are frequently empty in Brewfather data, so the
  -- normalized name is what the matcher can reliably key on.
  ingredient_key text not null,
  -- The inventory item accepted as the stand-in. Kept by both id and name:
  -- the id is exact, the name survives an inventory row being replaced (which
  -- happens — Brewfather keeps duplicate rows for the same malt).
  inventory_item_id text not null,
  inventory_item_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id, ingredient_key)
);

alter table public.accepted_substitutions enable row level security;

drop policy if exists "own_accepted_subs_all" on public.accepted_substitutions;
create policy "own_accepted_subs_all" on public.accepted_substitutions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.accepted_substitutions to authenticated;

-- Reading the whole set for one dashboard load is the hot path.
create index if not exists accepted_substitutions_user_idx
  on public.accepted_substitutions (user_id);
