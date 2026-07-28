-- Which task replaced this one.
--
-- Two records for the same work split its evidence and its progress: each looks
-- half finished, the feature they serve can never show either as done, and nothing
-- says they are the same work. Deleting one is not the answer, because a task
-- carries the reasons it existed and the evidence recorded against it, and history
-- here is append only by design.
--
-- So a duplicate is superseded, and this is where it says by what. Without the
-- column the relationship could only live in prose in an activity event, which
-- nothing can follow: somebody who finds the old identifier in a commit message or
-- a branch name has to be told where the work went.
--
-- memory_entries has carried a superseded_by since the first migration for exactly
-- this reason. Tasks needed the same thing and did not have it.

ALTER TABLE tasks ADD COLUMN superseded_by TEXT REFERENCES tasks(id);

CREATE INDEX tasks_superseded_by ON tasks(superseded_by) WHERE superseded_by IS NOT NULL;
