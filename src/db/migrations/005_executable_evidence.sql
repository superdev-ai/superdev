-- Evidence that can be checked again.
--
-- verification_evidence already carried status ('current', 'stale',
-- 'superseded'), stale_at and content_hash, so the design always intended
-- evidence to go out of date. Nothing ever marked it. Evidence was a sentence
-- written once and believed forever, which is the same shape as every other
-- failure found in this codebase: an intention recorded on one side with no
-- mechanism on the other.
--
-- A claim that carries the command which proved it can be checked again. That
-- turns honesty from something asserted at one moment into something the
-- product keeps checking, and it is the only way a completed task can notice
-- that the ground moved under it.
--
-- check_command is nullable on purpose. Reading a screenshot, confirming a
-- decision with the owner, watching a migration run: these are real
-- verifications that no command reproduces. Requiring one would push people to
-- invent commands, which is worse than admitting a check is manual.

ALTER TABLE verification_evidence ADD COLUMN check_command TEXT;

-- When the command was last run, and what happened. Distinct from recorded_at,
-- which is when the claim was first made: the gap between the two is exactly
-- the question "is this still true?".
ALTER TABLE verification_evidence ADD COLUMN last_checked_at TEXT;
ALTER TABLE verification_evidence ADD COLUMN last_check_result TEXT
  CHECK (last_check_result IS NULL OR last_check_result IN ('pass', 'fail', 'error'));

-- Finding stale evidence is a scan over everything current that carries a
-- command, so it gets an index rather than a table walk on every run.
CREATE INDEX IF NOT EXISTS idx_evidence_recheck
  ON verification_evidence (status, check_command);
