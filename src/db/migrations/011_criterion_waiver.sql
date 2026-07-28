-- Why a criterion was set aside.
--
-- The status vocabulary has allowed 'waived' since the first migration, two
-- refusals tell the reader to waive a criterion, and nothing could record one:
-- there was no command, and no column for the reason if there had been. A
-- status nothing can reach is the same as no status at all, except that it
-- makes the refusal a dead end.
--
-- The reason is the whole point. A waived criterion without one reads exactly
-- like a criterion somebody quietly stopped trying to meet, which is what
-- evidence gating exists to prevent.

ALTER TABLE feature_acceptance_criteria ADD COLUMN waiver_reason TEXT;
