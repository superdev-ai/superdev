-- A question's options, and which of them is recommended.
--
-- `alternatives_json` has held the options since the first migration, and both
-- surfaces treated them as prose: the control centre folded them into a read-only
-- list and offered no way to answer at all, and the command line took a free-text
-- answer only. So a question arrived with its options already worked out and the
-- reader had to retype one of them.
--
-- Three things were missing to make an option selectable rather than readable.
--
-- `select_mode` because some questions take one answer and some take several.
-- "Which database?" is one. "Which roles exist?" is several. Guessing wrongly in
-- either direction produces a record that does not say what the reader meant.
--
-- `recommended_json` because `recommendation` holds advice in prose ("State the
-- outcome in one sentence and name one thing you could observe"), which cannot be
-- matched against an option to tag it. Naming the recommended options separately
-- lets the tag sit on the option itself.
--
-- `recommendation_why` because a recommendation nobody can weigh is an
-- instruction. The reason is what lets somebody disagree with it on purpose.

ALTER TABLE questions ADD COLUMN select_mode TEXT NOT NULL DEFAULT 'one'
  CHECK (select_mode IN ('one', 'many'));

ALTER TABLE questions ADD COLUMN recommended_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE questions ADD COLUMN recommendation_why TEXT;
