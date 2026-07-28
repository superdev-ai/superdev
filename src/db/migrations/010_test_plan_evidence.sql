-- Connect evidence to the test plan it satisfies.
--
-- Section 9.3 lists five conditions for completing a task, and one of them is
-- that the product tests defined by the accepted test plan pass. The gate
-- enforced the other four. Test plans existed as records, were shown in the
-- control centre, and reached nothing: a task could complete with passing
-- evidence that had nothing to do with the plan the owner accepted.
--
-- The missing piece was small and structural. Evidence knew the task it proved
-- and the command that produced it, and had no way to say which agreed
-- verification strategy it was a run of. So a plan could never be satisfied,
-- and a gate that can never be satisfied is one nobody can write.

ALTER TABLE verification_evidence
  ADD COLUMN test_plan_id TEXT REFERENCES test_plans(id) ON DELETE SET NULL;

-- Asked on every completion, once per plan in scope, so it is worth an index
-- rather than a scan of every result ever recorded.
CREATE INDEX idx_verification_evidence_test_plan
  ON verification_evidence(test_plan_id) WHERE test_plan_id IS NOT NULL;
