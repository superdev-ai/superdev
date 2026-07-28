-- Evidence can prove a goal success criterion, not only an acceptance criterion.
--
-- `task evidence --criterion GSC-0002` resolved the identifier, planned happily,
-- printed "which this marks met", and then died on `FOREIGN KEY constraint failed`
-- because the column it was being written into references
-- feature_acceptance_criteria. So a project could verify four of its five goal
-- criteria against a running deployment and record none of them, while progress
-- reported forty percent and no command could correct it. A figure that looks
-- authoritative and understates the truth is worse than a missing one.
--
-- The alternative design was to derive a goal criterion from the acceptance
-- criteria of the features serving that goal. It is rejected: a goal can be served
-- by features that are all finished and still not be reached, and keeping outcomes
-- separate from output is the reason goals exist as their own records. A goal
-- criterion carries a measurement method and a target because it is meant to be
-- read against the running product, which is exactly what evidence is.
--
-- A separate column rather than a wider foreign key, so each target keeps its own
-- referential integrity. That at most one of the two is set is enforced in code,
-- because SQLite cannot add a CHECK to an existing table.

ALTER TABLE verification_evidence
  ADD COLUMN goal_criterion_id TEXT REFERENCES goal_success_criteria(id) ON DELETE SET NULL;

CREATE INDEX verification_evidence_goal_criterion
  ON verification_evidence(goal_criterion_id) WHERE goal_criterion_id IS NOT NULL;
