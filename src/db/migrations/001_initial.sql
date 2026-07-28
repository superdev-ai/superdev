-- Superdev normalized schema, version 1.
--
-- Typed tables with real foreign keys. There is deliberately no generic node
-- table with a JSON field bag: the store has to be able to enforce what a
-- feature or a task actually requires. See ADR-0015.
--
-- Engine notes that shaped this file (measured, see ADR-0013):
--   - triggers with RAISE(ABORT, ...) are enforced, so the task mapping
--     constraint lives here rather than in application code
--   - WITH RECURSIVE is unavailable, so hierarchy walks are iterative in
--     application code and no view depends on recursion
--   - CHECK constraints are enforced

-- ---------------------------------------------------------------- 10.1 project

CREATE TABLE projects (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  statement      TEXT,
  problem        TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',
  working_mode   TEXT NOT NULL DEFAULT 'guided',
  docs_profile   TEXT NOT NULL DEFAULT 'talks-v1',
  local_authority INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE source_material (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path_or_label      TEXT NOT NULL,
  content_hash       TEXT NOT NULL,
  source_type        TEXT NOT NULL,
  supplied_by        TEXT,
  received_at        TEXT NOT NULL,
  screening_status   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (screening_status IN ('pending','clean','redacted','rejected')),
  redaction_summary  TEXT,
  immutable_revision TEXT NOT NULL
);
CREATE INDEX source_material_project ON source_material(project_id);

CREATE TABLE discovery_items (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id        TEXT REFERENCES source_material(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN (
                     'problem','user','goal_candidate','feature_candidate',
                     'constraint','assumption','risk','unknown','exclusion','capability')),
  statement        TEXT NOT NULL,
  epistemic_status TEXT NOT NULL DEFAULT 'inferred'
                   CHECK (epistemic_status IN ('confirmed','inferred','assumed','unknown','contradicted','declined')),
  provenance       TEXT,
  status           TEXT NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed','accepted','rejected','converted','superseded')),
  converted_type   TEXT,
  converted_id     TEXT,
  position_x       REAL,
  position_y       REAL,
  accepted_at      TEXT,
  created_at       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX discovery_items_project ON discovery_items(project_id, kind, status);

CREATE TABLE discovery_links (
  from_id      TEXT NOT NULL REFERENCES discovery_items(id) ON DELETE CASCADE,
  to_id        TEXT NOT NULL REFERENCES discovery_items(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, relationship)
);

CREATE TABLE questions (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_type        TEXT NOT NULL,
  scope_id          TEXT,
  question          TEXT NOT NULL,
  why_it_matters    TEXT NOT NULL,
  recommendation    TEXT,
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','answered','deferred','withdrawn')),
  answer            TEXT,
  answered_by       TEXT,
  answered_at       TEXT,
  deferral_reason   TEXT,
  created_at        TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX questions_project ON questions(project_id, status);

-- ------------------------------------------------------- 10.2 product definition

CREATE TABLE goals (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  why_it_matters TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',
  priority       TEXT,
  sequence       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX goals_project ON goals(project_id, status);

CREATE TABLE goal_success_criteria (
  id                 TEXT PRIMARY KEY,
  goal_id            TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  criterion          TEXT NOT NULL,
  measurement_method TEXT,
  target             TEXT,
  status             TEXT NOT NULL DEFAULT 'unmet'
                     CHECK (status IN ('unmet','met','unmeasured','not_applicable')),
  sequence           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX goal_success_criteria_goal ON goal_success_criteria(goal_id);

CREATE TABLE milestones (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  outcome               TEXT,
  entry_conditions_json TEXT NOT NULL DEFAULT '[]',
  exit_conditions_json  TEXT NOT NULL DEFAULT '[]',
  target_date           TEXT,
  status                TEXT NOT NULL DEFAULT 'draft',
  sequence              INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX milestones_project ON milestones(project_id, sequence);

CREATE TABLE modules (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL,
  purpose            TEXT,
  primary_users_json TEXT NOT NULL DEFAULT '[]',
  owns_json          TEXT NOT NULL DEFAULT '[]',
  consumes_json      TEXT NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','in_progress','implemented','deprecated')),
  sequence           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1,
  UNIQUE (project_id, slug)
);

CREATE TABLE features (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
  milestone_id    TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  purpose         TEXT,
  user_statement  TEXT,
  user_value      TEXT,
  spec_depth      TEXT NOT NULL DEFAULT 'standard'
                  CHECK (spec_depth IN ('microspec','standard','full')),
  risk_level      TEXT NOT NULL DEFAULT 'R1'
                  CHECK (risk_level IN ('R0','R1','R2','R3','R4')),
  scope_in_json   TEXT NOT NULL DEFAULT '[]',
  scope_out_json  TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft',
  priority        TEXT,
  what_works_now  TEXT,
  what_remains    TEXT,
  next_action     TEXT,
  accepted_at     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (project_id, slug)
);
CREATE INDEX features_module ON features(module_id, status);
CREATE INDEX features_milestone ON features(milestone_id);

-- The primary flow, normalized rather than a JSON column, so it is queryable
-- and a workflow step can point at the flow step it realizes.
CREATE TABLE feature_flows (
  id         TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  sequence   INTEGER NOT NULL,
  step       TEXT NOT NULL,
  UNIQUE (feature_id, sequence)
);

CREATE TABLE feature_goals (
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_id, goal_id)
);

CREATE TABLE feature_acceptance_criteria (
  id                  TEXT PRIMARY KEY,
  feature_id          TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  criterion           TEXT NOT NULL,
  verification_method TEXT,
  status              TEXT NOT NULL DEFAULT 'unmet'
                      CHECK (status IN ('unmet','met','waived')),
  evidence_id         TEXT,
  sequence            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX feature_acceptance_criteria_feature ON feature_acceptance_criteria(feature_id);

CREATE TABLE feature_edge_cases (
  id                    TEXT PRIMARY KEY,
  feature_id            TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  category              TEXT NOT NULL,
  applicability         TEXT NOT NULL DEFAULT 'applicable'
                        CHECK (applicability IN ('applicable','not_applicable')),
  behavior              TEXT,
  reason_not_applicable TEXT,
  -- A category marked not applicable without a reason is the exact silent gap
  -- the Docs methodology calls a defect, so the store refuses it.
  CHECK (applicability = 'applicable' OR reason_not_applicable IS NOT NULL),
  UNIQUE (feature_id, category)
);

-- --------------------------------------------------- 10.3 workflows and state

CREATE TABLE workflows (
  id                  TEXT PRIMARY KEY,
  feature_id          TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  purpose             TEXT,
  trigger             TEXT,
  preconditions_json  TEXT NOT NULL DEFAULT '[]',
  completion_criteria TEXT,
  observability       TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  version             INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX workflows_feature ON workflows(feature_id);

CREATE TABLE workflow_actors (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,
  actor_type  TEXT NOT NULL DEFAULT 'person'
              CHECK (actor_type IN ('person','system','job','external')),
  sequence    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (workflow_id, actor)
);

CREATE TABLE workflow_steps (
  id               TEXT PRIMARY KEY,
  workflow_id      TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  sequence         INTEGER NOT NULL,
  owner_type       TEXT NOT NULL DEFAULT 'person'
                   CHECK (owner_type IN ('person','system','job','external')),
  owner_ref        TEXT,
  action           TEXT NOT NULL,
  input_contract   TEXT,
  expected_result  TEXT,
  failure_behavior TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (workflow_id, sequence)
);

CREATE TABLE workflow_branches (
  id             TEXT PRIMARY KEY,
  workflow_id    TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_step_id   TEXT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  condition      TEXT NOT NULL,
  to_step_id     TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  branch_type    TEXT NOT NULL DEFAULT 'alternate'
                 CHECK (branch_type IN ('alternate','failure','retry','compensate','abort')),
  failure_policy TEXT
);
CREATE INDEX workflow_branches_workflow ON workflow_branches(workflow_id);

CREATE TABLE state_machines (
  id            TEXT PRIMARY KEY,
  module_id     TEXT REFERENCES modules(id) ON DELETE CASCADE,
  feature_id    TEXT REFERENCES features(id) ON DELETE CASCADE,
  entity_name   TEXT NOT NULL,
  initial_state TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  CHECK (module_id IS NOT NULL OR feature_id IS NOT NULL)
);

CREATE TABLE states (
  id                     TEXT PRIMARY KEY,
  state_machine_id       TEXT NOT NULL REFERENCES state_machines(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  meaning                TEXT,
  terminal               INTEGER NOT NULL DEFAULT 0,
  permitted_actions_json TEXT NOT NULL DEFAULT '[]',
  sequence               INTEGER NOT NULL DEFAULT 0,
  UNIQUE (state_machine_id, name)
);

CREATE TABLE state_transitions (
  id                TEXT PRIMARY KEY,
  state_machine_id  TEXT NOT NULL REFERENCES state_machines(id) ON DELETE CASCADE,
  from_state_id     TEXT NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  event             TEXT NOT NULL,
  guard             TEXT,
  to_state_id       TEXT NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  actor             TEXT,
  timeout_rule      TEXT,
  enforcement_point TEXT
);
CREATE INDEX state_transitions_machine ON state_transitions(state_machine_id);

-- ------------------------------------------------------------------- 10.4 UI

CREATE TABLE surfaces (
  id                  TEXT PRIMARY KEY,
  feature_id          TEXT REFERENCES features(id) ON DELETE CASCADE,
  module_id           TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  surface_type        TEXT NOT NULL DEFAULT 'page',
  route               TEXT,
  purpose             TEXT,
  primary_role        TEXT,
  components_json     TEXT NOT NULL DEFAULT '[]',
  entities_shown_json TEXT NOT NULL DEFAULT '[]',
  responsive_behavior TEXT,
  accessibility_notes TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  version             INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX surfaces_module ON surfaces(module_id);
CREATE INDEX surfaces_feature ON surfaces(feature_id);

CREATE TABLE surface_states (
  id         TEXT PRIMARY KEY,
  surface_id TEXT NOT NULL REFERENCES surfaces(id) ON DELETE CASCADE,
  state_type TEXT NOT NULL CHECK (state_type IN
             ('loading','empty','success','error','disabled','offline','stale','unavailable')),
  behavior   TEXT,
  copy       TEXT,
  UNIQUE (surface_id, state_type)
);

CREATE TABLE ui_actions (
  id                TEXT PRIMARY KEY,
  surface_id        TEXT NOT NULL REFERENCES surfaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  label             TEXT,
  trigger           TEXT,
  role              TEXT,
  permission        TEXT,
  enforcement_point TEXT,
  precondition      TEXT,
  effect            TEXT,
  input_contract    TEXT,
  validation        TEXT,
  side_effects_json TEXT NOT NULL DEFAULT '[]',
  confirmation      TEXT,
  loading_behavior  TEXT,
  disabled_behavior TEXT,
  success_behavior  TEXT,
  error_behavior    TEXT,
  keyboard          TEXT,
  accessible_name   TEXT,
  focus_behavior    TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ui_actions_surface ON ui_actions(surface_id);

-- --------------------------------------------- 10.5 API, data and integrations

CREATE TABLE api_operations (
  id                     TEXT PRIMARY KEY,
  feature_id             TEXT REFERENCES features(id) ON DELETE CASCADE,
  module_id              TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  style                  TEXT NOT NULL DEFAULT 'rest'
                         CHECK (style IN ('rest','graphql','rpc','events','local-only')),
  method_or_procedure    TEXT,
  path_or_topic          TEXT,
  purpose                TEXT,
  auth_requirement       TEXT,
  permission             TEXT,
  enforcement_point      TEXT,
  request_contract_json  TEXT NOT NULL DEFAULT '{}',
  response_contract_json TEXT NOT NULL DEFAULT '{}',
  error_contract_json    TEXT NOT NULL DEFAULT '[]',
  idempotency            TEXT,
  limits                 TEXT,
  side_effects_json      TEXT NOT NULL DEFAULT '[]',
  versioning             TEXT,
  implementation_path    TEXT,
  status                 TEXT NOT NULL DEFAULT 'draft',
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  version                INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX api_operations_module ON api_operations(module_id);
CREATE INDEX api_operations_feature ON api_operations(feature_id);

CREATE TABLE data_entities (
  id                 TEXT PRIMARY KEY,
  module_id          TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  feature_id         TEXT REFERENCES features(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  purpose            TEXT,
  store              TEXT,
  schema_source      TEXT,
  sensitivity_class  TEXT NOT NULL DEFAULT 'none'
                     CHECK (sensitivity_class IN ('none','personal','financial','secret','regulated')),
  retention_rule     TEXT,
  deletion_semantics TEXT,
  status             TEXT NOT NULL DEFAULT 'draft',
  position_x         REAL,
  position_y         REAL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX data_entities_module ON data_entities(module_id);

CREATE TABLE data_fields (
  id                TEXT PRIMARY KEY,
  entity_id         TEXT NOT NULL REFERENCES data_entities(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  nullable          INTEGER NOT NULL DEFAULT 1,
  default_value     TEXT,
  constraints_json  TEXT NOT NULL DEFAULT '[]',
  sensitivity_class TEXT NOT NULL DEFAULT 'none'
                    CHECK (sensitivity_class IN ('none','personal','financial','secret','regulated')),
  sequence          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (entity_id, name)
);

CREATE TABLE data_relationships (
  id             TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL REFERENCES data_entities(id) ON DELETE CASCADE,
  to_entity_id   TEXT NOT NULL REFERENCES data_entities(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  cardinality    TEXT NOT NULL DEFAULT '1:n'
                 CHECK (cardinality IN ('1:1','1:n','n:1','n:m')),
  on_delete      TEXT CHECK (on_delete IN ('cascade','restrict','set_null','no_action')),
  ownership_note TEXT
);
CREATE INDEX data_relationships_from ON data_relationships(from_entity_id);
CREATE INDEX data_relationships_to ON data_relationships(to_entity_id);

CREATE TABLE schema_migrations (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature_id          TEXT REFERENCES features(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  sequence            INTEGER NOT NULL,
  forward_plan        TEXT,
  rollback_plan       TEXT,
  compatibility_notes TEXT,
  status              TEXT NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned','applied','rolled_back','superseded')),
  applied_at          TEXT,
  version             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE schema_migration_entities (
  migration_id TEXT NOT NULL REFERENCES schema_migrations(id) ON DELETE CASCADE,
  entity_id    TEXT NOT NULL REFERENCES data_entities(id) ON DELETE CASCADE,
  PRIMARY KEY (migration_id, entity_id)
);

CREATE TABLE integrations (
  id                   TEXT PRIMARY KEY,
  feature_id           TEXT REFERENCES features(id) ON DELETE CASCADE,
  module_id            TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  purpose              TEXT,
  provider             TEXT,
  environments_json    TEXT NOT NULL DEFAULT '[]',
  auth_approach        TEXT,
  configuration_status TEXT NOT NULL DEFAULT 'unconfigured'
                       CHECK (configuration_status IN ('unconfigured','partial','configured')),
  contract_refs_json   TEXT NOT NULL DEFAULT '[]',
  failure_behavior     TEXT,
  verification_status  TEXT NOT NULL DEFAULT 'unverified'
                       CHECK (verification_status IN ('unverified','verified','failing')),
  status               TEXT NOT NULL DEFAULT 'draft',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX integrations_module ON integrations(module_id);

CREATE TABLE jobs (
  id                  TEXT PRIMARY KEY,
  feature_id          TEXT REFERENCES features(id) ON DELETE CASCADE,
  module_id           TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  trigger             TEXT,
  input_contract_json TEXT NOT NULL DEFAULT '{}',
  idempotency         TEXT,
  retry_policy        TEXT,
  failure_destination TEXT,
  timeout             TEXT,
  concurrency         TEXT,
  observability       TEXT,
  delivery_guarantee  TEXT CHECK (delivery_guarantee IN
                      ('at_least_once','at_most_once','exactly_once','undeclared')),
  status              TEXT NOT NULL DEFAULT 'draft',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  version             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE webhooks (
  id                      TEXT PRIMARY KEY,
  feature_id              TEXT REFERENCES features(id) ON DELETE CASCADE,
  module_id               TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  direction               TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  endpoint_or_registration TEXT,
  identity_verification   TEXT,
  replay_protection       TEXT,
  ordering_behavior       TEXT,
  retry_behavior          TEXT,
  signing                 TEXT,
  payload_version         TEXT,
  failure_visibility      TEXT,
  status                  TEXT NOT NULL DEFAULT 'draft',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  version                 INTEGER NOT NULL DEFAULT 1
);

-- ------------------------------------------------- 10.6 quality and governance

CREATE TABLE roles (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sequence    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, name)
);

CREATE TABLE permissions (
  id                TEXT PRIMARY KEY,
  role_id           TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type        TEXT NOT NULL,
  scope_id          TEXT,
  capability        TEXT NOT NULL,
  access_level      TEXT NOT NULL DEFAULT 'none'
                    CHECK (access_level IN ('none','read','own','write','full','redacted')),
  enforcement_point TEXT
);
CREATE INDEX permissions_role ON permissions(role_id);

CREATE TABLE non_functional_requirements (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id          TEXT REFERENCES modules(id) ON DELETE CASCADE,
  feature_id         TEXT REFERENCES features(id) ON DELETE CASCADE,
  category           TEXT NOT NULL,
  requirement        TEXT NOT NULL,
  target             TEXT,
  target_source      TEXT,
  measurement_method TEXT,
  status             TEXT NOT NULL DEFAULT 'unmeasured'
                     CHECK (status IN ('met','unmet','unmeasured','not_applicable')),
  created_at         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX nfr_project ON non_functional_requirements(project_id);

CREATE TABLE decisions (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'proposed'
                       CHECK (status IN ('proposed','accepted','rejected','deprecated',
                                         'partially_superseded','superseded','time_boxed','revisit_required')),
  scope_type           TEXT,
  scope_id             TEXT,
  context              TEXT,
  evidence_json        TEXT NOT NULL DEFAULT '[]',
  criteria_json        TEXT NOT NULL DEFAULT '[]',
  options_json         TEXT NOT NULL DEFAULT '[]',
  decision             TEXT,
  observable_rationale TEXT,
  consequences_json    TEXT NOT NULL DEFAULT '{}',
  risks_json           TEXT NOT NULL DEFAULT '[]',
  enforcement_json     TEXT NOT NULL DEFAULT '[]',
  verification         TEXT,
  revisit_triggers_json TEXT NOT NULL DEFAULT '[]',
  supersedes_id        TEXT REFERENCES decisions(id) ON DELETE SET NULL,
  superseded_by_id     TEXT REFERENCES decisions(id) ON DELETE SET NULL,
  body_hash            TEXT,
  accepted_by          TEXT,
  accepted_at          TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX decisions_project ON decisions(project_id, status);

CREATE TABLE decision_transitions (
  id             TEXT PRIMARY KEY,
  decision_id    TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  scope_delta    TEXT,
  actor_id       TEXT,
  reason         TEXT,
  created_at     TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  immutable_hash TEXT NOT NULL,
  UNIQUE (decision_id, sequence)
);

CREATE TABLE documents (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,
  scope_type       TEXT NOT NULL,
  scope_id         TEXT,
  path             TEXT NOT NULL,
  template         TEXT,
  database_revision INTEGER NOT NULL DEFAULT 0,
  generated_body   TEXT,
  generated_hash   TEXT,
  manual_hash      TEXT,
  sync_status      TEXT NOT NULL DEFAULT 'generated'
                   CHECK (sync_status IN ('generated','manual_edit_pending','accepted','rejected','missing')),
  generated_at     TEXT,
  UNIQUE (project_id, path)
);
CREATE INDEX documents_sync ON documents(project_id, sync_status);

-- Capability readiness, brief section 8.2. Without a home for this,
-- "silent gaps are invalid" cannot be enforced or displayed.
CREATE TABLE capability_areas (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  area             TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'awaiting_decision'
                   CHECK (state IN ('specified','awaiting_decision','not_applicable','deferred')),
  reason           TEXT,
  owner            TEXT,
  revisit_trigger  TEXT,
  consequence      TEXT,
  question_id      TEXT REFERENCES questions(id) ON DELETE SET NULL,
  sequence         INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  CHECK (state = 'specified' OR reason IS NOT NULL),
  UNIQUE (project_id, area)
);

-- The twenty-step module loop, brief section 9.3.
CREATE TABLE module_completeness (
  id                    TEXT PRIMARY KEY,
  module_id             TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  step                  INTEGER NOT NULL CHECK (step BETWEEN 1 AND 20),
  step_name             TEXT NOT NULL,
  state                 TEXT NOT NULL DEFAULT 'open'
                        CHECK (state IN ('open','filled','not_applicable')),
  summary               TEXT,
  reason_not_applicable TEXT,
  updated_at            TEXT NOT NULL,
  CHECK (state <> 'not_applicable' OR reason_not_applicable IS NOT NULL),
  UNIQUE (module_id, step)
);

-- ------------------------------------------------------ 10.7 tasks and execution

CREATE TABLE task_categories (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color_token TEXT,
  system      INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  sequence    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, name)
);

CREATE TABLE tasks (
  id                            TEXT PRIMARY KEY,
  project_id                    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- A task with no feature is invalid. Enforced by the column, not by a caller.
  feature_id                    TEXT NOT NULL REFERENCES features(id) ON DELETE RESTRICT,
  parent_task_id                TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  category_id                   TEXT REFERENCES task_categories(id) ON DELETE SET NULL,
  name                          TEXT NOT NULL,
  description                   TEXT,
  expected_outcome              TEXT,
  why_needed                    TEXT,
  completion_criteria_json      TEXT NOT NULL DEFAULT '[]',
  verification_requirements_json TEXT NOT NULL DEFAULT '[]',
  affected_boundaries_json      TEXT NOT NULL DEFAULT '[]',
  priority                      TEXT NOT NULL DEFAULT 'normal',
  risk                          TEXT,
  status                        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                                ('draft','ready','in_progress','in_review','verifying',
                                 'blocked','paused','complete','cancelled','superseded')),
  enabling                      INTEGER NOT NULL DEFAULT 0,
  enabled_feature_id            TEXT REFERENCES features(id) ON DELETE SET NULL,
  enabling_rationale            TEXT,
  estimate                      TEXT,
  due_at                        TEXT,
  started_at                    TEXT,
  completed_at                  TEXT,
  cancelled_at                  TEXT,
  block_reason                  TEXT,
  sequence                      INTEGER NOT NULL DEFAULT 0,
  created_at                    TEXT NOT NULL,
  updated_at                    TEXT NOT NULL,
  version                       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX tasks_feature ON tasks(feature_id, status);
CREATE INDEX tasks_parent ON tasks(parent_task_id);
CREATE INDEX tasks_project_status ON tasks(project_id, status);

CREATE TABLE task_contract_links (
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN
               ('workflow_step','ui_action','api_operation','data_entity','schema_migration',
                'integration','job','webhook','nfr','document','decision','acceptance_criterion',
                'surface','state_transition','permission')),
  target_id    TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'implements',
  PRIMARY KEY (task_id, target_type, target_id)
);

CREATE TABLE task_dependencies (
  task_id            TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type    TEXT NOT NULL DEFAULT 'blocks'
                     CHECK (dependency_type IN ('blocks','informs','shares_surface')),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

-- ------------------------------------ 10.8 developers, agents, branches, sessions

CREATE TABLE developers (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL,
  external_identity TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  created_at        TEXT NOT NULL,
  UNIQUE (project_id, display_name)
);

CREATE TABLE agents (
  id                  TEXT PRIMARY KEY,
  developer_id        TEXT NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  harness             TEXT NOT NULL,
  model_label         TEXT,
  session_external_id TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','idle','ended')),
  last_seen_at        TEXT
);
CREATE INDEX agents_developer ON agents(developer_id);

CREATE TABLE branches (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  worktree_fingerprint TEXT,
  head_revision        TEXT,
  dirty                INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','merged','abandoned')),
  last_seen_at         TEXT,
  UNIQUE (project_id, name, worktree_fingerprint)
);

CREATE TABLE work_sessions (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  developer_id     TEXT REFERENCES developers(id) ON DELETE SET NULL,
  agent_id         TEXT REFERENCES agents(id) ON DELETE SET NULL,
  branch_id        TEXT REFERENCES branches(id) ON DELETE SET NULL,
  active_task_id   TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  objective        TEXT,
  started_at       TEXT NOT NULL,
  last_activity_at TEXT,
  ended_at         TEXT,
  outcome          TEXT,
  handoff          TEXT,
  next_action      TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','compacted','handed_off','ended'))
);
CREATE INDEX work_sessions_project ON work_sessions(project_id, status);

CREATE TABLE task_assignments (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  developer_id TEXT REFERENCES developers(id) ON DELETE SET NULL,
  agent_id     TEXT REFERENCES agents(id) ON DELETE SET NULL,
  branch_id    TEXT REFERENCES branches(id) ON DELETE SET NULL,
  session_id   TEXT REFERENCES work_sessions(id) ON DELETE SET NULL,
  assigned_at  TEXT NOT NULL,
  released_at  TEXT,
  active       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX task_assignments_task ON task_assignments(task_id, active);
-- At most one active assignment per task. A partial unique index is the only
-- thing that makes a double claim impossible rather than merely unlikely.
CREATE UNIQUE INDEX task_assignments_one_active
  ON task_assignments(task_id) WHERE active = 1;

CREATE TABLE activity_events (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id     TEXT REFERENCES work_sessions(id) ON DELETE SET NULL,
  actor_id       TEXT,
  actor_label    TEXT,
  task_id        TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  feature_id     TEXT REFERENCES features(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,
  summary        TEXT NOT NULL,
  metadata_json  TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  immutable_hash TEXT NOT NULL,
  UNIQUE (project_id, sequence)
);
CREATE INDEX activity_events_task ON activity_events(task_id);
CREATE INDEX activity_events_created ON activity_events(project_id, created_at);

CREATE TABLE verification_evidence (
  id                     TEXT PRIMARY KEY,
  project_id             TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id                TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  feature_id             TEXT REFERENCES features(id) ON DELETE CASCADE,
  acceptance_criterion_id TEXT REFERENCES feature_acceptance_criteria(id) ON DELETE SET NULL,
  evidence_type          TEXT NOT NULL,
  summary                TEXT NOT NULL,
  reference              TEXT,
  result                 TEXT NOT NULL DEFAULT 'pass'
                         CHECK (result IN ('pass','fail','inconclusive')),
  content_hash           TEXT,
  recorded_by            TEXT,
  recorded_at            TEXT NOT NULL,
  stale_at               TEXT,
  status                 TEXT NOT NULL DEFAULT 'current'
                         CHECK (status IN ('current','stale','superseded'))
);
CREATE INDEX verification_evidence_task ON verification_evidence(task_id);
CREATE INDEX verification_evidence_feature ON verification_evidence(feature_id);

-- One append-only history for every record that has a lifecycle. This is an
-- audit table keyed by record type, not a generic entity store.
CREATE TABLE status_history (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_label TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL,
  sequence    INTEGER NOT NULL
);
CREATE INDEX status_history_record ON status_history(record_type, record_id, sequence);

-- ------------------------------------------------- 10.9 local memory and sync

CREATE TABLE memory_entries (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id       TEXT REFERENCES work_sessions(id) ON DELETE SET NULL,
  task_id          TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  feature_id       TEXT REFERENCES features(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN
                   ('outcome','decision','learned_fact','unresolved_question',
                    'blocker','handoff','summary')),
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  source_ref       TEXT,
  epistemic_status TEXT NOT NULL DEFAULT 'inferred'
                   CHECK (epistemic_status IN ('confirmed','inferred','assumed','unknown','contradicted')),
  embedding        BLOB,
  created_at       TEXT NOT NULL,
  superseded_by    TEXT REFERENCES memory_entries(id) ON DELETE SET NULL,
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX memory_entries_project ON memory_entries(project_id, kind, created_at);

CREATE TABLE memory_links (
  memory_id    TEXT NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'about',
  PRIMARY KEY (memory_id, target_type, target_id)
);

CREATE TABLE sync_peers (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  peer_type         TEXT NOT NULL,
  remote_project_id TEXT,
  local_priority    INTEGER NOT NULL DEFAULT 1,
  last_pull_cursor  TEXT,
  last_push_cursor  TEXT,
  last_synced_at    TEXT,
  status            TEXT NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('disconnected','connected','error'))
);

CREATE TABLE sync_conflicts (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_type       TEXT NOT NULL,
  record_id         TEXT NOT NULL,
  local_version     INTEGER,
  remote_version    INTEGER,
  base_version      INTEGER,
  local_value_json  TEXT,
  remote_value_json TEXT,
  resolution        TEXT CHECK (resolution IN ('local','remote','merged')),
  resolved_by       TEXT,
  resolved_at       TEXT,
  detected_at       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved'))
);
CREATE INDEX sync_conflicts_open ON sync_conflicts(project_id, status);

-- Saved canvas positions for the blueprint. Layout is a view concern, but it
-- has to survive a reload, so it lives with the data it decorates.
CREATE TABLE layout_positions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  canvas      TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (project_id, canvas, record_type, record_id)
);

-- ------------------------------------------------------------------- triggers

-- The task mapping constraint. A draft may be incomplete; nothing may leave
-- draft without either a contract link or a named feature it unblocks.
CREATE TRIGGER tasks_require_contract_on_ready
BEFORE UPDATE OF status ON tasks
WHEN NEW.status <> 'draft'
 AND NEW.status <> 'cancelled'
 AND NEW.enabling = 0
 AND (SELECT count(*) FROM task_contract_links WHERE task_id = NEW.id) = 0
BEGIN
  SELECT RAISE(ABORT, 'E_TASK_WITHOUT_CONTRACT');
END;

CREATE TRIGGER tasks_enabling_needs_target
BEFORE UPDATE OF status ON tasks
WHEN NEW.status <> 'draft'
 AND NEW.status <> 'cancelled'
 AND NEW.enabling = 1
 AND (NEW.enabled_feature_id IS NULL OR NEW.enabling_rationale IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'E_ENABLING_WITHOUT_TARGET');
END;

CREATE TRIGGER tasks_enabling_needs_target_insert
BEFORE INSERT ON tasks
WHEN NEW.status <> 'draft'
 AND NEW.enabling = 1
 AND (NEW.enabled_feature_id IS NULL OR NEW.enabling_rationale IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'E_ENABLING_WITHOUT_TARGET');
END;

-- A parent cannot complete over open children.
CREATE TRIGGER tasks_no_complete_over_open_children
BEFORE UPDATE OF status ON tasks
WHEN NEW.status = 'complete'
 AND (SELECT count(*) FROM tasks c
      WHERE c.parent_task_id = NEW.id
        AND c.status NOT IN ('complete','cancelled','superseded')) > 0
BEGIN
  SELECT RAISE(ABORT, 'E_OPEN_SUBTASKS');
END;

-- Append-only history. These tables are written once and never revised.
CREATE TRIGGER activity_events_no_update BEFORE UPDATE ON activity_events
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;
CREATE TRIGGER activity_events_no_delete BEFORE DELETE ON activity_events
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;

CREATE TRIGGER decision_transitions_no_update BEFORE UPDATE ON decision_transitions
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;
CREATE TRIGGER decision_transitions_no_delete BEFORE DELETE ON decision_transitions
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;

CREATE TRIGGER status_history_no_update BEFORE UPDATE ON status_history
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;
CREATE TRIGGER status_history_no_delete BEFORE DELETE ON status_history
BEGIN SELECT RAISE(ABORT, 'E_APPEND_ONLY'); END;
