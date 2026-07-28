/**
 * Types for every payload in docs/rebuild/MODULE_CONTRACT.md.
 *
 * Field names mirror the schema in SUPERDEV_VNEXT_REBUILD_SPEC.md section 10,
 * which is snake_case. Anything the service may legitimately omit is optional
 * or nullable, because a partly specified record is a normal product state
 * here, not an error.
 */

/* ---------------------------------------------------------------------------
   Envelope
   --------------------------------------------------------------------------- */

/** Freshness envelope carried by every read response. */
export interface Meta {
  /** max(sequence) from activity_events at the time the response was built. */
  revision: number;
  lastEventSequence: number;
  /** ISO 8601. */
  generatedAt: string;
  /** True when the service knows this payload lags the database. */
  stale: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

/** A read result plus the envelope, as handed to callers. */
export interface Result<T> {
  data: T;
  meta: Meta;
}

export interface ApiErrorBody {
  /** Stable code, for example E_NOT_FOUND or E_VERSION_CONFLICT. */
  code: string;
  /** What happened and what the person can do next. */
  message: string;
  details?: unknown;
}

/* ---------------------------------------------------------------------------
   Shared vocabulary
   --------------------------------------------------------------------------- */

/** Section 7.4 lifecycle. Kept open because vocabulary.mjs owns the list. */
export type RecordStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "in_review"
  | "verifying"
  | "blocked"
  | "paused"
  | "complete"
  | "cancelled"
  | "superseded"
  | (string & {});

export type EpistemicStatus =
  | "stated"
  | "inferred"
  | "assumed"
  | "verified"
  | "contradicted"
  | (string & {});

export type ScopeType =
  | "project"
  | "goal"
  | "milestone"
  | "module"
  | "feature"
  | "workflow"
  | "task"
  | (string & {});

/**
 * A measured quantity that always states what it counts.
 * `total` of 0 means there is no completion contract: render "Not measurable".
 */
export interface Progress {
  completed: number;
  total: number;
  /** The NOUN the totals are counted in, e.g. "acceptance criterion". Pluralized by the formatter, so it must not be a sentence. */
  counts: string;
  /** Per component breakdown, one line each. Rendered as a list, never inlined into a headline. */
  countsBreakdown?: string[];
  /** What is still outstanding, one line each. */
  remainsBreakdown?: string[];
  /** Plain language for what is still outstanding. */
  remains?: string | null;
  /** Database revision this was derived from. */
  sourceRevision?: number;
  /** ISO 8601. */
  computedAt?: string;
  /** Set when no completion contract exists, so no percentage is honest. */
  measurable: boolean;
  /**
   * The percentage the progress service computed, already carrying its honest
   * rule: never 100 while anything is outstanding, never 0 once something is
   * done. Null when nothing is measurable. Recomputing it here would discard
   * that rule, so nothing should.
   */
  percent?: number | null;
  /**
   * Set when this was derived from records that have since gone stale. The
   * service has always sent it and the type left it out, so no meter could show
   * it and no reader could learn the number was out of date.
   */
  stale?: boolean;
}

/* ---------------------------------------------------------------------------
   GET /health
   --------------------------------------------------------------------------- */

export interface Health {
  ok: boolean;
  projectRoot: string;
  instanceToken: string;
  version: string;
}

/* ---------------------------------------------------------------------------
   GET /api/overview
   --------------------------------------------------------------------------- */

export interface Project {
  id: string;
  name: string;
  slug: string;
  statement: string | null;
  problem: string | null;
  status: RecordStatus;
  working_mode: string | null;
  docs_profile: string | null;
  local_authority: number | boolean | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface HeadlineCount {
  /** Plain language for what is being counted, e.g. "Features in progress". */
  label: string;
  value: number;
  /** What one unit is, e.g. "features". Never render the value without it. */
  unit: string;
  /** Optional hash route this count drills into. */
  href?: string | null;
}

export interface ActiveWorkItem {
  taskId: string;
  taskName: string;
  featureId: string | null;
  featureName: string | null;
  status: RecordStatus;
  actor: string | null;
  branch: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
}

export interface NextAction {
  /** Plain language instruction. */
  summary: string;
  reason: string;
  targetType: ScopeType | null;
  targetId: string | null;
  href?: string | null;
}

export interface Freshness {
  databaseRevision: number;
  lastEventSequence: number;
  lastDocumentationGeneratedAt: string | null;
  activeSessionHeartbeatAt: string | null;
  branchHead: string | null;
  staleEvidenceCount: number;
  pendingDocProposalCount: number;
}

export interface OverviewPayload {
  project: Project;
  /** Plain-language answers for the seven overview questions. */
  headline: HeadlineCount[];
  whatWorks: string[];
  whatIsBlocked: string[];
  activeWork: ActiveWorkItem[];
  nextAction: NextAction | null;
  progress: Progress;
  freshness: Freshness;
}

/* ---------------------------------------------------------------------------
   GET /api/discovery
   --------------------------------------------------------------------------- */

export interface SourceMaterial {
  id: string;
  project_id: string;
  path_or_label: string;
  content_hash: string | null;
  source_type: string;
  supplied_by: string | null;
  received_at: string;
  screening_status: string;
  redaction_summary: string | null;
  immutable_revision: number | null;
}

export type DiscoveryKind =
  | "problem"
  | "user"
  | "goal_candidate"
  | "feature_candidate"
  | "constraint"
  | "assumption"
  | "risk"
  | "unknown"
  | "exclusion"
  | (string & {});

export interface DiscoveryItem {
  id: string;
  project_id: string;
  source_id: string | null;
  kind: DiscoveryKind;
  statement: string;
  epistemic_status: EpistemicStatus;
  provenance: string | null;
  status: RecordStatus;
  accepted_at: string | null;
  version: number;
}

export interface DiscoveryLink {
  from_id: string;
  to_id: string;
  relationship: string;
}

export interface Question {
  id: string;
  project_id: string;
  scope_type: ScopeType;
  scope_id: string | null;
  question: string;
  why_it_matters: string | null;
  recommendation: string | null;
  alternatives_json: string[] | null;
  /** Whether the options are exclusive. "many" for a question several answers fit. */
  select_mode: "one" | "many";
  /** Which of the options carry the recommended tag. Empty when none does. */
  recommended_json: string[] | null;
  /** Why those are recommended, so somebody can disagree with it on purpose. */
  recommendation_why: string | null;
  status: RecordStatus;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  deferral_reason: string | null;
  version: number;
}

/** Saved canvas position, written back through the layout.save mutation. */
export interface LayoutPosition {
  id: string;
  x: number;
  y: number;
}

export interface DiscoveryPayload {
  sources: SourceMaterial[];
  items: DiscoveryItem[];
  links: DiscoveryLink[];
  questions: Question[];
  assumptions: DiscoveryItem[];
  risks: DiscoveryItem[];
  layout: LayoutPosition[];
}

/* ---------------------------------------------------------------------------
   GET /api/product
   --------------------------------------------------------------------------- */

export interface GoalSuccessCriterion {
  id: string;
  goal_id: string;
  criterion: string;
  measurement_method: string | null;
  target: string | null;
  status: RecordStatus;
}

export interface Goal {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  why_it_matters: string | null;
  status: RecordStatus;
  priority: string | null;
  version: number;
  successCriteria: GoalSuccessCriterion[];
  progress: Progress;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  outcome: string | null;
  entry_conditions_json: string[] | null;
  /**
   * Either plain strings, or objects carrying whether the condition is met and
   * the reading that decided it. Read through exitConditions() rather than
   * rendered directly.
   */
  exit_conditions_json:
    | (string | { condition: string; met?: boolean; reading?: string })[]
    | null;
  target_date: string | null;
  status: RecordStatus;
  sequence: number;
  version: number;
  progress: Progress;
}

export interface Module {
  id: string;
  project_id: string;
  name: string;
  purpose: string | null;
  /** Where this module stops. The interview asks for it; the record keeps it. */
  out_of_scope: string | null;
  primary_users_json: string[] | null;
  owns_json: string[] | null;
  consumes_json: string[] | null;
  status: RecordStatus;
  sequence: number;
  version: number;
  progress: Progress;
}

export interface FeatureSummary {
  id: string;
  project_id: string;
  module_id: string | null;
  milestone_id: string | null;
  name: string;
  purpose: string | null;
  user_statement: string | null;
  user_value: string | null;
  spec_depth: string | null;
  risk_level: string | null;
  scope_in_json: string[] | null;
  scope_out_json: string[] | null;
  primary_flow_json: string[] | null;
  status: RecordStatus;
  priority: string | null;
  what_works_now: string | null;
  what_remains: string | null;
  next_action: string | null;
  version: number;
  goalIds?: string[];
  progress: Progress;
}

export interface ProductPayload {
  goals: Goal[];
  milestones: Milestone[];
  modules: Module[];
  features: FeatureSummary[];
  progress: Progress;
}

/* ---------------------------------------------------------------------------
   GET /api/features/:id
   --------------------------------------------------------------------------- */

export interface AcceptanceCriterion {
  id: string;
  feature_id: string;
  criterion: string;
  verification_method: string | null;
  status: RecordStatus;
  evidence_id: string | null;
  sequence: number;
}

export interface EdgeCase {
  id: string;
  feature_id: string;
  category: string;
  applicability: string;
  behavior: string | null;
  reason_not_applicable: string | null;
}

export interface Surface {
  id: string;
  feature_id: string | null;
  module_id: string | null;
  name: string;
  surface_type: string;
  route: string | null;
  purpose: string | null;
  primary_role: string | null;
  components_json: string[] | null;
  entities_shown_json: string[] | null;
  responsive_behavior: string | null;
  accessibility_notes: string | null;
  status: RecordStatus;
  version: number;
}

export interface SurfaceState {
  id: string;
  surface_id: string;
  state_type: string;
  behavior: string | null;
  copy: string | null;
}

export interface UiAction {
  id: string;
  surface_id: string;
  name: string;
  label: string;
  trigger: string | null;
  role: string | null;
  permission: string | null;
  enforcement_point: string | null;
  precondition: string | null;
  effect: string | null;
  input_contract: string | null;
  validation: string | null;
  side_effects_json: string[] | null;
  confirmation: string | null;
  loading_behavior: string | null;
  disabled_behavior: string | null;
  success_behavior: string | null;
  error_behavior: string | null;
  keyboard: string | null;
  accessible_name: string | null;
  focus_behavior: string | null;
  status: RecordStatus;
  version: number;
}

export interface ApiOperation {
  id: string;
  feature_id: string | null;
  module_id: string | null;
  name: string;
  style: string;
  method_or_procedure: string | null;
  path_or_topic: string | null;
  purpose: string | null;
  auth_requirement: string | null;
  permission: string | null;
  enforcement_point: string | null;
  request_contract_json: unknown;
  response_contract_json: unknown;
  error_contract_json: unknown;
  idempotency: string | null;
  limits: string | null;
  side_effects_json: string[] | null;
  versioning: string | null;
  implementation_path: string | null;
  status: RecordStatus;
  version: number;
}

export interface Integration {
  id: string;
  feature_id: string | null;
  module_id: string | null;
  name: string;
  purpose: string | null;
  provider: string | null;
  environments_json: string[] | null;
  auth_approach: string | null;
  configuration_status: string | null;
  contract_refs_json: string[] | null;
  failure_behavior: string | null;
  verification_status: string | null;
  status: RecordStatus;
  version: number;
}

export interface Job {
  id: string;
  feature_id: string | null;
  module_id: string | null;
  name: string;
  trigger: string | null;
  input_contract_json: unknown;
  idempotency: string | null;
  retry_policy: string | null;
  failure_destination: string | null;
  timeout: string | null;
  concurrency: string | null;
  observability: string | null;
  delivery_guarantee: string | null;
  status: RecordStatus;
  version: number;
}

export interface Webhook {
  id: string;
  feature_id: string | null;
  direction: string;
  endpoint_or_registration: string | null;
  identity_verification: string | null;
  replay_protection: string | null;
  ordering_behavior: string | null;
  retry_behavior: string | null;
  signing: string | null;
  payload_version: string | null;
  failure_visibility: string | null;
  status: RecordStatus;
  version: number;
}

export interface NonFunctionalRequirement {
  id: string;
  project_id: string;
  module_id: string | null;
  feature_id: string | null;
  category: string;
  requirement: string;
  target: string | null;
  target_source: string | null;
  measurement_method: string | null;
  status: RecordStatus;
}

export interface VerificationEvidence {
  id: string;
  project_id: string;
  task_id: string | null;
  feature_id: string | null;
  acceptance_criterion_id: string | null;
  evidence_type: string;
  summary: string;
  reference: string | null;
  content_hash: string | null;
  recorded_by: string | null;
  recorded_at: string;
  stale_at: string | null;
  status: RecordStatus;
}

export interface FeatureDetailPayload {
  feature: FeatureSummary;
  module: Module | null;
  milestone: Milestone | null;
  goals: Goal[];
  acceptanceCriteria: AcceptanceCriterion[];
  edgeCases: EdgeCase[];
  workflows: Workflow[];
  surfaces: Surface[];
  surfaceStates: SurfaceState[];
  uiActions: UiAction[];
  apiOperations: ApiOperation[];
  dataEntities: DataEntity[];
  migrations: SchemaMigration[];
  integrations: Integration[];
  jobs: Job[];
  webhooks: Webhook[];
  nfrs: NonFunctionalRequirement[];
  decisions: Decision[];
  tasks: Task[];
  evidence: VerificationEvidence[];
  progress: Progress;
}

/* ---------------------------------------------------------------------------
   GET /api/workflows
   --------------------------------------------------------------------------- */

export interface Workflow {
  id: string;
  feature_id: string;
  name: string;
  purpose: string | null;
  trigger: string | null;
  actors_json: string[] | null;
  preconditions_json: string[] | null;
  completion_criteria: string | null;
  observability: string | null;
  status: RecordStatus;
  version: number;
  progress?: Progress;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  sequence: number;
  owner_type: string;
  owner_ref: string | null;
  action: string;
  input_contract: string | null;
  expected_result: string | null;
  failure_behavior: string | null;
  status: RecordStatus;
  version: number;
  /** Ids of tasks implementing this step, for the execution overlay. */
  taskIds?: string[];
}

export interface WorkflowBranch {
  id: string;
  workflow_id: string;
  from_step_id: string;
  condition: string;
  to_step_id: string | null;
  branch_type: string;
  failure_policy: string | null;
}

export interface StateMachine {
  id: string;
  module_id: string | null;
  feature_id: string | null;
  entity_name: string;
  initial_state: string | null;
  status: RecordStatus;
}

export interface WorkflowState {
  id: string;
  state_machine_id: string;
  name: string;
  meaning: string | null;
  terminal: number | boolean;
  permitted_actions_json: string[] | null;
}

export interface StateTransition {
  id: string;
  state_machine_id: string;
  from_state_id: string;
  event: string;
  guard: string | null;
  to_state_id: string;
  actor: string | null;
  timeout_rule: string | null;
  enforcement_point: string | null;
}

export interface WorkflowsPayload {
  workflows: Workflow[];
  steps: WorkflowStep[];
  branches: WorkflowBranch[];
  /** Distinct actor names across every workflow, for filtering and swimlanes. */
  actors: string[];
  stateMachines: StateMachine[];
  states: WorkflowState[];
  transitions: StateTransition[];
  layout?: LayoutPosition[];
}

/* ---------------------------------------------------------------------------
   GET /api/data
   --------------------------------------------------------------------------- */

export interface DataEntity {
  id: string;
  module_id: string | null;
  feature_id: string | null;
  name: string;
  purpose: string | null;
  store: string | null;
  schema_source: string | null;
  sensitivity_class: string | null;
  retention_rule: string | null;
  deletion_semantics: string | null;
  status: RecordStatus;
  version: number;
}

export interface DataField {
  id: string;
  entity_id: string;
  name: string;
  type: string;
  nullable: number | boolean;
  default_value: string | null;
  constraints_json: string[] | null;
  sensitivity_class: string | null;
  sequence: number;
}

export interface DataRelationship {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  name: string;
  cardinality: string;
  on_delete: string | null;
  ownership_note: string | null;
}

export interface SchemaMigration {
  id: string;
  project_id: string;
  feature_id: string | null;
  name: string;
  sequence: number;
  forward_plan: string | null;
  rollback_plan: string | null;
  compatibility_notes: string | null;
  status: RecordStatus;
  applied_at: string | null;
  version: number;
}

export interface DataPayload {
  entities: DataEntity[];
  fields: DataField[];
  relationships: DataRelationship[];
  migrations: SchemaMigration[];
  layout?: LayoutPosition[];
}

/* ---------------------------------------------------------------------------
   GET /api/architecture
   --------------------------------------------------------------------------- */

export interface RuntimePiece {
  id: string;
  name: string;
  /** For example service, store, client, worker, external. */
  kind: string;
  purpose: string | null;
  moduleId: string | null;
  status: RecordStatus;
  ownsEntityIds?: string[];
}

export interface RuntimeEdge {
  id: string;
  from_id: string;
  to_id: string;
  /** Named relationship, never an unlabelled line. */
  relationship: string;
  protocol: string | null;
}

export interface ModuleDependency {
  from_module_id: string;
  to_module_id: string;
  reason: string | null;
  /** True when the pair sits on the critical path. */
  critical: boolean;
}

export interface ArchitecturePayload {
  pieces: RuntimePiece[];
  edges: RuntimeEdge[];
  moduleDependencies: ModuleDependency[];
  /** Ordered module ids forming the critical path. */
  criticalPath: string[];
  integrations: Integration[];
  layout?: LayoutPosition[];
}

/* ---------------------------------------------------------------------------
   GET /api/tasks
   --------------------------------------------------------------------------- */

export interface TaskCategory {
  id: string;
  project_id: string;
  name: string;
  color_token: string | null;
  system: number | boolean;
  active: number | boolean;
  /** What this category means in this project, shown beside the picker. */
  description?: string | null;
}

export interface TaskContractLink {
  task_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
}

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  developer_id: string | null;
  agent_id: string | null;
  branch_id: string | null;
  assigned_at: string;
  released_at: string | null;
  active: number | boolean;
}

export interface Task {
  id: string;
  project_id: string;
  feature_id: string | null;
  parent_task_id: string | null;
  category_id: string | null;
  name: string;
  description: string | null;
  expected_outcome: string | null;
  why_needed: string | null;
  completion_criteria_json: string[] | null;
  verification_requirements_json: string[] | null;
  priority: string | null;
  risk: string | null;
  status: RecordStatus;
  enabling: number | boolean;
  enabled_feature_id: string | null;
  estimate: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  version: number;
  /** Convenience fields the service joins in so lists need no second call. */
  featureName?: string | null;
  categoryName?: string | null;
  assignment?: TaskAssignment | null;
  subtaskIds?: string[];
  progress?: Progress;
}

export interface TasksPayload {
  tasks: Task[];
  categories: TaskCategory[];
  contractLinks: TaskContractLink[];
  dependencies: TaskDependency[];
  assignments: TaskAssignment[];
  evidence: VerificationEvidence[];
  developers: Developer[];
  agents: Agent[];
  branches: Branch[];
}

/* ---------------------------------------------------------------------------
   GET /api/team
   --------------------------------------------------------------------------- */

export interface Developer {
  id: string;
  project_id: string;
  display_name: string;
  external_identity: string | null;
  status: RecordStatus;
}

export interface Agent {
  id: string;
  developer_id: string | null;
  harness: string;
  model_label: string | null;
  session_external_id: string | null;
  status: RecordStatus;
  last_seen_at: string | null;
}

export interface Branch {
  id: string;
  project_id: string;
  name: string;
  worktree_fingerprint: string | null;
  head_revision: string | null;
  status: RecordStatus;
  last_seen_at: string | null;
}

export interface WorkSession {
  id: string;
  project_id: string;
  developer_id: string | null;
  agent_id: string | null;
  branch_id: string | null;
  active_task_id: string | null;
  objective: string | null;
  started_at: string;
  last_activity_at: string | null;
  ended_at: string | null;
  outcome: string | null;
  handoff: string | null;
  status: RecordStatus;
}

export interface PresenceEntry {
  actorId: string;
  actorName: string;
  actorKind: "developer" | "agent";
  /** Live, Idle or Offline as a plain-language label, decided by the service. */
  presence: string;
  lastActivityAt: string | null;
  activeTaskId: string | null;
  branchName: string | null;
}

export interface SyncConflict {
  id: string;
  project_id: string;
  record_type: string;
  record_id: string;
  local_version: number;
  remote_version: number;
  base_version: number | null;
  local_value_json: unknown;
  remote_value_json: unknown;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  status: RecordStatus;
}

export interface TeamPayload {
  developers: Developer[];
  agents: Agent[];
  branches: Branch[];
  sessions: WorkSession[];
  presence: PresenceEntry[];
  conflicts: SyncConflict[];
}

/* ---------------------------------------------------------------------------
   GET /api/decisions
   --------------------------------------------------------------------------- */

export interface DecisionOption {
  name: string;
  summary?: string | null;
  chosen?: boolean;
}

export interface Decision {
  id: string;
  project_id: string;
  title: string;
  status: RecordStatus;
  scope_type: ScopeType;
  scope_id: string | null;
  context: string | null;
  evidence_json: string[] | null;
  criteria_json: string[] | null;
  options_json: DecisionOption[] | null;
  decision: string | null;
  observable_rationale: string | null;
  consequences_json: string[] | null;
  risks_json: string[] | null;
  enforcement_json: string[] | null;
  verification: string | null;
  revisit_triggers_json: string[] | null;
  accepted_by: string | null;
  accepted_at: string | null;
  version: number;
}

export interface DecisionTransition {
  id: string;
  decision_id: string;
  from_status: RecordStatus | null;
  to_status: RecordStatus;
  scope_delta: string | null;
  actor_id: string | null;
  created_at: string;
  immutable_hash: string | null;
}

export interface DecisionLink {
  decision_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
}

export interface DecisionConflict {
  decisionId: string;
  /** What is being asked for that contradicts the decision. */
  request: string;
  explanation: string;
  targetType: string | null;
  targetId: string | null;
}

export interface DecisionsPayload {
  decisions: Decision[];
  links: DecisionLink[];
  transitions: DecisionTransition[];
  conflicts: DecisionConflict[];
}

/* ---------------------------------------------------------------------------
   GET /api/activity
   --------------------------------------------------------------------------- */

export type ActivityEventType =
  | "task_created"
  | "task_claimed"
  | "task_started"
  | "task_updated"
  | "task_blocked"
  | "task_unblocked"
  | "verification_attached"
  | "task_completed"
  | "task_reopened"
  | "decision_created"
  | "specification_changed"
  | "code_changed"
  | "session_started"
  | "session_compacted"
  | "session_handed_off"
  | "session_ended"
  | (string & {});

export interface ActivityEvent {
  id: string;
  project_id: string;
  session_id: string | null;
  actor_id: string | null;
  task_id: string | null;
  feature_id: string | null;
  event_type: ActivityEventType;
  summary: string;
  metadata_json: unknown;
  created_at: string;
  sequence: number;
  immutable_hash: string | null;
  actorName?: string | null;
}

export type MemoryKind =
  | "outcome"
  | "decision"
  | "learned_fact"
  | "unresolved_question"
  | "blocker"
  | "handoff"
  | "summary"
  | (string & {});

export interface MemoryEntry {
  id: string;
  project_id: string;
  session_id: string | null;
  task_id: string | null;
  feature_id: string | null;
  kind: MemoryKind;
  title: string;
  content: string;
  source_ref: string | null;
  epistemic_status: EpistemicStatus;
  created_at: string;
  superseded_by: string | null;
  version: number;
}

export interface Page {
  /** Sequence to pass back as `before` for the next page, null when exhausted. */
  nextCursor: number | null;
  hasMore: boolean;
  /** Number of events returned in this page. */
  returned: number;
}

export interface ActivityPayload {
  events: ActivityEvent[];
  memory: MemoryEntry[];
  sessions: WorkSession[];
  page: Page;
}

/* ---------------------------------------------------------------------------
   GET /api/readiness
   --------------------------------------------------------------------------- */

export type CapabilityState =
  | "specified"
  | "awaiting_decision"
  | "not_applicable"
  | "deferred"
  | (string & {});

export interface CapabilityArea {
  id: string;
  /** Plain-language area name, e.g. "Authentication and session lifecycle". */
  name: string;
  state: CapabilityState;
  /** Required whenever the state is not_applicable or deferred. */
  reason: string | null;
  owner: string | null;
  revisitTrigger: string | null;
  consequence: string | null;
  questionIds?: string[];
}

/** One of the twenty module completeness steps. */
export interface ModuleStep {
  moduleId: string;
  /** 1 to 20. */
  step: number;
  name: string;
  state: CapabilityState;
  reason: string | null;
}

export interface ModuleCompleteness {
  moduleId: string;
  moduleName: string;
  steps: ModuleStep[];
  progress: Progress;
}

export interface ReadinessRisk {
  id: string;
  statement: string;
  severity: string;
  mitigation: string | null;
  owner: string | null;
}

export interface ReadinessPayload {
  capabilityAreas: CapabilityArea[];
  modules: ModuleCompleteness[];
  openQuestions: Question[];
  risks: ReadinessRisk[];
  /** Plain-language release readiness verdict plus what still stands in the way. */
  releaseReadiness: {
    verdict: string;
    explanation: string;
    blockers: string[];
  };
  progress: Progress;
}

/* ---------------------------------------------------------------------------
   POST /api/mutations
   --------------------------------------------------------------------------- */

/** The complete accepted action list. Anything else is refused by the service. */
export type MutationAction =
  | "task.create"
  | "task.update"
  | "task.claim"
  | "task.release"
  | "task.transition"
  | "task.block"
  | "task.complete"
  | "task.reopen"
  | "task.cancel"
  | "task.link"
  | "task.addSubtask"
  | "question.answer"
  | "decision.transition"
  | "discovery.upsert"
  | "discovery.convert"
  | "layout.save"
  | "docs.acceptProposal"
  | "docs.rejectProposal";

export interface MutationResult<T = unknown> {
  data: T;
  meta: Meta;
}

/* ---------------------------------------------------------------------------
   Server-sent events
   --------------------------------------------------------------------------- */

export interface HelloEvent {
  sequence: number;
}

export interface ChangeEvent {
  sequence: number;
  eventType?: ActivityEventType;
  /** Record kinds touched, so a listener can refetch only what it shows. */
  scopes?: string[];
}

/** What the live layer reports about the stream, for the header indicator. */
// "degraded" is connected but not receiving: the socket is open and the
// service is answering, while its change poller cannot reach the database. It
// exists because that state used to render as "Live".
export type ConnectionState = "live" | "reconnecting" | "offline" | "degraded";


/* ---------------------------------------------------------------------------
   The five areas section 16.1 requires that had no view.

   Surfaces, APIs, changes, evidence and settings were all in the database and
   reachable from nowhere. These are the shapes their routes return.
   ------------------------------------------------------------------------- */

export interface UiActionRecord {
  id: string;
  surface_id: string;
  name: string;
  label: string | null;
  trigger: string | null;
  effect: string | null;
  confirmation: string | null;
  status: RecordStatus;
}

export interface SurfaceRecord {
  id: string;
  name: string;
  surface_type: string | null;
  route: string | null;
  purpose: string | null;
  module_name: string | null;
  feature_name: string | null;
  primary_role: string | null;
  accessibility_notes: string | null;
  entities_shown_json: string[] | null;
  components_json: string[] | null;
  status: RecordStatus;
  actions: UiActionRecord[];
}

export interface SurfacesPayload {
  surfaces: SurfaceRecord[];
  counts: { surfaces: number; actions: number };
}

export interface ApiServiceRecord {
  id: string;
  name: string;
  purpose: string | null;
  style: string;
  base_path: string | null;
  module_name: string | null;
  status: RecordStatus;
}

export interface ApiOperationRecord {
  id: string;
  name: string;
  style: string;
  purpose: string | null;
  method_or_procedure: string | null;
  path_or_topic: string | null;
  module_name: string | null;
  feature_name: string | null;
  api_service_id: string | null;
  idempotency: string | null;
  changesState: boolean;
  status: RecordStatus;
}

export interface ApisPayload {
  services: ApiServiceRecord[];
  operations: ApiOperationRecord[];
  counts: { services: number; operations: number; ungrouped: number };
}

export interface ChangeTargetRecord {
  change_id: string;
  target_type: string;
  target_id: string;
  what_changed: string | null;
}

export interface ChangeRecord {
  id: string;
  summary: string;
  reason: string;
  change_type: string;
  decided_by: string | null;
  decision_id: string | null;
  decision_title: string | null;
  task_id: string | null;
  created_at: string;
  status: RecordStatus;
  targets: ChangeTargetRecord[];
}

export interface AssumptionRecord {
  id: string;
  statement: string;
  why_assumed: string;
  review_trigger: string;
  consequence_if_wrong: string | null;
  status: RecordStatus;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ChangesPayload {
  changes: ChangeRecord[];
  assumptions: AssumptionRecord[];
  counts: { changes: number; assumptions: number; holding: number };
}

export interface EvidenceRecord {
  id: string;
  task_id: string | null;
  task_name: string | null;
  task_status: RecordStatus | null;
  feature_name: string | null;
  evidence_type: string;
  summary: string;
  reference: string | null;
  result: "pass" | "fail" | "inconclusive";
  status: "current" | "stale" | "superseded";
  check_command: string | null;
  last_checked_at: string | null;
  last_check_result: string | null;
  recorded_at: string;
}

export interface TestPlanCaseRecord {
  id: string;
  name: string;
  kind: string;
  expectation: string;
  command: string | null;
}

export interface TestPlanRecord {
  id: string;
  name: string;
  strategy: string;
  how_to_run: string | null;
  passing_condition: string | null;
  feature_name: string | null;
  status: RecordStatus;
  cases: TestPlanCaseRecord[];
}

export interface EvidenceCriterion {
  id: string;
  feature_id: string;
  feature_name: string | null;
  criterion: string;
  verification_method: string | null;
  status: string;
}

export interface EvidencePayload {
  evidence: EvidenceRecord[];
  criteria: EvidenceCriterion[];
  testPlans: TestPlanRecord[];
  counts: {
    recorded: number; current: number; passing: number; failing: number;
    inconclusive: number; stale: number; reRunnable: number;
    criteriaMet: number; criteriaTotal: number;
  };
}

export interface SettingsPayload {
  project: Project;
  schema: {
    version: number;
    applied: number;
    migrations: { version: number; name: string; applied_at: string }[];
  };
  categories: { id: string; name: string; meaning: string | null }[];
  counts: Record<string, number>;
  storage: Record<string, string>;
}


export interface SyncPeerRecord {
  id: string;
  transport: string;
  location: string | null;
  alias: string | null;
  key_fingerprint: string | null;
  status: string;
  connected_at: string | null;
  last_synced_at: string | null;
}

export interface SyncConflictRecord {
  id: string;
  record_type: string;
  record_id: string;
  status: string;
  resolution: string | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface SyncPayload {
  peer: SyncPeerRecord | null;
  conflicts: SyncConflictRecord[];
  leases: {
    task_id: string;
    task_name: string | null;
    lease_holder: string;
    lease_expires_at: string | null;
    origin_peer: string | null;
  }[];
  trackedRecords: number;
  shared: string[];
  /** Every table that never leaves, with the reason it does not. */
  withheld: { table: string; reason: string }[];
  counts: { shared: number; withheld: number; openConflicts: number; leases: number };
}

export interface TestPlansPayload {
  testPlans: (TestPlanRecord & {
    workflow_name: string | null;
    module_name: string | null;
    how_to_run: string | null;
    passing_condition: string | null;
    /** Passing runs recorded against this plan. Section 9.3 gates on it. */
    passing_runs: number;
    satisfied: boolean;
    last_run_summary: string | null;
    last_run_at: string | null;
    last_run_result: string | null;
  })[];
  counts: { plans: number; accepted: number; cases: number; runnable: number; unrun: number };
}
