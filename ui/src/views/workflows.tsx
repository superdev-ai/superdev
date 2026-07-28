/**
 * Workflows: how the product actually runs.
 *
 * One workflow at a time, read from GET /api/workflows. The swimlane draws the
 * ordered steps in their owner's lane with the failure and retry branches shown
 * as distinct paths, and the tables beneath it carry the same records for
 * keyboard and narrow screens. Step status is the live execution reading: it
 * moves as the database commits, because the whole view refetches on every
 * change the local service reports.
 */

import { GitBranch, Repeat, Search, Workflow as WorkflowIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type * as React from "react";

import {
  WorkflowSwimlane,
  type BranchKind,
  type SwimlaneBranch,
  type SwimlaneStep,
} from "@/components/diagrams/workflow-swimlane";
import {
  CountStrip,
  Facts,
  FreshnessLine,
  Panel,
  RecordName,
  Tag,
  Value,
  ValueList,
  byId,
  useNarrow,
  useResource,
} from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTasks, getWorkflows } from "@/lib/api";
import { countPhrase, listPhrase, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type {
  StateMachine,
  StateTransition,
  Task,
  Workflow,
  WorkflowBranch,
  WorkflowState,
  WorkflowStep,
} from "@/types";

/* ---------------------------------------------------------------------------
   Reading the stored vocabulary in plain language
   --------------------------------------------------------------------------- */

/** The lane a step belongs in: the named owner, or the kind of owner it is. */
function actorOf(step: WorkflowStep): string {
  const named = step.owner_ref?.trim();
  if (named) return named;
  const kind = titleCase(step.owner_type);
  return kind || "Owner not recorded";
}

/** Failure, retry and alternate paths must be told apart from the happy path. */
function branchKind(branchType: string | null | undefined): BranchKind {
  const value = (branchType ?? "").toLowerCase();
  if (/fail|error|exception|timeout|reject/.test(value)) return "failure";
  if (/retry|repeat|again|backoff/.test(value)) return "retry";
  if (/success|happy|complete|primary/.test(value)) return "success";
  return "alternate";
}

const KIND_FALLBACK_LABEL: Record<BranchKind, string> = {
  failure: "Failure",
  retry: "Retry",
  success: "Success",
  alternate: "Alternate Path",
};

function branchLabel(branch: WorkflowBranch): string {
  const kind = branchKind(branch.branch_type);
  const stored = titleCase(branch.branch_type);
  return stored || KIND_FALLBACK_LABEL[kind];
}

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

export function WorkflowsView() {
  const { route, go } = useRoute();
  const { revision } = useLive();
  const workflows = useResource(getWorkflows, revision);
  // Steps carry task ids only. The task list is read alongside so the interface
  // can print what the work is called rather than an identifier on its own.
  const tasks = useResource(getTasks, revision);

  const [query, setQuery] = useState("");
  const narrow = useNarrow();

  const payload = workflows.data;
  const all = useMemo(() => payload?.workflows ?? [], [payload]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((workflow) =>
      `${workflow.name} ${workflow.id} ${workflow.purpose ?? ""} ${workflow.trigger ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [all, query]);

  // The address carries either a workflow or a step inside one, so a step can
  // be linked to, bookmarked and reopened. A step id resolves to the workflow
  // that owns it, which is also why choosing another workflow drops the step.
  const routedStep = useMemo(
    () => (payload?.steps ?? []).find((step) => step.id === route.record) ?? null,
    [payload, route.record],
  );

  const selected = useMemo(() => {
    if (all.length === 0) return null;
    const id = routedStep ? routedStep.workflow_id : route.record;
    return all.find((workflow) => workflow.id === id) ?? filtered[0] ?? all[0];
  }, [all, filtered, route.record, routedStep]);

  const selectedStepId = routedStep?.id ?? null;

  const steps = useMemo(
    () =>
      (payload?.steps ?? [])
        .filter((step) => step.workflow_id === selected?.id)
        .slice()
        .sort((a, b) => a.sequence - b.sequence),
    [payload, selected?.id],
  );

  const branches = useMemo(
    () => (payload?.branches ?? []).filter((branch) => branch.workflow_id === selected?.id),
    [payload, selected?.id],
  );

  const taskIndex = useMemo(
    () => byId(tasks.data?.tasks ?? []),
    [tasks.data],
  );

  const machines = useMemo(
    () =>
      (payload?.stateMachines ?? []).filter(
        (machine) => selected && machine.feature_id === selected.feature_id,
      ),
    [payload, selected],
  );

  /* --- states the panel must answer with --------------------------------- */

  if (workflows.pending && workflows.loading) {
    return (
      <>
        <ViewHeader view="workflows" />
        <ViewBody>
          <Loading
            title="Loading the workflows"
            explanation="Reading every workflow, its steps, its branches and its state machines from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="workflows" />
        <ViewBody>
          {workflows.offline ? (
            <Offline onReconnect={workflows.reload} state="offline" />
          ) : (
            <ErrorState
              title="The workflows did not load"
              error={workflows.error}
              onRetry={workflows.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const counts = [
    { label: "Workflows", value: all.length, unit: "recorded" },
    { label: "Steps", value: payload.steps.length, unit: "in total" },
    { label: "Branches", value: payload.branches.length, unit: "recorded" },
    { label: "Actors", value: payload.actors.length, unit: "named" },
  ];

  return (
    <>
      <ViewHeader view="workflows">
        <CountStrip items={counts} className="-mx-1" />
        <FreshnessLine
          meta={workflows.meta}
          loading={workflows.loading}
          onRefresh={workflows.reload}
        />
      </ViewHeader>

      <ViewBody>
        {workflows.meta?.stale ? (
          <Stale
            meta={workflows.meta}
            onRefresh={workflows.reload}
            showing={countPhrase(all.length, "workflow")}
          />
        ) : null}

        {workflows.error && workflows.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${workflows.error.message} Everything below is the last reading that arrived.`}
            onRetry={workflows.reload}
          />
        ) : null}

        {all.length === 0 ? (
          <Empty
            title="No workflows have been recorded yet"
            explanation="A workflow is the ordered path a person or a system takes through a feature. They appear here once a feature has had its workflows specified, which normally happens during planning."
            actions={[
              { label: "Open Features", href: hrefFor("features") },
              { label: "Open Product", href: hrefFor("product") },
            ]}
          />
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <WorkflowList
              workflows={filtered}
              total={all.length}
              query={query}
              onQuery={setQuery}
              selectedId={selected?.id ?? null}
              onSelect={(id) => go("workflows", id)}
              stepCount={(id) =>
                payload.steps.filter((step) => step.workflow_id === id).length
              }
            />

            {selected ? (
              <WorkflowDetail
                workflow={selected}
                steps={steps}
                branches={branches}
                machines={machines}
                states={payload.states}
                transitions={payload.transitions}
                taskIndex={taskIndex}
                tasksFailed={Boolean(tasks.error) && !tasks.data}
                selectedStepId={selectedStepId}
                onSelectStep={(id) => go("workflows", id ?? selected.id)}
                narrow={narrow}
              />
            ) : (
              <Empty
                title="Nothing matches that search"
                explanation="No workflow name, identifier, purpose or trigger contains that text. Clear the search to see all of them again."
                details={<span>Searched for "{query}".</span>}
                actions={[{ label: "Clear the search", onClick: () => setQuery("") }]}
              />
            )}
          </div>
        )}
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   The workflow list
   --------------------------------------------------------------------------- */

function WorkflowList({
  workflows,
  total,
  query,
  onQuery,
  selectedId,
  onSelect,
  stepCount,
}: {
  workflows: Workflow[];
  total: number;
  query: string;
  onQuery: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  stepCount: (id: string) => number;
}) {
  return (
    <Panel
      title="Workflows"
      description={
        query
          ? `Showing ${workflows.length} of ${countPhrase(total, "workflow")} matching "${query}".`
          : `${countPhrase(total, "workflow")} recorded on this project.`
      }
      bodyClassName="p-0"
      className="h-fit lg:sticky lg:top-16"
    >
      <div className="border-b border-rule p-2">
        <label className="sr-only" htmlFor="workflow-search">
          Search workflows by name, identifier, purpose or trigger
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-3"
          />
          <Input
            id="workflow-search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search workflows"
            className="pl-7"
          />
        </div>
      </div>

      {workflows.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="Nothing matches that search"
          explanation="Clear the search to bring every workflow back."
          details={<span>Searched for "{query}".</span>}
          actions={[{ label: "Clear the search", onClick: () => onQuery("") }]}
        />
      ) : (
        <ul className="max-h-[28rem] overflow-y-auto lg:max-h-[calc(100vh-16rem)]">
          {workflows.map((workflow) => {
            const active = workflow.id === selectedId;
            return (
              <li key={workflow.id}>
                <button
                  type="button"
                  onClick={() => onSelect(workflow.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-rule px-3 py-2 text-left transition-colors duration-[120ms] ease-sd focus-ring row-edge-focus",
                    active
                      ? "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]"
                      : "hover:bg-inset",
                  )}
                >
                  <RecordName name={workflow.name} id={workflow.id} size="sm" />
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Status value={workflow.status} size="sm" />
                    <Tag>{countPhrase(stepCount(workflow.id), "step")}</Tag>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   One workflow
   --------------------------------------------------------------------------- */

function WorkflowDetail({
  workflow,
  steps,
  branches,
  machines,
  states,
  transitions,
  taskIndex,
  tasksFailed,
  selectedStepId,
  onSelectStep,
  narrow,
}: {
  workflow: Workflow;
  steps: WorkflowStep[];
  branches: WorkflowBranch[];
  machines: StateMachine[];
  states: WorkflowState[];
  transitions: StateTransition[];
  taskIndex: Map<string, Task>;
  tasksFailed: boolean;
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  narrow: boolean;
}) {
  const stepById = useMemo(() => byId(steps), [steps]);

  /** What the implementing work is doing right now, per step. */
  const workOf = useMemo(() => {
    const map = new Map<
      string,
      { tasks: Task[]; unknownIds: string[]; summary: string }
    >();
    for (const step of steps) {
      const ids = step.taskIds ?? [];
      const found = ids.map((id) => taskIndex.get(id)).filter(Boolean) as Task[];
      const unknownIds = ids.filter((id) => !taskIndex.has(id));
      const running = found.filter((task) =>
        ["in_progress", "in_review", "verifying"].includes(task.status),
      ).length;
      const done = found.filter((task) => task.status === "complete").length;

      let summary: string;
      if (ids.length === 0) {
        summary = "No task yet";
      } else if (tasksFailed) {
        summary = `${countPhrase(ids.length, "task")}, names unavailable`;
      } else if (running > 0) {
        summary = `${countPhrase(ids.length, "task")}, ${running} running`;
      } else if (done === ids.length) {
        summary = `${countPhrase(ids.length, "task")}, all complete`;
      } else {
        summary = `${countPhrase(ids.length, "task")}, ${done} complete`;
      }
      map.set(step.id, { tasks: found, unknownIds, summary });
    }
    return map;
  }, [steps, taskIndex, tasksFailed]);

  const swimlaneSteps: SwimlaneStep[] = useMemo(
    () =>
      steps.map((step, index) => ({
        id: step.id,
        ordinal: step.sequence ?? index + 1,
        action: step.action || "No action recorded",
        actor: actorOf(step),
        status: step.status,
        taskSummary: workOf.get(step.id)?.summary ?? "No task yet",
      })),
    [steps, workOf],
  );

  const swimlaneBranches: SwimlaneBranch[] = useMemo(
    () =>
      branches
        .filter((branch) => stepById.has(branch.from_step_id))
        .map((branch) => ({
          id: branch.id,
          fromStepId: branch.from_step_id,
          toStepId:
            branch.to_step_id && stepById.has(branch.to_step_id)
              ? branch.to_step_id
              : null,
          kind: branchKind(branch.branch_type),
          kindLabel: branchLabel(branch),
          condition: branch.condition || "Condition not recorded",
        })),
    [branches, stepById],
  );

  const declaredWithoutSteps = useMemo(() => {
    const owned = new Set(steps.map(actorOf));
    return (workflow.actors_json ?? []).filter(
      (actor) => actor && !owned.has(actor),
    );
  }, [workflow.actors_json, steps]);

  const running = steps.filter((step) =>
    ["in_progress", "in_review", "verifying"].includes(step.status),
  );
  const complete = steps.filter((step) => step.status === "complete");
  const blocked = steps.filter((step) => step.status === "blocked");

  const selectedStep = selectedStepId ? stepById.get(selectedStepId) ?? null : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel
        title={workflow.name}
        description={
          workflow.purpose ??
          "No purpose has been written for this workflow yet, so what it is for has to be inferred from its steps."
        }
        actions={<Status value={workflow.status} />}
      >
        <Facts
          columns={2}
          items={[
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {workflow.id}
                </span>
              ),
            },
            {
              label: "Feature it belongs to",
              value: (
                <a
                  href={hrefFor("features", workflow.feature_id)}
                  className="font-chassis text-chassis text-signal underline-offset-2 hover:underline focus-ring"
                >
                  {workflow.feature_id}
                </a>
              ),
            },
            {
              label: "What starts it",
              value: <Value missing="No trigger recorded">{workflow.trigger}</Value>,
            },
            {
              label: "Actors",
              value: (
                <Value missing="No actor recorded">
                  {listPhrase(workflow.actors_json ?? [])}
                </Value>
              ),
            },
            {
              label: "Preconditions",
              value: <ValueList items={workflow.preconditions_json} />,
            },
            {
              label: "When it counts as finished",
              value: (
                <Value missing="No completion criteria recorded">
                  {workflow.completion_criteria}
                </Value>
              ),
            },
            {
              label: "How it is observed",
              value: (
                <Value missing="No observability recorded">
                  {workflow.observability}
                </Value>
              ),
            },
          ]}
        />
      </Panel>

      <Panel
        title="Live execution"
        description="The state of each step as the project database last committed it. This updates as work is claimed, blocked and completed."
      >
        {steps.length === 0 ? (
          <Empty
            density="inline"
            title="This workflow has no steps yet"
            explanation="Nothing can be running because no step has been recorded against this workflow. Steps are written when the feature this workflow belongs to is specified."
            actions={[
              {
                label: "Open the feature",
                href: hrefFor("features", workflow.feature_id),
              },
            ]}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-chassis text-chassis text-ink-2">
            <span>
              {complete.length} of {steps.length} {steps.length === 1 ? "step" : "steps"}{" "}
              complete
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Status value="in_progress" size="sm" label="Running" />
              {running.length === 0
                ? "No step is running"
                : `${countPhrase(running.length, "step")} running`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Status value="blocked" size="sm" />
              {blocked.length === 0
                ? "No step is blocked"
                : `${countPhrase(blocked.length, "step")} blocked`}
            </span>
            {tasksFailed ? (
              <span className="font-prose text-small text-state-attention">
                Task names could not be read, so each step shows how many tasks it
                has but not what they are called.
              </span>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel
        title="Swimlanes"
        description="One lane per actor, one column per step in order. Failure and retry paths are drawn in their own line style and labelled, so they never read as part of the happy path."
        bodyClassName="p-0"
        actions={
          selectedStepId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectStep(null)}
            >
              Clear the selected step
            </Button>
          ) : null
        }
      >
        {steps.length === 0 ? (
          <Empty
            density="inline"
            className="rounded-none border-0"
            title="There is nothing to draw"
            explanation="A swimlane needs at least one step. This workflow has none recorded, so the diagram would be an empty grid."
          />
        ) : (
          <>
            {narrow ? (
              <p className="border-b border-rule bg-panel-raised px-3 py-2 font-prose text-small text-ink-2">
                On a narrow screen the diagram scrolls sideways. The steps table
                below carries the same records and is easier to read here.
              </p>
            ) : null}
            <WorkflowSwimlane
              steps={swimlaneSteps}
              branches={swimlaneBranches}
              actors={workflow.actors_json ?? []}
              selectedStepId={selectedStepId}
              onSelectStep={onSelectStep}
              workflowName={workflow.name}
            />
            {declaredWithoutSteps.length > 0 ? (
              <p className="border-t border-rule px-3 py-2 font-prose text-small text-ink-2">
                Declared on this workflow but owning no step:{" "}
                {listPhrase(declaredWithoutSteps)}. They are given a lane so the
                gap is visible rather than silently dropped.
              </p>
            ) : null}
          </>
        )}
      </Panel>

      {selectedStep ? (
        <StepDetail
          step={selectedStep}
          work={workOf.get(selectedStep.id)}
          branches={branches.filter(
            (branch) =>
              branch.from_step_id === selectedStep.id ||
              branch.to_step_id === selectedStep.id,
          )}
          stepById={stepById}
          onClose={() => onSelectStep(null)}
        />
      ) : null}

      <StepsTable
        steps={steps}
        workOf={workOf}
        selectedStepId={selectedStepId}
        onSelectStep={onSelectStep}
        narrow={narrow}
      />

      <BranchesTable branches={branches} stepById={stepById} />

      <StateMachines
        machines={machines}
        states={states}
        transitions={transitions}
        featureId={workflow.feature_id}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Step detail
   --------------------------------------------------------------------------- */

function StepDetail({
  step,
  work,
  branches,
  stepById,
  onClose,
}: {
  step: WorkflowStep;
  work: { tasks: Task[]; unknownIds: string[] } | undefined;
  branches: WorkflowBranch[];
  stepById: Map<string, WorkflowStep>;
  onClose: () => void;
}) {
  return (
    <Panel
      title={`Step ${step.sequence}: ${step.action || "No action recorded"}`}
      description={`Owned by ${actorOf(step)}, recorded as ${titleCase(step.owner_type) || "an owner of an unrecorded kind"}.`}
      actions={
        <>
          <Status value={step.status} />
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          columns={2}
          items={[
            {
              label: "What goes in",
              value: (
                <Value missing="No input contract recorded">
                  {step.input_contract}
                </Value>
              ),
            },
            {
              label: "What should come out",
              value: (
                <Value missing="No expected result recorded">
                  {step.expected_result}
                </Value>
              ),
            },
            {
              label: "What happens on failure",
              value: (
                <Value missing="No failure behaviour recorded">
                  {step.failure_behavior}
                </Value>
              ),
            },
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {step.id}
                </span>
              ),
            },
          ]}
        />

        <div className="flex flex-col gap-2">
          <span className="font-chassis text-label text-ink-3 uppercase">
            Work implementing this step
          </span>
          {(work?.tasks.length ?? 0) === 0 && (work?.unknownIds.length ?? 0) === 0 ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              No task has been linked to this step yet, so nothing in the plan
              currently builds it. Create one from the Tasks view and link it to
              this workflow.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-rule rounded-sd border border-rule">
              {work?.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <a
                    href={hrefFor("tasks", task.id)}
                    className="min-w-0 focus-ring"
                  >
                    <RecordName name={task.name} id={task.id} size="sm" />
                  </a>
                  <Status value={task.status} size="sm" />
                </li>
              ))}
              {work?.unknownIds.map((id) => (
                <li key={id} className="px-3 py-2">
                  <a
                    href={hrefFor("tasks", id)}
                    className="font-chassis text-chassis-sm text-ink-2 hover:text-signal focus-ring"
                  >
                    {id}
                  </a>
                  <p className="font-prose text-small text-ink-3">
                    This task is linked to the step but was not in the task list
                    that was read, so its name and state are unknown here. The
                    Tasks view reads its own copy and can still open it.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {branches.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-chassis text-label text-ink-3 uppercase">
              Branches touching this step
            </span>
            <ul className="flex flex-col gap-1.5">
              {branches.map((branch) => (
                <li
                  key={branch.id}
                  className="flex flex-wrap items-center gap-2 font-prose text-small text-ink-2"
                >
                  <Tag>
                    {branchKind(branch.branch_type) === "retry" ? (
                      <Repeat aria-hidden="true" className="size-3" />
                    ) : (
                      <GitBranch aria-hidden="true" className="size-3" />
                    )}
                    {branchLabel(branch)}
                  </Tag>
                  <span>
                    {branch.from_step_id === step.id ? "Leaves for " : "Arrives from "}
                    {branch.from_step_id === step.id
                      ? branch.to_step_id
                        ? (stepById.get(branch.to_step_id)?.action ?? branch.to_step_id)
                        : "the end of the workflow"
                      : (stepById.get(branch.from_step_id)?.action ??
                        branch.from_step_id)}{" "}
                    when {branch.condition || "a condition that is not recorded"}.
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Steps, as records
   --------------------------------------------------------------------------- */

function StepsTable({
  steps,
  workOf,
  selectedStepId,
  onSelectStep,
  narrow,
}: {
  steps: WorkflowStep[];
  workOf: Map<string, { summary: string }>;
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  narrow: boolean;
}) {
  const select = (id: string) => onSelectStep(id === selectedStepId ? null : id);

  return (
    <Panel
      title="Steps"
      description="The same steps the diagram draws, in order. Choosing one here selects it in the diagram."
      bodyClassName="p-0"
    >
      {steps.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No steps recorded"
          explanation="This workflow has no ordered steps yet, so there is nothing to run and nothing to draw."
        />
      ) : narrow ? (
        <ul className="divide-y divide-rule">
          {steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => select(step.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-3 py-2 text-left focus-ring row-edge-focus",
                  step.id === selectedStepId && "bg-signal-wash",
                )}
              >
                <span className="font-chassis text-label text-ink-3 uppercase">
                  Step {step.sequence}
                </span>
                <span className="font-prose text-body text-ink">{step.action}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Status value={step.status} size="sm" />
                  <Tag>{actorOf(step)}</Tag>
                  <Tag>{workOf.get(step.id)?.summary ?? "No task yet"}</Tag>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Step</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Expected result</TableHead>
              <TableHead>On failure</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Work</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((step) => (
              <SelectableRow
                key={step.id}
                selected={step.id === selectedStepId}
                onSelect={() => select(step.id)}
                label={`Step ${step.sequence}, ${step.action}`}
              >
                <TableCell className="font-chassis text-ink-3">
                  {step.sequence}
                </TableCell>
                <TableCell className="font-prose text-ink">{step.action}</TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span>{actorOf(step)}</span>
                    <span className="text-ink-3">{titleCase(step.owner_type)}</span>
                  </span>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="Not recorded">{step.expected_result}</Value>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="Not recorded">{step.failure_behavior}</Value>
                </TableCell>
                <TableCell>
                  <Status value={step.status} size="sm" />
                </TableCell>
                <TableCell className="text-ink-2">
                  {workOf.get(step.id)?.summary ?? "No task yet"}
                </TableCell>
              </SelectableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/** A table row that behaves as a control, with the focus edge a row needs. */
function SelectableRow({
  selected,
  onSelect,
  label,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TableRow
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-pointer focus-ring row-edge-focus",
        selected && "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
      )}
    >
      {children}
    </TableRow>
  );
}

/* ---------------------------------------------------------------------------
   Branches
   --------------------------------------------------------------------------- */

function BranchesTable({
  branches,
  stepById,
}: {
  branches: WorkflowBranch[];
  stepById: Map<string, WorkflowStep>;
}) {
  const name = (id: string | null) => {
    if (!id) return "Ends the workflow";
    // A branch can leave for a step this workflow does not own. The address
    // resolves a step id to the workflow holding it, so it stays reachable.
    return (
      <a
        href={hrefFor("workflows", id)}
        className="rounded-sd hover:text-signal focus-ring"
      >
        {stepById.get(id)?.action ?? id}
      </a>
    );
  };

  return (
    <Panel
      title="Branches and failure paths"
      description="Every departure from the ordered sequence, what triggers it, and where it goes."
      bodyClassName="p-0"
    >
      {branches.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No branches recorded"
          explanation="This workflow runs straight through its steps with no recorded alternative, failure or retry path. If that is wrong, the workflow specification is where the branch belongs."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>From step</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Goes to</TableHead>
              <TableHead>Failure policy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => {
              const kind = branchKind(branch.branch_type);
              return (
                <TableRow key={branch.id}>
                  <TableCell>
                    <Tag>
                      {kind === "retry" ? (
                        <Repeat aria-hidden="true" className="size-3" />
                      ) : (
                        <GitBranch aria-hidden="true" className="size-3" />
                      )}
                      {branchLabel(branch)}
                    </Tag>
                  </TableCell>
                  <TableCell className="font-prose text-ink">
                    {name(branch.from_step_id)}
                  </TableCell>
                  <TableCell className="font-prose text-ink-2">
                    <Value missing="No condition recorded">{branch.condition}</Value>
                  </TableCell>
                  <TableCell className="font-prose text-ink">
                    {name(branch.to_step_id)}
                  </TableCell>
                  <TableCell className="font-prose text-ink-2">
                    <Value missing="No policy recorded">{branch.failure_policy}</Value>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   State machines
   --------------------------------------------------------------------------- */

function StateMachines({
  machines,
  states,
  transitions,
  featureId,
}: {
  machines: StateMachine[];
  states: WorkflowState[];
  transitions: StateTransition[];
  featureId: string;
}) {
  const stateById = useMemo(() => byId(states), [states]);

  return (
    <Panel
      title="State transitions"
      description="The state machines recorded against the same feature as this workflow: what each entity can be, and what moves it."
      bodyClassName="p-0"
    >
      {machines.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No state machine recorded for this feature"
          explanation="Nothing in this feature has been given named states and transitions yet. That is normal for a workflow whose records do not change state, and a gap for one whose records do."
          actions={[{ label: "Open the feature", href: hrefFor("features", featureId) }]}
        />
      ) : (
        <div className="flex flex-col divide-y divide-rule">
          {machines.map((machine) => {
            const machineStates = states.filter(
              (state) => state.state_machine_id === machine.id,
            );
            const machineTransitions = transitions.filter(
              (transition) => transition.state_machine_id === machine.id,
            );
            const initial = machineStates.find(
              (state) => state.id === machine.initial_state,
            );

            return (
              <div key={machine.id} className="flex flex-col gap-3 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <WorkflowIcon aria-hidden="true" className="size-4 text-ink-3" />
                  <RecordName name={machine.entity_name} id={machine.id} size="sm" />
                  <Status value={machine.status} size="sm" />
                  <Tag>
                    Starts as {initial?.name ?? machine.initial_state ?? "not recorded"}
                  </Tag>
                  <Tag>{countPhrase(machineStates.length, "state")}</Tag>
                </div>

                {machineTransitions.length === 0 ? (
                  <p className="font-prose text-small text-ink-2 prose-measure">
                    This machine has {countPhrase(machineStates.length, "state")} but
                    no recorded transition, so nothing yet describes how it moves
                    between them.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Guard</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Enforced at</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {machineTransitions.map((transition) => (
                        <TableRow key={transition.id}>
                          <TableCell className="font-prose text-ink">
                            {stateById.get(transition.from_state_id)?.name ??
                              transition.from_state_id}
                          </TableCell>
                          <TableCell>{transition.event}</TableCell>
                          <TableCell className="font-prose text-ink-2">
                            <Value missing="No guard">{transition.guard}</Value>
                          </TableCell>
                          <TableCell className="font-prose text-ink">
                            {stateById.get(transition.to_state_id)?.name ??
                              transition.to_state_id}
                          </TableCell>
                          <TableCell className="font-prose text-ink-2">
                            <Value missing="Not recorded">{transition.actor}</Value>
                          </TableCell>
                          <TableCell className="font-prose text-ink-2">
                            <Value missing="Not recorded">
                              {transition.enforcement_point}
                            </Value>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {machineStates.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {machineStates.map((state) => (
                      <li key={state.id}>
                        <Tag title={state.meaning ?? undefined}>
                          {state.name}
                          {state.terminal ? " (final)" : ""}
                        </Tag>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
