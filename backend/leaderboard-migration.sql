-- Run AFTER backend/schema.sql. Required for first-to-beat leaderboard.
-- Existing rows do not have trustworthy first-clear timestamps; do not backfill them.
alter table public.showdown_results
  add column if not exists first_cleared_at timestamptz;

-- Percentage scoring is 0..100 in the browser, not 0..300.
-- Existing invalid rows must be investigated before applying this constraint.
alter table public.showdown_results drop constraint if exists showdown_results_best_score_check;
alter table public.showdown_results
  add constraint showdown_results_best_score_check check (best_score between 0 and 100);

alter table public.showdown_results
  add constraint first_clear_requires_perfect_score
  check (first_cleared_at is null or best_score = 100);

create index if not exists showdown_first_clear_idx
  on public.showdown_results(challenge_date, first_cleared_at)
  where first_cleared_at is not null;

-- The trusted score submission endpoint must:
-- 1. validate the authenticated user's server-issued car ownership,
-- 2. calculate score against the published boss on the server,
-- 3. update best_score only if improved,
-- 4. set first_cleared_at on the FIRST verified 100% submission, never overwrite it,
-- 5. preserve original timestamp under concurrent submissions.
-- No client INSERT/UPDATE policy is intentionally granted.
