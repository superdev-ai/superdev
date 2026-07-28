-- What a module excludes, and what a feature is for.
--
-- Section 8.3 step 4 of the requirements document asks, for every module, "What
-- is explicitly outside its scope?". There was nowhere to put the answer.
-- Features carry scope_in_json and scope_out_json; modules carried neither, so
-- the boundary that makes a module a module had to be folded into its purpose
-- as prose or dropped.
--
-- A module without a stated boundary is the failure the document names in
-- section 3: unclear architecture, and work that drifts because nobody wrote
-- down where one part stops.

ALTER TABLE modules ADD COLUMN out_of_scope TEXT;

-- Which people this module serves, from the same interview. Kept as text rather
-- than a link table because the answer is usually a sentence naming a role, and
-- a role row may not exist yet at discovery time.
ALTER TABLE modules ADD COLUMN primary_users TEXT;

-- Section 8.3 step 5 asks for a feature's user problem and intended outcome
-- before anything else. user_statement holds the first; the table already has
-- user_value for the second. Without it a feature is a title and a purpose,
-- which is what makes a specification thin enough to build the wrong thing.
--
-- features.user_statement already exists, so only the module columns are added
-- here. This migration is named for both because the boundary question is one
-- question asked at two levels.
