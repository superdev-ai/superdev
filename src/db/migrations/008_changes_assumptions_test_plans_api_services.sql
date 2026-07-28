-- The four objects the requirements document names and the schema never built.
--
-- Section 6.1 defines each of them, 14.1 lists each as a record the local
-- database must store, and none of them existed. The record could name them and
-- nothing could hold one, so four capabilities the document promises had no
-- place to live: recording what altered accepted scope, recording a reversible
-- answer with its review trigger, recording how a feature will be verified, and
-- grouping API operations under the boundary that owns them.

-- A recorded alteration to accepted product scope or behaviour.
--
-- Section 6.2 says a Change must record the affected records and the reason,
-- and 14.2 says changes must preserve audit history. Activity events already
-- record that something happened; a change records that accepted scope moved
-- and why, which is a different claim and the one a reader asks about later.
CREATE TABLE changes (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary              TEXT NOT NULL,
  reason               TEXT NOT NULL,
  -- What kind of movement this was, so a reader can tell a widening from a
  -- correction without reading every one.
  change_type          TEXT NOT NULL DEFAULT 'scope_changed'
    CHECK (change_type IN ('scope_added', 'scope_removed', 'behavior_changed',
                           'contract_changed', 'correction', 'scope_changed')),
  requested_by         TEXT,
  decided_by           TEXT,
  -- The decision that authorised it, when one did. A change that contradicts an
  -- accepted decision without superseding it is the drift this product exists
  -- to prevent.
  decision_id          TEXT REFERENCES decisions(id) ON DELETE SET NULL,
  task_id              TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  session_id           TEXT,
  status               TEXT NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('proposed', 'recorded', 'reverted')),
  created_at           TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1
);

-- Which records a change moved. Polymorphic because a change can touch a
-- feature, a workflow, an entity or an operation, and one column cannot
-- reference six tables.
CREATE TABLE change_targets (
  change_id            TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  target_type          TEXT NOT NULL,
  target_id            TEXT NOT NULL,
  -- What moved about it, in plain language: "acceptance criterion added",
  -- "purpose rewritten". Without this the link says something changed and never
  -- what.
  what_changed         TEXT,
  PRIMARY KEY (change_id, target_type, target_id)
);

-- A reversible answer used temporarily.
--
-- Section 8.4 says "I do not know" is a valid answer, that Superdev may
-- recommend a reversible assumption, and that it must record the assumption and
-- its review trigger. Without somewhere to put one, an assumption becomes an
-- undocumented guess that nobody knows to revisit.
CREATE TABLE assumptions (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  statement            TEXT NOT NULL,
  -- Why this was assumed rather than decided. An assumption with no reason is
  -- indistinguishable from a decision nobody wrote down.
  why_assumed          TEXT NOT NULL,
  -- What would make this worth revisiting. Required, because an assumption with
  -- no trigger is never reviewed and quietly becomes a fact.
  review_trigger       TEXT NOT NULL,
  -- What breaks if the assumption turns out wrong.
  consequence_if_wrong TEXT,
  scope_type           TEXT,
  scope_id             TEXT,
  question_id          TEXT REFERENCES questions(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'holding'
    CHECK (status IN ('holding', 'confirmed', 'overturned', 'expired')),
  -- Set when the assumption stops holding, with what replaced it.
  resolved_by          TEXT,
  resolved_at          TEXT,
  resolution           TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1
);

-- The agreed verification strategy for a feature or a workflow.
--
-- Section 9.3 gates task completion on "product tests defined by the accepted
-- test plan" passing, and 7.2 requires generated test plan documents. The gate
-- named a document that could not exist. Section 20.2 says the strategy is the
-- product's own rather than one universal style, so the kinds are open text
-- with a check on the ones the document names.
CREATE TABLE test_plans (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature_id           TEXT REFERENCES features(id) ON DELETE CASCADE,
  workflow_id          TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  module_id            TEXT REFERENCES modules(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  strategy             TEXT NOT NULL,
  -- What running it looks like, so someone else can run it.
  how_to_run           TEXT,
  -- What counts as passing, in terms a person can check.
  passing_condition    TEXT,
  status               TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'accepted', 'superseded')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1
);

-- The individual checks a plan is made of.
CREATE TABLE test_plan_cases (
  id                   TEXT PRIMARY KEY,
  test_plan_id         TEXT NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  kind                 TEXT NOT NULL DEFAULT 'manual_check',
  -- What this case proves. A case that names no expectation proves nothing.
  expectation          TEXT NOT NULL,
  -- A command that runs it, when one exists. Null is honest for a check a
  -- person performs, and matches how verification_evidence treats the same
  -- question.
  command              TEXT,
  sequence             INTEGER NOT NULL DEFAULT 0
);

-- A logical API boundary.
--
-- Section 6.1 defines an API Service as the boundary and an API Operation as a
-- concrete endpoint within one. Only operations were stored, so every operation
-- was loose rather than grouped under the thing that owns it.
CREATE TABLE api_services (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id            TEXT REFERENCES modules(id) ON DELETE SET NULL,
  name                 TEXT NOT NULL,
  purpose              TEXT,
  style                TEXT NOT NULL DEFAULT 'rest'
    CHECK (style IN ('rest', 'graphql', 'rpc', 'events', 'local-only')),
  base_path            TEXT,
  auth_requirement     TEXT,
  versioning           TEXT,
  status               TEXT NOT NULL DEFAULT 'specified',
  sequence             INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1
);

-- Operations belong to the boundary that exposes them. Nullable, because an
-- operation recorded before its service is still worth having.
ALTER TABLE api_operations ADD COLUMN api_service_id TEXT REFERENCES api_services(id) ON DELETE SET NULL;

-- A change is a historical claim about what moved and when. Revising one
-- rewrites the audit trail that 14.2 requires be preserved, so the same
-- append-only rule that guards activity events guards these.
CREATE TRIGGER changes_no_update BEFORE UPDATE ON changes
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;
CREATE TRIGGER changes_no_delete BEFORE DELETE ON changes
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;

CREATE INDEX IF NOT EXISTS idx_changes_project ON changes (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_change_targets_target ON change_targets (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_status ON assumptions (project_id, status);
CREATE INDEX IF NOT EXISTS idx_test_plans_feature ON test_plans (feature_id);
CREATE INDEX IF NOT EXISTS idx_api_operations_service ON api_operations (api_service_id);
