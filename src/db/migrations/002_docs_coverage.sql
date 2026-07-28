-- Storage for Docs template fields that version 1 left homeless. Without these
-- the renderer would have to invent a place to keep them, which is how a second
-- writable source of truth gets created by accident.

-- foundations.md asks for explicit non-goals and a project-level scope. Feature
-- scope does not roll up to answer "what is deliberately out of scope".
CREATE TABLE project_scope_items (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('in','out','non_goal')),
  statement  TEXT NOT NULL,
  why        TEXT,
  horizon    TEXT,
  sequence   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX project_scope_items_project ON project_scope_items(project_id, direction, sequence);

-- foundations.md requires a glossary. One meaning per term.
CREATE TABLE glossary_terms (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  term       TEXT NOT NULL,
  meaning    TEXT NOT NULL,
  source_ref TEXT,
  UNIQUE (project_id, term)
);

-- architecture.md's runtime pieces table. Modules are a logical decomposition,
-- not a runtime topology, so they cannot answer "runs where, talks to what".
CREATE TABLE runtime_pieces (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  runs_where   TEXT,
  evidence_ref TEXT,
  sequence     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, name)
);

CREATE TABLE runtime_piece_edges (
  from_piece_id TEXT NOT NULL REFERENCES runtime_pieces(id) ON DELETE CASCADE,
  to_piece_id   TEXT NOT NULL REFERENCES runtime_pieces(id) ON DELETE CASCADE,
  protocol      TEXT,
  PRIMARY KEY (from_piece_id, to_piece_id)
);

-- The ADR template carries four relationship statuses that version 1 could not
-- store. Partial supersession needs its exact scope, not just a pointer.
CREATE TABLE decision_links (
  id           TEXT PRIMARY KEY,
  decision_id  TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN
               ('decision','feature','module','workflow','document','api_operation','data_entity','nfr')),
  target_id    TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN
               ('supersedes','partially_supersedes','amends','relates_to','governs')),
  scope_note   TEXT,
  created_at   TEXT NOT NULL,
  -- A partial supersession without its scope is the ambiguity the ADR
  -- lifecycle exists to prevent.
  CHECK (relationship <> 'partially_supersedes' OR scope_note IS NOT NULL)
);
CREATE INDEX decision_links_decision ON decision_links(decision_id);
CREATE INDEX decision_links_target ON decision_links(target_type, target_id);

-- A time-boxed decision needs an expiry, and it cannot be derived from
-- acceptance. An expired decision stops governing and starts asking.
ALTER TABLE decisions ADD COLUMN expires_at TEXT;

-- roles.md asks for Role, Who, and Primary goals. Two columns forced one of the
-- three into free prose.
ALTER TABLE roles ADD COLUMN who TEXT;
ALTER TABLE roles ADD COLUMN primary_goals TEXT;

-- Not every generated file is an authored projection. A changelog, a status
-- report and a drift report are derived views: they are rewritten every time
-- and must never be trapped behind an edit proposal. Without this distinction
-- one stray manual edit would permanently block regeneration of a report whose
-- whole purpose is to be current.
ALTER TABLE documents ADD COLUMN regeneration_mode TEXT NOT NULL DEFAULT 'authored_projection';

-- A project-wide revision would mark every document stale on any unrelated
-- write, so freshness is per document: a hash of the ordered records that fed
-- the render.
ALTER TABLE documents ADD COLUMN source_fingerprint TEXT;

-- Capability areas gain a catalog so the readiness checklist, the foundations
-- stack slots and the architecture boundaries share one shape and one query.
-- The table is rebuilt rather than altered because the uniqueness rule changes,
-- which is exactly the case an ordered migration exists to handle.
CREATE TABLE capability_areas_v2 (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  catalog         TEXT NOT NULL DEFAULT 'readiness'
                  CHECK (catalog IN ('readiness','stack_slot','boundary')),
  scope_type      TEXT NOT NULL DEFAULT 'project'
                  CHECK (scope_type IN ('project','module','feature')),
  scope_id        TEXT,
  area            TEXT NOT NULL,
  state           TEXT NOT NULL DEFAULT 'awaiting_decision'
                  CHECK (state IN ('specified','awaiting_decision','not_applicable','deferred')),
  choice          TEXT,
  evidence_ref    TEXT,
  decision_id     TEXT REFERENCES decisions(id) ON DELETE SET NULL,
  reason          TEXT,
  owner           TEXT,
  revisit_trigger TEXT,
  consequence     TEXT,
  question_id     TEXT REFERENCES questions(id) ON DELETE SET NULL,
  sequence        INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  CHECK (state = 'specified' OR reason IS NOT NULL),
  UNIQUE (project_id, catalog, scope_type, scope_id, area)
);

INSERT INTO capability_areas_v2
  (id, project_id, catalog, scope_type, scope_id, area, state, reason, owner,
   revisit_trigger, consequence, question_id, sequence, updated_at, version)
SELECT id, project_id, 'readiness', 'project', NULL, area, state, reason, owner,
       revisit_trigger, consequence, question_id, sequence, updated_at, version
FROM capability_areas;

DROP TABLE capability_areas;

ALTER TABLE capability_areas_v2 RENAME TO capability_areas;
