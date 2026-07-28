/**
 * Everything the tasks view derives rather than draws: the URL state that makes
 * a filtered view shareable, the cross-reference index over GET /api/tasks, the
 * filter and sort rules, and the plain-language vocabulary the panels print.
 *
 * There is no JSX here. It sits beside the components that use it so the whole
 * work-management surface is one directory.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { titleCase } from "@/lib/format";
import type {
  Agent,
  Branch,
  Developer,
  FeatureSummary,
  Milestone,
  Module,
  ProductPayload,
  Task,
  TaskAssignment,
  TaskCategory,
  TaskContractLink,
  TaskDependency,
  TasksPayload,
  VerificationEvidence,
} from "@/types";

/* ---------------------------------------------------------------------------
   Rows as the service actually sends them

   The read model selects every column, so a few fields arrive that the shared
   payload types do not declare. They are optional here rather than assumed, so
   an older service that omits one is a missing reading rather than a crash.
   --------------------------------------------------------------------------- */

export interface TaskRow extends Task {
  created_at?: string | null;
  updated_at?: string | null;
  sequence?: number | null;
  block_reason?: string | null;
  enabling_rationale?: string | null;
  affected_boundaries_json?: string[] | null;
  contractLinkCount?: number;
}

export interface EvidenceRow extends VerificationEvidence {
  /** pass, fail or inconclusive. Absent on a service that does not record it. */
  result?: string | null;
}

/* ---------------------------------------------------------------------------
   Vocabulary
   --------------------------------------------------------------------------- */

/** Priorities the service accepts, most urgent first. */
export const TASK_PRIORITIES = [
  "critical",
  "urgent",
  "high",
  "normal",
  "medium",
  "low",
] as const;

/** Statuses task.transition accepts. Terminal moves have their own actions. */
export const TRANSITION_TARGETS = [
  "draft",
  "ready",
  "in_progress",
  "in_review",
  "verifying",
  "paused",
] as const;

/** The order statuses are read in, which is also the order of board columns. */
export const STATUS_ORDER = [
  "draft",
  "ready",
  "in_progress",
  "in_review",
  "verifying",
  "blocked",
  "paused",
  "complete",
  "cancelled",
  "superseded",
] as const;

const CLOSED_STATUSES = new Set(["complete", "cancelled", "superseded"]);

export function isOpenStatus(status: string | null | undefined): boolean {
  return !CLOSED_STATUSES.has(String(status ?? ""));
}

/** What a task may claim to implement, in the words a person would use. */
export const CONTRACT_TARGET_LABELS: Record<string, string> = {
  workflow_step: "Workflow step",
  ui_action: "UI action",
  api_operation: "API operation",
  data_entity: "Data entity",
  schema_migration: "Schema migration",
  integration: "Integration",
  job: "Background job",
  webhook: "Webhook",
  nfr: "Non-functional requirement",
  document: "Document",
  decision: "Decision",
  acceptance_criterion: "Acceptance criterion",
  surface: "Surface",
  state_transition: "State transition",
  permission: "Permission",
};

export const CONTRACT_TARGET_TYPES = Object.keys(CONTRACT_TARGET_LABELS);

export const CONTRACT_RELATIONSHIPS = [
  "implements",
  "verifies",
  "modifies",
  "documents",
  "enables",
] as const;

export const CONTRACT_RELATIONSHIP_LABELS: Record<string, string> = {
  implements: "Implements",
  verifies: "Verifies",
  modifies: "Modifies",
  documents: "Documents",
  enables: "Enables",
};

/** How a dependency reads in a sentence, from the depending task's side. */
export const DEPENDENCY_LABELS: Record<string, string> = {
  blocks: "Cannot start until",
  informs: "Should follow",
  relates: "Related to",
};

export function contractTargetLabel(type: string | null | undefined): string {
  if (!type) return "Unspecified contract";
  return CONTRACT_TARGET_LABELS[type] ?? titleCase(type);
}

export function relationshipLabel(value: string | null | undefined): string {
  if (!value) return "Implements";
  return CONTRACT_RELATIONSHIP_LABELS[value] ?? titleCase(value);
}

export function priorityLabel(value: string | null | undefined): string {
  return value ? titleCase(value) : "No priority set";
}

export function priorityRank(value: string | null | undefined): number {
  const index = (TASK_PRIORITIES as readonly string[]).indexOf(
    String(value ?? ""),
  );
  return index === -1 ? TASK_PRIORITIES.length : index;
}

export function statusRank(value: string | null | undefined): number {
  const index = (STATUS_ORDER as readonly string[]).indexOf(String(value ?? ""));
  return index === -1 ? STATUS_ORDER.length : index;
}

export function agentLabel(agent: Agent | undefined | null): string {
  if (!agent) return "Unknown agent";
  const harness = titleCase(agent.harness);
  return agent.model_label ? `${harness} (${agent.model_label})` : harness;
}

/* ---------------------------------------------------------------------------
   Layouts and sorting
   --------------------------------------------------------------------------- */

export type TaskLayout = "list" | "board" | "hierarchy";

export const TASK_LAYOUTS: TaskLayout[] = ["list", "board", "hierarchy"];

export const LAYOUT_LABELS: Record<TaskLayout, string> = {
  list: "List",
  board: "Board",
  hierarchy: "Hierarchy",
};

export const LAYOUT_DESCRIPTIONS: Record<TaskLayout, string> = {
  list: "Every matching task in one dense, sortable table",
  board: "Matching tasks in a column per status",
  hierarchy: "Parent tasks with their subtasks, expandable",
};

export type SortKey =
  | "sequence"
  | "name"
  | "status"
  | "priority"
  | "feature"
  | "assignee"
  | "due"
  | "updated";

export type SortDirection = "asc" | "desc";

export const SORT_LABELS: Record<SortKey, string> = {
  sequence: "Project order",
  name: "Name",
  status: "Status",
  priority: "Priority",
  feature: "Feature",
  assignee: "Assigned to",
  due: "Due date",
  updated: "Last changed",
};

/* ---------------------------------------------------------------------------
   Filters
   --------------------------------------------------------------------------- */

export type AssignmentFilter = "any" | "claimed" | "unclaimed";
export type BlockedFilter = "any" | "blocked" | "not_blocked";
export type EvidenceFilter = "any" | "with" | "without";

export interface TaskFilters {
  /** Free text over id, name, purpose, outcome, feature and category. */
  text: string;
  status: string[];
  category: string[];
  feature: string[];
  module: string[];
  milestone: string[];
  priority: string[];
  developer: string[];
  agent: string[];
  branch: string[];
  assignment: AssignmentFilter;
  blocked: BlockedFilter;
  evidence: EvidenceFilter;
}

/** The multi-choice filters, so the toolbar and the URL agree on the list. */
export const MULTI_FILTERS = [
  "status",
  "category",
  "feature",
  "module",
  "milestone",
  "priority",
  "developer",
  "agent",
  "branch",
] as const;

export type MultiFilterKey = (typeof MULTI_FILTERS)[number];

export const FILTER_LABELS: Record<MultiFilterKey, string> = {
  status: "Status",
  category: "Category",
  feature: "Feature",
  module: "Module",
  milestone: "Milestone",
  priority: "Priority",
  developer: "Developer",
  agent: "Agent",
  branch: "Branch",
};

export const EMPTY_FILTERS: TaskFilters = {
  text: "",
  status: [],
  category: [],
  feature: [],
  module: [],
  milestone: [],
  priority: [],
  developer: [],
  agent: [],
  branch: [],
  assignment: "any",
  blocked: "any",
  evidence: "any",
};

export const ASSIGNMENT_LABELS: Record<AssignmentFilter, string> = {
  any: "Claimed or not",
  claimed: "Claimed by someone",
  unclaimed: "Not claimed",
};

export const BLOCKED_LABELS: Record<BlockedFilter, string> = {
  any: "Blocked or not",
  blocked: "Blocked only",
  not_blocked: "Hide blocked",
};

export const EVIDENCE_LABELS: Record<EvidenceFilter, string> = {
  any: "With or without evidence",
  with: "Has evidence",
  without: "No evidence yet",
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  if (filters.text.trim()) return true;
  if (filters.assignment !== "any") return true;
  if (filters.blocked !== "any") return true;
  if (filters.evidence !== "any") return true;
  return MULTI_FILTERS.some((key) => filters[key].length > 0);
}

export function countActiveFilters(filters: TaskFilters): number {
  let count = 0;
  if (filters.text.trim()) count += 1;
  if (filters.assignment !== "any") count += 1;
  if (filters.blocked !== "any") count += 1;
  if (filters.evidence !== "any") count += 1;
  for (const key of MULTI_FILTERS) if (filters[key].length > 0) count += 1;
  return count;
}

/* ---------------------------------------------------------------------------
   URL state

   The view and the open record live in the hash, which lib/route.ts owns. The
   filters, the layout and the sort live in the query string, so the whole state
   of the panel travels in one address that someone else can open.
   --------------------------------------------------------------------------- */

export interface TaskParams {
  layout: TaskLayout;
  sort: SortKey;
  direction: SortDirection;
  filters: TaskFilters;
}

export const DEFAULT_PARAMS: TaskParams = {
  layout: "list",
  sort: "sequence",
  direction: "asc",
  filters: EMPTY_FILTERS,
};

const PARAM_PREFIX = "task.";

function readList(search: URLSearchParams, key: string): string[] {
  const raw = search.get(`${PARAM_PREFIX}${key}`);
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readOne<T extends string>(
  search: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = search.get(`${PARAM_PREFIX}${key}`);
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export function readParams(search: string): TaskParams {
  const params = new URLSearchParams(search);
  const filters: TaskFilters = {
    ...EMPTY_FILTERS,
    text: params.get(`${PARAM_PREFIX}text`) ?? "",
    assignment: readOne(
      params,
      "assignment",
      ["any", "claimed", "unclaimed"] as const,
      "any",
    ),
    blocked: readOne(
      params,
      "blocked",
      ["any", "blocked", "not_blocked"] as const,
      "any",
    ),
    evidence: readOne(
      params,
      "evidence",
      ["any", "with", "without"] as const,
      "any",
    ),
  };
  for (const key of MULTI_FILTERS) filters[key] = readList(params, key);

  return {
    layout: readOne(params, "layout", TASK_LAYOUTS, DEFAULT_PARAMS.layout),
    sort: readOne(
      params,
      "sort",
      Object.keys(SORT_LABELS) as SortKey[],
      DEFAULT_PARAMS.sort,
    ),
    direction: readOne(
      params,
      "direction",
      ["asc", "desc"] as const,
      DEFAULT_PARAMS.direction,
    ),
    filters,
  };
}

/** Only values that differ from the default are written, so the URL stays short. */
export function writeParams(next: TaskParams, existing: string): string {
  const params = new URLSearchParams(existing);
  const set = (key: string, value: string, fallback: string) => {
    if (value && value !== fallback) params.set(`${PARAM_PREFIX}${key}`, value);
    else params.delete(`${PARAM_PREFIX}${key}`);
  };

  set("layout", next.layout, DEFAULT_PARAMS.layout);
  set("sort", next.sort, DEFAULT_PARAMS.sort);
  set("direction", next.direction, DEFAULT_PARAMS.direction);
  set("text", next.filters.text.trim(), "");
  set("assignment", next.filters.assignment, "any");
  set("blocked", next.filters.blocked, "any");
  set("evidence", next.filters.evidence, "any");
  for (const key of MULTI_FILTERS) {
    set(key, next.filters[key].join(","), "");
  }
  return params.toString();
}

/**
 * Task parameters kept in the address bar.
 *
 * Writes replace rather than push, so twenty filter tweaks do not become twenty
 * back-button steps, and popstate is watched so the browser's own back and
 * forward still restore a shared state.
 */
export function useTaskParams() {
  const [params, setParams] = useState<TaskParams>(() =>
    readParams(window.location.search),
  );

  useEffect(() => {
    const onPop = () => setParams(readParams(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<TaskParams>) => {
    setParams((current) => {
      const next: TaskParams = { ...current, ...patch };
      const search = writeParams(next, window.location.search);
      const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", url);
      return next;
    });
  }, []);

  const setFilters = useCallback(
    (patch: Partial<TaskFilters>) => {
      setParams((current) => {
        const next: TaskParams = {
          ...current,
          filters: { ...current.filters, ...patch },
        };
        const search = writeParams(next, window.location.search);
        const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", url);
        return next;
      });
    },
    [],
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [
    setFilters,
  ]);

  return { params, update, setFilters, clearFilters };
}

/** Add or remove one value from a multi-choice filter. */
export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

/* ---------------------------------------------------------------------------
   The index
   --------------------------------------------------------------------------- */

export interface Option {
  value: string;
  label: string;
  /** How many tasks carry this value, before any filter is applied. */
  count: number;
}

export interface Holder {
  /** Plain language for who holds the task. */
  label: string;
  developer: Developer | null;
  agent: Agent | null;
  branch: Branch | null;
  assignment: TaskAssignment | null;
}

export interface TaskIndex {
  tasks: TaskRow[];
  byId: Map<string, TaskRow>;
  childrenOf: Map<string, TaskRow[]>;
  linksByTask: Map<string, TaskContractLink[]>;
  /** What this task is waiting on. */
  dependsOn: Map<string, TaskDependency[]>;
  /** What is waiting on this task. */
  requiredBy: Map<string, TaskDependency[]>;
  evidenceByTask: Map<string, EvidenceRow[]>;
  assignmentsByTask: Map<string, TaskAssignment[]>;
  categoryById: Map<string, TaskCategory>;
  developerById: Map<string, Developer>;
  agentById: Map<string, Agent>;
  branchById: Map<string, Branch>;
  featureById: Map<string, FeatureSummary>;
  moduleById: Map<string, Module>;
  milestoneById: Map<string, Milestone>;
  featureNames: Map<string, string>;
  options: Record<MultiFilterKey, Option[]>;
  /** False when GET /api/product could not be read, so module and milestone
   *  cannot be resolved and the interface has to say so. */
  productAvailable: boolean;
}

function push<T>(map: Map<string, T[]>, key: string | null | undefined, value: T) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function countOptions(
  entries: [value: string, label: string][],
  counts: Map<string, number>,
): Option[] {
  return entries
    .map(([value, label]) => ({ value, label, count: counts.get(value) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildIndex(
  payload: TasksPayload,
  product: ProductPayload | null,
): TaskIndex {
  const tasks = (payload.tasks ?? []) as TaskRow[];
  const byId = new Map(tasks.map((task) => [task.id, task]));

  const childrenOf = new Map<string, TaskRow[]>();
  for (const task of tasks) push(childrenOf, task.parent_task_id, task);

  const linksByTask = new Map<string, TaskContractLink[]>();
  for (const link of payload.contractLinks ?? []) {
    push(linksByTask, link.task_id, link);
  }

  const dependsOn = new Map<string, TaskDependency[]>();
  const requiredBy = new Map<string, TaskDependency[]>();
  for (const dependency of payload.dependencies ?? []) {
    push(dependsOn, dependency.task_id, dependency);
    push(requiredBy, dependency.depends_on_task_id, dependency);
  }

  const evidenceByTask = new Map<string, EvidenceRow[]>();
  for (const record of (payload.evidence ?? []) as EvidenceRow[]) {
    push(evidenceByTask, record.task_id, record);
  }

  const assignmentsByTask = new Map<string, TaskAssignment[]>();
  for (const assignment of payload.assignments ?? []) {
    push(assignmentsByTask, assignment.task_id, assignment);
  }

  const categoryById = new Map(
    (payload.categories ?? []).map((category) => [category.id, category]),
  );
  const developerById = new Map(
    (payload.developers ?? []).map((developer) => [developer.id, developer]),
  );
  const agentById = new Map(
    (payload.agents ?? []).map((agent) => [agent.id, agent]),
  );
  const branchById = new Map(
    (payload.branches ?? []).map((branch) => [branch.id, branch]),
  );

  const featureById = new Map(
    (product?.features ?? []).map((feature) => [feature.id, feature]),
  );
  const moduleById = new Map(
    (product?.modules ?? []).map((module) => [module.id, module]),
  );
  const milestoneById = new Map(
    (product?.milestones ?? []).map((milestone) => [milestone.id, milestone]),
  );

  // Feature names come from the tasks payload as well, so the list still reads
  // properly when the product route could not be reached.
  const featureNames = new Map<string, string>();
  for (const feature of featureById.values()) {
    featureNames.set(feature.id, feature.name);
  }
  for (const task of tasks) {
    if (task.feature_id && task.featureName) {
      featureNames.set(task.feature_id, task.featureName);
    }
  }

  const counts: Record<MultiFilterKey, Map<string, number>> = {
    status: new Map(),
    category: new Map(),
    feature: new Map(),
    module: new Map(),
    milestone: new Map(),
    priority: new Map(),
    developer: new Map(),
    agent: new Map(),
    branch: new Map(),
  };
  const bump = (key: MultiFilterKey, value: string | null | undefined) => {
    if (!value) return;
    counts[key].set(value, (counts[key].get(value) ?? 0) + 1);
  };

  for (const task of tasks) {
    bump("status", task.status);
    bump("category", task.category_id);
    bump("feature", task.feature_id);
    bump("priority", task.priority);
    const feature = task.feature_id ? featureById.get(task.feature_id) : null;
    bump("module", feature?.module_id);
    bump("milestone", feature?.milestone_id);
    bump("developer", task.assignment?.developer_id);
    bump("agent", task.assignment?.agent_id);
    bump("branch", task.assignment?.branch_id);
  }

  const options: Record<MultiFilterKey, Option[]> = {
    status: countOptions(
      [...counts.status.keys()]
        .sort((a, b) => statusRank(a) - statusRank(b))
        .map((value) => [value, titleCase(value)] as [string, string]),
      counts.status,
    ).sort((a, b) => statusRank(a.value) - statusRank(b.value)),
    category: countOptions(
      [...counts.category.keys()].map(
        (id) => [id, categoryById.get(id)?.name ?? id] as [string, string],
      ),
      counts.category,
    ),
    feature: countOptions(
      [...counts.feature.keys()].map(
        (id) => [id, featureNames.get(id) ?? id] as [string, string],
      ),
      counts.feature,
    ),
    module: countOptions(
      [...counts.module.keys()].map(
        (id) => [id, moduleById.get(id)?.name ?? id] as [string, string],
      ),
      counts.module,
    ),
    milestone: countOptions(
      [...counts.milestone.keys()].map(
        (id) => [id, milestoneById.get(id)?.name ?? id] as [string, string],
      ),
      counts.milestone,
    ),
    priority: countOptions(
      [...counts.priority.keys()].map(
        (value) => [value, titleCase(value)] as [string, string],
      ),
      counts.priority,
    ).sort((a, b) => priorityRank(a.value) - priorityRank(b.value)),
    developer: countOptions(
      [...counts.developer.keys()].map(
        (id) =>
          [id, developerById.get(id)?.display_name ?? id] as [string, string],
      ),
      counts.developer,
    ),
    agent: countOptions(
      [...counts.agent.keys()].map(
        (id) => [id, agentLabel(agentById.get(id))] as [string, string],
      ),
      counts.agent,
    ),
    branch: countOptions(
      [...counts.branch.keys()].map(
        (id) => [id, branchById.get(id)?.name ?? id] as [string, string],
      ),
      counts.branch,
    ),
  };

  return {
    tasks,
    byId,
    childrenOf,
    linksByTask,
    dependsOn,
    requiredBy,
    evidenceByTask,
    assignmentsByTask,
    categoryById,
    developerById,
    agentById,
    branchById,
    featureById,
    moduleById,
    milestoneById,
    featureNames,
    options,
    productAvailable: product !== null,
  };
}

/** Who holds the task right now, in words rather than identifiers. */
export function holderOf(task: TaskRow, index: TaskIndex): Holder {
  const assignment = task.assignment ?? null;
  if (!assignment) {
    return {
      label: "Not claimed",
      developer: null,
      agent: null,
      branch: null,
      assignment: null,
    };
  }
  const developer = assignment.developer_id
    ? (index.developerById.get(assignment.developer_id) ?? null)
    : null;
  const agent = assignment.agent_id
    ? (index.agentById.get(assignment.agent_id) ?? null)
    : null;
  const branch = assignment.branch_id
    ? (index.branchById.get(assignment.branch_id) ?? null)
    : null;
  const parts = [developer?.display_name, agent ? agentLabel(agent) : null]
    .filter(Boolean)
    .join(" via ");
  return {
    label: parts || "Claimed by an unnamed session",
    developer,
    agent,
    branch,
    assignment,
  };
}

export function featureNameOf(
  task: TaskRow,
  index: TaskIndex,
): string | null {
  if (!task.feature_id) return null;
  return (
    task.featureName ?? index.featureNames.get(task.feature_id) ?? task.feature_id
  );
}

/* ---------------------------------------------------------------------------
   Filtering and sorting
   --------------------------------------------------------------------------- */

function matchesText(task: TaskRow, index: TaskIndex, needle: string): boolean {
  const haystack = [
    task.id,
    task.name,
    task.description,
    task.expected_outcome,
    task.why_needed,
    featureNameOf(task, index),
    task.categoryName,
    task.priority,
    task.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function applyFilters(
  tasks: TaskRow[],
  filters: TaskFilters,
  index: TaskIndex,
): TaskRow[] {
  const needle = filters.text.trim().toLowerCase();

  return tasks.filter((task) => {
    if (needle && !matchesText(task, index, needle)) return false;
    if (filters.status.length && !filters.status.includes(task.status)) {
      return false;
    }
    if (
      filters.category.length &&
      !(task.category_id && filters.category.includes(task.category_id))
    ) {
      return false;
    }
    if (
      filters.feature.length &&
      !(task.feature_id && filters.feature.includes(task.feature_id))
    ) {
      return false;
    }
    if (
      filters.priority.length &&
      !(task.priority && filters.priority.includes(task.priority))
    ) {
      return false;
    }

    if (filters.module.length || filters.milestone.length) {
      const feature = task.feature_id
        ? index.featureById.get(task.feature_id)
        : undefined;
      if (
        filters.module.length &&
        !(feature?.module_id && filters.module.includes(feature.module_id))
      ) {
        return false;
      }
      if (
        filters.milestone.length &&
        !(
          feature?.milestone_id &&
          filters.milestone.includes(feature.milestone_id)
        )
      ) {
        return false;
      }
    }

    const assignment = task.assignment ?? null;
    if (filters.assignment === "claimed" && !assignment) return false;
    if (filters.assignment === "unclaimed" && assignment) return false;
    if (
      filters.developer.length &&
      !(
        assignment?.developer_id &&
        filters.developer.includes(assignment.developer_id)
      )
    ) {
      return false;
    }
    if (
      filters.agent.length &&
      !(assignment?.agent_id && filters.agent.includes(assignment.agent_id))
    ) {
      return false;
    }
    if (
      filters.branch.length &&
      !(assignment?.branch_id && filters.branch.includes(assignment.branch_id))
    ) {
      return false;
    }

    if (filters.blocked === "blocked" && task.status !== "blocked") return false;
    if (filters.blocked === "not_blocked" && task.status === "blocked") {
      return false;
    }

    if (filters.evidence !== "any") {
      const has = (index.evidenceByTask.get(task.id) ?? []).length > 0;
      if (filters.evidence === "with" && !has) return false;
      if (filters.evidence === "without" && has) return false;
    }

    return true;
  });
}

function compare(
  a: TaskRow,
  b: TaskRow,
  key: SortKey,
  index: TaskIndex,
): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "status":
      return statusRank(a.status) - statusRank(b.status);
    case "priority":
      return priorityRank(a.priority) - priorityRank(b.priority);
    case "feature":
      return (featureNameOf(a, index) ?? "").localeCompare(
        featureNameOf(b, index) ?? "",
      );
    case "assignee":
      return holderOf(a, index).label.localeCompare(holderOf(b, index).label);
    case "due":
      return timeValue(a.due_at) - timeValue(b.due_at);
    case "updated":
      return timeValue(a.updated_at) - timeValue(b.updated_at);
    case "sequence":
    default:
      return (a.sequence ?? 0) - (b.sequence ?? 0);
  }
}

/** A missing date sorts last rather than first, whichever way the column runs. */
function timeValue(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

export function sortTasks(
  tasks: TaskRow[],
  key: SortKey,
  direction: SortDirection,
  index: TaskIndex,
): TaskRow[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...tasks].sort((a, b) => {
    const primary = compare(a, b, key, index);
    if (primary !== 0) return primary * sign;
    return a.id.localeCompare(b.id);
  });
}

/* ---------------------------------------------------------------------------
   Hierarchy
   --------------------------------------------------------------------------- */

export interface HierarchyRow {
  task: TaskRow;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** False when the row is only present because a subtask matched. */
  matched: boolean;
}

/**
 * Parents of a matching task are kept even when the parent itself does not
 * match, otherwise a filtered hierarchy would drop the branch the match hangs
 * off and read as if the subtask did not exist. Those rows are marked so the
 * panel can say why they are there.
 */
export function hierarchyRows(
  matches: TaskRow[],
  index: TaskIndex,
  collapsed: ReadonlySet<string>,
): HierarchyRow[] {
  const matched = new Set(matches.map((task) => task.id));
  const keep = new Set(matched);

  for (const task of matches) {
    let parentId = task.parent_task_id;
    let guard = 0;
    while (parentId && !keep.has(parentId) && guard < 64) {
      keep.add(parentId);
      parentId = index.byId.get(parentId)?.parent_task_id ?? null;
      guard += 1;
    }
  }

  const order = new Map(matches.map((task, position) => [task.id, position]));
  const rank = (task: TaskRow) =>
    order.get(task.id) ?? Number.MAX_SAFE_INTEGER - 1;

  const roots = [...keep]
    .map((id) => index.byId.get(id))
    .filter((task): task is TaskRow => Boolean(task))
    .filter((task) => !task.parent_task_id || !keep.has(task.parent_task_id))
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));

  const rows: HierarchyRow[] = [];
  const seen = new Set<string>();

  const walk = (task: TaskRow, depth: number) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    const children = (index.childrenOf.get(task.id) ?? [])
      .filter((child) => keep.has(child.id))
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    const expanded = !collapsed.has(task.id);
    rows.push({
      task,
      depth,
      hasChildren: children.length > 0,
      expanded,
      matched: matched.has(task.id),
    });
    if (!expanded) return;
    for (const child of children) walk(child, depth + 1);
  };

  for (const root of roots) walk(root, 0);
  return rows;
}

/* ---------------------------------------------------------------------------
   Board
   --------------------------------------------------------------------------- */

export interface BoardColumn {
  status: string;
  label: string;
  tasks: TaskRow[];
}

/**
 * Columns for every status the project actually uses, not only the ones that
 * survived the filter. A status with nothing in it is a real reading, so the
 * column stays and says so rather than vanishing.
 */
export function boardColumns(
  tasks: TaskRow[],
  projectStatuses: readonly string[],
): BoardColumn[] {
  const grouped = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const list = grouped.get(task.status);
    if (list) list.push(task);
    else grouped.set(task.status, [task]);
  }
  const present = new Set([...grouped.keys(), ...projectStatuses]);
  const known = STATUS_ORDER.filter((status) => present.has(status));
  const extra = [...present]
    .filter((status) => !(STATUS_ORDER as readonly string[]).includes(status))
    .sort();
  return [...known, ...extra].map((status) => ({
    status,
    label: titleCase(status),
    tasks: grouped.get(status) ?? [],
  }));
}

/* ---------------------------------------------------------------------------
   Describing the current filter, for the empty state
   --------------------------------------------------------------------------- */

export function describeFilters(
  filters: TaskFilters,
  index: TaskIndex,
): string[] {
  const described: string[] = [];
  if (filters.text.trim()) described.push(`Text contains "${filters.text.trim()}"`);
  for (const key of MULTI_FILTERS) {
    const values = filters[key];
    if (!values.length) continue;
    const labels = values.map(
      (value) =>
        index.options[key].find((option) => option.value === value)?.label ??
        value,
    );
    described.push(`${FILTER_LABELS[key]} is ${labels.join(" or ")}`);
  }
  if (filters.assignment !== "any") {
    described.push(ASSIGNMENT_LABELS[filters.assignment]);
  }
  if (filters.blocked !== "any") described.push(BLOCKED_LABELS[filters.blocked]);
  if (filters.evidence !== "any") {
    described.push(EVIDENCE_LABELS[filters.evidence]);
  }
  return described;
}

/* ---------------------------------------------------------------------------
   The derived view of the payload the components consume
   --------------------------------------------------------------------------- */

export interface TaskViewModel {
  index: TaskIndex;
  /** Everything that survived the filters, in the chosen order. */
  visible: TaskRow[];
  /** Rows for the hierarchy layout, honouring what is collapsed. */
  tree: HierarchyRow[];
  /** Columns for the board layout. */
  columns: BoardColumn[];
  /**
   * The ids the keyboard walks, grouped. Up and Down move inside a group, Left
   * and Right move between groups, which is what makes the board navigable.
   */
  groups: string[][];
  /** Flat navigation order, matching what the eye reads. */
  order: string[];
}

export function useTaskViewModel(
  payload: TasksPayload | null,
  product: ProductPayload | null,
  params: TaskParams,
  collapsed: ReadonlySet<string>,
): TaskViewModel | null {
  return useMemo(() => {
    if (!payload) return null;
    const index = buildIndex(payload, product);
    const matched = applyFilters(index.tasks, params.filters, index);
    const visible = sortTasks(
      matched,
      params.sort,
      params.direction,
      index,
    );
    const tree =
      params.layout === "hierarchy"
        ? hierarchyRows(visible, index, collapsed)
        : [];
    const columns =
      params.layout === "board"
        ? boardColumns(
            visible,
            index.options.status.map((option) => option.value),
          )
        : [];

    let groups: string[][];
    if (params.layout === "board") {
      groups = columns.map((column) => column.tasks.map((task) => task.id));
    } else if (params.layout === "hierarchy") {
      groups = [tree.map((row) => row.task.id)];
    } else {
      groups = [visible.map((task) => task.id)];
    }

    return {
      index,
      visible,
      tree,
      columns,
      groups,
      order: groups.flat(),
    };
  }, [payload, product, params, collapsed]);
}
