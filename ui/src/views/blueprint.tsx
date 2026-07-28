/**
 * The product blueprint: the whole product as one map.
 *
 * The default reading runs left to right, Goals, Milestones, Modules,
 * Features, Workflows, Tasks, which is the chain declared in section 15.3 of
 * the rebuild spec. The containment lines are solid; cross-cutting lines
 * (a goal a feature supports, a task that must finish first, a task that
 * unlocks a feature) are dashed, labelled, and can be switched off on their
 * own from the Relationship filter.
 *
 * It reads `/api/product`, `/api/workflows` and `/api/tasks`, and nothing else.
 * A view is only as current as its stalest read, so the three envelopes are
 * folded into one freshness reading rather than quietly showing the newest.
 */

import {
  Boxes,
  Flag,
  Layers,
  ListChecks,
  Target,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  DetailField,
  DetailLinks,
  GraphCanvas,
  type CanvasDetail,
  type DetailLinkItem,
} from "@/components/canvas/graph-canvas";
import {
  FreshnessLine,
  mergeMeta,
  useLiveRead,
} from "@/components/canvas/freshness";
import { readSavedLayout, type GraphRecord, type GraphRelation, type TypeStyle } from "@/components/canvas/layout";
import { ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { ApiError, getProduct, getTasks, getWorkflows } from "@/lib/api";
import {
  countPhrase,
  exitConditions,
  listPhrase,
  notMeasurable,
  ofPhrase,
  progressPhrase,
  titleCase,
} from "@/lib/format";
import { VIEW_LABELS, hrefFor, type View } from "@/lib/route";
import type {
  Progress,
  ProductPayload,
  TasksPayload,
  WorkflowsPayload,
} from "@/types";

/**
 * Type is carried by the silhouette and by the type word on the node, never by
 * colour. Corner treatment and glyph plate shape are unique per type.
 */
const TYPE_STYLES: Record<string, TypeStyle> = {
  goal: {
    label: "Goal",
    icon: Target,
    shape: { corner: "round", badge: "circle", outline: "solid" },
    description: "An outcome the product is trying to reach.",
    tone: "goal",
  },
  milestone: {
    label: "Milestone",
    icon: Flag,
    shape: { corner: "round", badge: "diamond", outline: "solid" },
    description: "A point the project is aiming to arrive at, in order.",
    tone: "milestone",
  },
  module: {
    label: "Module",
    icon: Boxes,
    shape: { corner: "square", badge: "square", outline: "solid" },
    description: "A part of the product that owns a set of features.",
    tone: "module",
  },
  feature: {
    label: "Feature",
    icon: Layers,
    shape: { corner: "large", badge: "square", outline: "solid" },
    description: "Something the product does for the people using it.",
    tone: "feature",
  },
  workflow: {
    label: "Workflow",
    icon: WorkflowIcon,
    shape: { corner: "large", badge: "diamond", outline: "solid" },
    description: "The ordered steps a feature is carried out through.",
    tone: "workflow",
  },
  task: {
    label: "Task",
    icon: ListChecks,
    shape: { corner: "small", badge: "circle", outline: "dashed" },
    description: "A piece of work someone does to move a feature forward.",
    tone: "task",
  },
};

const TIERS: Record<string, number> = {
  goal: 0,
  milestone: 1,
  module: 2,
  feature: 3,
  workflow: 4,
  task: 5,
};

/** Where each kind of record has its own full page. */
const HOME_VIEW: Record<string, View> = {
  goal: "product",
  milestone: "product",
  module: "product",
  feature: "features",
  workflow: "workflows",
  task: "tasks",
};

interface BlueprintPayload {
  product: ProductPayload;
  workflows: WorkflowsPayload;
  tasks: TasksPayload;
}

interface Entry {
  record: GraphRecord;
  /** Progress as read from the service, so the panel can explain a blank. */
  progress: Progress | null | undefined;
  fields: { label: string; value: string }[];
}

function textOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function jsonList(value: string[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  return listPhrase(value.filter(Boolean));
}

/** The canvas on its own, so a page can embed it under its own heading. */
export function Blueprint() {
  const load = useCallback(async (signal: AbortSignal) => {
    const [product, workflows, tasks] = await Promise.all([
      getProduct(signal),
      getWorkflows(signal),
      getTasks(signal),
    ]);
    return {
      data: {
        product: product.data,
        workflows: workflows.data,
        tasks: tasks.data,
      },
      meta: mergeMeta([product.meta, workflows.meta, tasks.meta]),
    };
  }, []);

  const read = useLiveRead<BlueprintPayload>(load);
  const { data, meta, error, loading, connection } = read;

  /**
   * Tasks are off the map by default.
   *
   * A blueprint answers what the product is: goals, milestones, modules,
   * features and workflows. Tasks are how it gets built, they have their own
   * page, and this project has 458 of them, which drew a map that was mostly
   * task nodes and unreadable for it. They can be switched on when the question
   * really is where the work sits.
   */
  const [includeTasks, setIncludeTasks] = useState(false);
  const model = useMemo(() => buildModel(data, includeTasks), [data, includeTasks]);

  const savedLayout = useMemo(
    () => readSavedLayout(data?.product),
    [data?.product],
  );

  const renderDetail = useCallback(
    (id: string, open: (next: string) => void): CanvasDetail | null =>
      buildDetail(id, model, open),
    [model],
  );

  if (loading && !data) {
    return (
      <Loading
        title="Loading the product blueprint"
        explanation="Reading the goals, milestones, modules, features, workflows and tasks from the project database on this machine. The map is drawn as soon as all three reads land."
      />
    );
  }

  if (error && !data) {
    return error instanceof ApiError && error.isOffline ? (
      <Offline onReconnect={read.reconnect} state={connection === "reconnecting" ? "reconnecting" : "offline"} meta={meta} />
    ) : (
      <ErrorState
        title="The blueprint did not load"
        error={error}
        onRetry={read.refresh}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FreshnessLine
        meta={meta}
        connection={connection}
        connectionExplanation={read.connectionExplanation}
        onRefresh={read.refresh}
        refreshing={read.refreshing}
      />

      {error && data ? (
        <ErrorState
          density="inline"
          title="The last refresh failed"
          error={error}
          onRetry={read.refresh}
        />
      ) : null}

      {meta?.stale ? (
        <Stale
          meta={meta}
          onRefresh={read.refresh}
          showing={countPhrase(model.records.length, "record")}
          explanation="The three reads behind this map did not all come from the same database revision, so part of the map may be behind. Refresh to draw it from one revision."
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          aria-pressed={includeTasks}
          onClick={() => setIncludeTasks((on: boolean) => !on)}
        >
          {includeTasks ? "Hide tasks" : "Show tasks"}
          <span className="ml-1.5 text-ink-3 tabular-nums">
            {data?.tasks.tasks.length ?? 0}
          </span>
        </Button>
      </div>

      <GraphCanvas
        className="h-[calc(100dvh-13rem)] min-h-[560px]"
        label="Product blueprint"
        instructions="Click a node to light up what it connects to, double click to open its detail panel, drag to move it, and drag empty space to pan."
        records={model.records}
        relations={model.relations}
        typeStyles={TYPE_STYLES}
        mode="tiers"
        saved={savedLayout}
        layoutScope="blueprint"
        renderDetail={renderDetail}
        empty={{
          title: "There is no product to map yet",
          explanation:
            "Goals, milestones, modules, features, workflows and tasks all appear here as soon as they exist. They are created by working through discovery and planning with Superdev in this project, not from this page.",
          actions: [
            { label: "Go to Discovery", href: hrefFor("discovery") },
            { label: "Go to the overview", href: hrefFor("overview") },
          ],
        }}
      />
    </div>
  );
}

/** The blueprint as a whole page, for a route that shows nothing else. */
export function BlueprintView() {
  return (
    <>
      <ViewHeader
        title="Product blueprint"
        description="The whole product as one map: goals, milestones, modules, features, workflows and the tasks delivering them, with the lines that connect them."
      />
      {/* max-w-none and the wider padding are deliberate: this page is one
          picture, and the reading measure that helps prose actively hurts a
          graph. cn runs twMerge, so this beats ViewBody's own ceiling. */}
      <ViewBody width="full">
        <Blueprint />
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Model
   --------------------------------------------------------------------------- */

interface Model {
  records: GraphRecord[];
  relations: GraphRelation[];
  entries: Map<string, Entry>;
}

const EMPTY_MODEL: Model = { records: [], relations: [], entries: new Map() };

function buildModel(
  data: BlueprintPayload | null,
  includeTasks: boolean,
): Model {
  if (!data) return EMPTY_MODEL;

  const records: GraphRecord[] = [];
  const entries = new Map<string, Entry>();

  const add = (record: GraphRecord, entry: Omit<Entry, "record">) => {
    records.push(record);
    entries.set(record.id, { record, ...entry });
  };

  for (const goal of data.product.goals) {
    add(
      {
        id: goal.id,
        name: goal.name,
        typeKey: "goal",
        status: goal.status,
        meta: progressPhrase(goal.progress),
        summary: textOf(goal.description) ?? textOf(goal.why_it_matters),
        tier: TIERS.goal,
        searchText: goal.why_it_matters,
      },
      {
        progress: goal.progress,
        fields: [
          { label: "Why it matters", value: textOf(goal.why_it_matters) ?? "" },
          { label: "Priority", value: goal.priority ? titleCase(goal.priority) : "" },
          {
            label: "Success criteria",
            value:
              goal.successCriteria.length > 0
                ? ofPhrase(
                    goal.successCriteria.filter(
                      (criterion) => criterion.status === "complete",
                    ).length,
                    goal.successCriteria.length,
                    "success criterion",
                    "met",
                  )
                : "None have been written for this goal yet",
          },
        ],
      },
    );
  }

  for (const milestone of data.product.milestones) {
    add(
      {
        id: milestone.id,
        name: milestone.name,
        typeKey: "milestone",
        status: milestone.status,
        meta: progressPhrase(milestone.progress),
        summary: textOf(milestone.outcome),
        tier: TIERS.milestone,
      },
      {
        progress: milestone.progress,
        fields: [
          { label: "Outcome", value: textOf(milestone.outcome) ?? "" },
          {
            label: "Entry conditions",
            value: jsonList(milestone.entry_conditions_json) ?? "",
          },
          {
            label: "Exit conditions",
            value: exitConditions(milestone.exit_conditions_json).map((e) => e.condition).join(", "),
          },
          { label: "Target date", value: milestone.target_date ?? "" },
        ],
      },
    );
  }

  for (const module of data.product.modules) {
    add(
      {
        id: module.id,
        name: module.name,
        typeKey: "module",
        status: module.status,
        meta: progressPhrase(module.progress),
        summary: textOf(module.purpose),
        tier: TIERS.module,
        searchText: module.purpose,
      },
      {
        progress: module.progress,
        fields: [
          { label: "Purpose", value: textOf(module.purpose) ?? "" },
          {
            label: "Primary users",
            value: jsonList(module.primary_users_json) ?? "",
          },
          { label: "Owns", value: jsonList(module.owns_json) ?? "" },
          { label: "Consumes", value: jsonList(module.consumes_json) ?? "" },
        ],
      },
    );
  }

  for (const feature of data.product.features) {
    add(
      {
        id: feature.id,
        name: feature.name,
        typeKey: "feature",
        status: feature.status,
        meta: progressPhrase(feature.progress),
        summary: textOf(feature.purpose) ?? textOf(feature.user_value),
        tier: TIERS.feature,
        parentId: feature.module_id ?? feature.milestone_id ?? null,
        searchText: [feature.purpose, feature.user_statement, feature.user_value]
          .filter(Boolean)
          .join(" "),
      },
      {
        progress: feature.progress,
        fields: [
          { label: "Purpose", value: textOf(feature.purpose) ?? "" },
          { label: "User value", value: textOf(feature.user_value) ?? "" },
          { label: "In scope", value: jsonList(feature.scope_in_json) ?? "" },
          { label: "Out of scope", value: jsonList(feature.scope_out_json) ?? "" },
          { label: "What works now", value: textOf(feature.what_works_now) ?? "" },
          { label: "What remains", value: textOf(feature.what_remains) ?? "" },
          { label: "Next action", value: textOf(feature.next_action) ?? "" },
        ],
      },
    );
  }

  const stepsByWorkflow = new Map<string, { total: number; done: number }>();
  for (const step of data.workflows.steps) {
    const tally = stepsByWorkflow.get(step.workflow_id) ?? { total: 0, done: 0 };
    tally.total += 1;
    if (step.status === "complete") tally.done += 1;
    stepsByWorkflow.set(step.workflow_id, tally);
  }

  for (const workflow of data.workflows.workflows) {
    const tally = stepsByWorkflow.get(workflow.id);
    add(
      {
        id: workflow.id,
        name: workflow.name,
        typeKey: "workflow",
        status: workflow.status,
        meta: tally
          ? ofPhrase(tally.done, tally.total, "step", "complete")
          : progressPhrase(workflow.progress),
        summary: textOf(workflow.purpose),
        tier: TIERS.workflow,
        parentId: workflow.feature_id,
        searchText: workflow.purpose,
      },
      {
        progress: workflow.progress,
        fields: [
          { label: "Purpose", value: textOf(workflow.purpose) ?? "" },
          { label: "Trigger", value: textOf(workflow.trigger) ?? "" },
          { label: "Actors", value: jsonList(workflow.actors_json) ?? "" },
          {
            label: "Preconditions",
            value: jsonList(workflow.preconditions_json) ?? "",
          },
          {
            label: "Completion criteria",
            value: textOf(workflow.completion_criteria) ?? "",
          },
          {
            label: "Steps",
            value: tally
              ? ofPhrase(tally.done, tally.total, "step", "complete")
              : "No steps have been written for this workflow yet",
          },
        ],
      },
    );
  }

  const subtaskCount = new Map<string, number>();
  for (const task of data.tasks.tasks) {
    if (!task.parent_task_id) continue;
    subtaskCount.set(
      task.parent_task_id,
      (subtaskCount.get(task.parent_task_id) ?? 0) + 1,
    );
  }

  for (const task of includeTasks ? data.tasks.tasks : []) {
    const children = subtaskCount.get(task.id) ?? 0;
    add(
      {
        id: task.id,
        name: task.name,
        typeKey: "task",
        status: task.status,
        meta:
          task.progress && task.progress.measurable && task.progress.total > 0
            ? progressPhrase(task.progress)
            : children > 0
              ? countPhrase(children, "subtask")
              : progressPhrase(task.progress),
        summary: textOf(task.expected_outcome) ?? textOf(task.description),
        tier: TIERS.task,
        parentId: task.parent_task_id ?? task.feature_id ?? null,
        searchText: [task.description, task.why_needed, task.categoryName]
          .filter(Boolean)
          .join(" "),
      },
      {
        progress: task.progress,
        fields: [
          { label: "Expected outcome", value: textOf(task.expected_outcome) ?? "" },
          { label: "Why it is needed", value: textOf(task.why_needed) ?? "" },
          {
            label: "Completion criteria",
            value: jsonList(task.completion_criteria_json) ?? "",
          },
          { label: "Category", value: task.categoryName ?? "" },
          { label: "Priority", value: task.priority ? titleCase(task.priority) : "" },
          {
            label: "Subtasks",
            value: children > 0 ? countPhrase(children, "subtask") : "",
          },
        ],
      },
    );
  }

  /* ---- relations ---- */

  const known = new Set(records.map((record) => record.id));
  const seen = new Set<string>();
  const relations: GraphRelation[] = [];
  const link = (
    from: string | null | undefined,
    to: string | null | undefined,
    kindKey: string,
    kindLabel: string,
    hierarchy: boolean,
  ) => {
    if (!from || !to || from === to) return;
    if (!known.has(from) || !known.has(to)) return;
    const id = `${kindKey}:${from}:${to}`;
    if (seen.has(id)) return;
    seen.add(id);
    relations.push({ id, from, to, kindKey, kindLabel, hierarchy });
  };

  for (const feature of data.product.features) {
    link(feature.module_id, feature.id, "contains", "Contains", true);
    link(feature.milestone_id, feature.id, "contains", "Contains", true);
    for (const goalId of feature.goalIds ?? []) {
      link(goalId, feature.id, "supports", "Supports", false);
    }
  }
  for (const workflow of data.workflows.workflows) {
    link(workflow.feature_id, workflow.id, "contains", "Contains", true);
  }
  for (const task of includeTasks ? data.tasks.tasks : []) {
    if (task.parent_task_id) {
      link(task.parent_task_id, task.id, "contains", "Contains", true);
    } else {
      link(task.feature_id, task.id, "delivers", "Delivered By", true);
    }
    link(task.id, task.enabled_feature_id, "enables", "Enables", false);
  }
  for (const dependency of includeTasks ? data.tasks.dependencies : []) {
    link(
      dependency.task_id,
      dependency.depends_on_task_id,
      "depends_on",
      "Depends On",
      false,
    );
  }

  return { records, relations, entries };
}

/* ---------------------------------------------------------------------------
   Detail panel
   --------------------------------------------------------------------------- */

function buildDetail(
  id: string,
  model: Model,
  open: (next: string) => void,
): CanvasDetail | null {
  const entry = model.entries.get(id);
  if (!entry) return null;

  const style = TYPE_STYLES[entry.record.typeKey];
  const measurable =
    entry.progress && entry.progress.measurable && entry.progress.total > 0;
  const blank = notMeasurable(
    `This ${style ? style.label.toLowerCase() : "record"}`,
  );

  const outgoing: DetailLinkItem[] = [];
  const incoming: DetailLinkItem[] = [];
  for (const relation of model.relations) {
    if (relation.from === id) {
      const other = model.entries.get(relation.to);
      if (other) {
        outgoing.push({
          id: other.record.id,
          name: other.record.name,
          typeLabel: TYPE_STYLES[other.record.typeKey]?.label ?? "Record",
          status: other.record.status,
          relationship: relation.kindLabel,
        });
      }
    } else if (relation.to === id) {
      const other = model.entries.get(relation.from);
      if (other) {
        incoming.push({
          id: other.record.id,
          name: other.record.name,
          typeLabel: TYPE_STYLES[other.record.typeKey]?.label ?? "Record",
          status: other.record.status,
          relationship: relation.kindLabel,
        });
      }
    }
  }

  const home = HOME_VIEW[entry.record.typeKey];

  return {
    title: entry.record.name,
    identifier: `${style?.label ?? "Record"} ${entry.record.id}`,
    description: style?.description,
    body: (
      <div className="flex flex-col">
        <DetailField label="Status">
          <Status value={entry.record.status} />
        </DetailField>

        <DetailField label="Progress">
          {measurable ? (
            <span>
              {progressPhrase(entry.progress)}
              {entry.progress?.remains ? `. Still to do: ${entry.progress.remains}` : ""}
              {entry.progress?.sourceRevision !== undefined
                ? `. Counted at database revision ${entry.progress.sourceRevision}.`
                : "."}
            </span>
          ) : (
            <span>
              <span className="font-chassis text-chassis text-ink">
                {blank.label}
              </span>
              . {blank.explanation}
            </span>
          )}
        </DetailField>

        {entry.fields
          .filter((field) => field.value.trim().length > 0)
          .map((field) => (
            <DetailField key={field.label} label={field.label}>
              {field.value}
            </DetailField>
          ))}

        <DetailField label="What it contains or points to">
          <DetailLinks
            items={outgoing}
            onOpen={open}
            emptyText="Nothing on this map hangs off this record yet."
          />
        </DetailField>

        <DetailField label="What points at it">
          <DetailLinks
            items={incoming}
            onOpen={open}
            emptyText="Nothing on this map points at this record yet."
          />
        </DetailField>
      </div>
    ),
    footer: home ? (
      <Button asChild variant="outline" size="sm">
        <a href={hrefFor(home, entry.record.id)}>
          Open the full record in {VIEW_LABELS[home]}
        </a>
      </Button>
    ) : undefined,
  };
}
