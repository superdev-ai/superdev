-- Memory retrieval, link integrity, idempotent capture and honest verification.
--
-- Measured on the engine before designing this: under MVCC every virtual table
-- is refused outright ("Virtual tables are not supported in MVCC mode"), and
-- under WAL the bundled build reports "no such module: fts5" and "no such
-- module: rtree". So full-text retrieval is an inverted index in ordinary
-- tables, not FTS5, and not a scan over the newest N rows.

-- ------------------------------------------------------- inverted term index

-- One row per (memory, term, field). Retrieval selects candidates through the
-- term index and only then applies recency, authority and epistemic weighting,
-- so a relevant memory stays reachable no matter how old it is or how many
-- newer ones exist.
CREATE TABLE memory_search_terms (
  memory_id    TEXT NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  term         TEXT NOT NULL,
  field        TEXT NOT NULL CHECK (field IN ('title','content','source_ref')),
  frequency    INTEGER NOT NULL DEFAULT 1,
  field_weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (memory_id, term, field)
);

-- The lookup direction: term first. Without this the index is a scan wearing a
-- table's clothes.
CREATE INDEX memory_search_terms_term ON memory_search_terms(term, memory_id);

-- --------------------------------------------------------- idempotent capture

-- A hook, a compaction and a handoff all retry. Without a deterministic key the
-- same observation lands three times and recall starts reporting its own echo
-- as corroboration.
ALTER TABLE memory_entries ADD COLUMN dedupe_key TEXT;
ALTER TABLE memory_entries ADD COLUMN source_event_id TEXT;
ALTER TABLE memory_entries ADD COLUMN content_hash TEXT;

-- Deliberately scoped to an explicit key rather than to the content hash: two
-- genuinely different observations may be worded alike, and collapsing those
-- would lose real information. Only a caller-supplied key claims "this is the
-- same delivery".
CREATE UNIQUE INDEX memory_entries_dedupe
  ON memory_entries(project_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX memory_entries_source_event
  ON memory_entries(source_event_id) WHERE source_event_id IS NOT NULL;

-- --------------------------------------------------------- honest verification

-- Rebuilt rather than altered: target_type gains a CHECK, and every link now
-- captures what the target looked like when the memory was written. Existence
-- alone can never prove a recalled fact is still true, so the version and
-- fingerprint recorded here are what later distinguishes verified from
-- needs_review.
CREATE TABLE memory_links_v2 (
  memory_id          TEXT NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  target_type        TEXT NOT NULL CHECK (target_type IN (
                       'task','feature','workflow','workflow_step','decision',
                       'branch','verification_evidence','module','milestone',
                       'goal','surface','ui_action','api_operation','data_entity',
                       'integration','question','work_session')),
  target_id          TEXT NOT NULL,
  relationship       TEXT NOT NULL DEFAULT 'about',
  target_version     INTEGER,
  target_fingerprint TEXT,
  created_at         TEXT,
  PRIMARY KEY (memory_id, target_type, target_id)
);

INSERT INTO memory_links_v2 (memory_id, target_type, target_id, relationship)
SELECT memory_id, target_type, target_id, relationship FROM memory_links
WHERE target_type IN (
  'task','feature','workflow','workflow_step','decision','branch',
  'verification_evidence','module','milestone','goal','surface','ui_action',
  'api_operation','data_entity','integration','question','work_session');

DROP TABLE memory_links;

ALTER TABLE memory_links_v2 RENAME TO memory_links;

-- Reverse lookup: "what do we remember about this record". Structured recall
-- filters through here, not only through the direct task and feature columns.
CREATE INDEX memory_links_reverse ON memory_links(target_type, target_id, memory_id);

-- ------------------------------------------------------------ link integrity

-- A link to a record that does not exist is not a weak link, it is a false one.
-- SQLite cannot express a foreign key whose table depends on a column value, so
-- each supported type gets its own guard.
CREATE TRIGGER memory_links_task_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'task' AND NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_feature_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'feature' AND NOT EXISTS (SELECT 1 FROM features WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_workflow_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'workflow' AND NOT EXISTS (SELECT 1 FROM workflows WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_workflow_step_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'workflow_step' AND NOT EXISTS (SELECT 1 FROM workflow_steps WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_decision_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'decision' AND NOT EXISTS (SELECT 1 FROM decisions WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_branch_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'branch' AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_evidence_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'verification_evidence' AND NOT EXISTS (SELECT 1 FROM verification_evidence WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_module_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'module' AND NOT EXISTS (SELECT 1 FROM modules WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_milestone_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'milestone' AND NOT EXISTS (SELECT 1 FROM milestones WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_goal_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'goal' AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_session_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'work_session' AND NOT EXISTS (SELECT 1 FROM work_sessions WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

CREATE TRIGGER memory_links_question_exists
BEFORE INSERT ON memory_links
WHEN NEW.target_type = 'question' AND NOT EXISTS (SELECT 1 FROM questions WHERE id = NEW.target_id)
BEGIN SELECT RAISE(ABORT, 'E_MEMORY_LINK_ORPHAN'); END;

-- ------------------------------------------------------------ embedding seam

-- The seam, kept separate and empty. The embedding column on memory_entries was
-- a placeholder that looked like a finished vector design and was not: it had no
-- provider, no model, no dimensions, and nothing recording which content it was
-- computed from. This table is the honest shape. Nothing populates it in this
-- release, and this engine has no vector index, so any future recall through it
-- is a bounded scan and must say so.
CREATE TABLE memory_embeddings (
  memory_id    TEXT NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  dimensions   INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  embedding    BLOB,
  generated_at TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready','stale','failed')),
  PRIMARY KEY (memory_id, provider, model)
);
