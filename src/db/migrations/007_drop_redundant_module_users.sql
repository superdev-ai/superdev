-- Remove a column that duplicated one already there.
--
-- 006 added modules.primary_users without checking that modules.primary_users_json
-- already held the same answer. Two columns for "which people this module serves"
-- is worse than either alone: a reader has to work out which one is filled, and a
-- writer has to guess which one is read.
--
-- The column was added and dropped without ever being written to, so nothing is
-- lost. It is dropped in its own migration rather than by editing 006, because
-- an applied migration's checksum is recorded and changing the file after the
-- fact is exactly the drift the migration validator exists to catch.

ALTER TABLE modules DROP COLUMN primary_users;
