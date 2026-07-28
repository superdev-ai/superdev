-- What synchronization needs to be real rather than described.
--
-- sync_peers and sync_conflicts have existed since the first migration and
-- nothing ever wrote to them: the commands refused, naming three decisions in
-- section 23 that were open. Those decisions are now recorded, so this adds the
-- three things the protocol needs that the schema could not express.
--
-- A base snapshot, so a conflict can be detected rather than guessed. Knowing
-- that two copies differ is not enough to know who changed what: without the
-- version both sides agreed on last time, every difference looks like a
-- conflict and a copy that only pulled would be told it had diverged.
--
-- A lease, so an assignment can be held across machines. The partial unique
-- index already makes two active assignments impossible in one database, and
-- says nothing about a second machine. A lease names its holder and expires, so
-- a crashed machine releases its claim without anyone intervening.
--
-- Where a peer is and how it is reached, because a peer nothing can locate is a
-- row rather than a connection.

-- What both sides agreed on at the end of the last successful sync. The middle
-- term of a three-way comparison, and the only thing that distinguishes "they
-- changed it" from "we both changed it".
CREATE TABLE sync_base (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  peer_id       TEXT NOT NULL REFERENCES sync_peers(id) ON DELETE CASCADE,
  record_type   TEXT NOT NULL,
  record_id     TEXT NOT NULL,
  -- The version both sides held, and a hash of the row as it stood. The hash
  -- catches a change to a table with no version column, which several have.
  base_version  INTEGER,
  base_hash     TEXT NOT NULL,
  synced_at     TEXT NOT NULL,
  UNIQUE (peer_id, record_type, record_id)
);
CREATE INDEX sync_base_peer ON sync_base(peer_id, record_type);

-- How to reach a peer, and which key opens what it holds.
ALTER TABLE sync_peers ADD COLUMN transport TEXT NOT NULL DEFAULT 'directory';
ALTER TABLE sync_peers ADD COLUMN location TEXT;
ALTER TABLE sync_peers ADD COLUMN alias TEXT;
ALTER TABLE sync_peers ADD COLUMN key_fingerprint TEXT;
ALTER TABLE sync_peers ADD COLUMN connected_at TEXT;

-- An assignment that can be held from another machine.
--
-- The holder is an alias rather than a person: section 18 forbids disclosing a
-- developer's identity across the boundary, and refusing a second claim only
-- needs a name the other side recognises, not who that name belongs to.
ALTER TABLE task_assignments ADD COLUMN lease_holder TEXT;
ALTER TABLE task_assignments ADD COLUMN lease_expires_at TEXT;
ALTER TABLE task_assignments ADD COLUMN origin_peer TEXT;

CREATE INDEX task_assignments_lease ON task_assignments(lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;
