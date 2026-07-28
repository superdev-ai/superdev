/**
 * Everything recorded about one task, in the order a person asks about it: why
 * it exists, what finishing it produces, what part of the product contract it
 * implements, how it will be proved, what it waits on, who holds it, and the
 * full trail of what has happened to it.
 *
 * Anything the project has not recorded says so in plain language, and says
 * what would fill it. A blank line here would be a defect.
 */

import {
  CalendarClock,
  ExternalLink,
  FileCheck2,
  GitBranch,
  Link2,
  ListTree,
  Timer,
  UserRound,
} from "lucide-react";
import type * as React from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { Button } from "@/components/ui/button";
import { ProgressMeter } from "@/components/ui/progress";
import { RecordLink } from "@/components/product/panel";
import { Empty, ErrorState, Loading } from "@/components/shell/states";
import { Status, statusLabel } from "@/components/shell/status";
import { absoluteTime, countPhrase, relativeTime, titleCase } from "@/lib/format";
import { hrefFor } from "@/lib/route";
import type { ActivityEvent } from "@/types";
import { cn } from "@/lib/utils";

import {
  RefusalNotice,
  TaskActionBar,
  type TaskActionId,
  type TaskMutation,
} from "@/components/tasks/actions";
import {
  DEPENDENCY_LABELS,
  contractTargetLabel,
  featureNameOf,
  holderOf,
  isOpenStatus,
  priorityLabel,
  relationshipLabel,
  type EvidenceRow,
  type TaskIndex,
  type TaskRow,
} from "@/components/tasks/model";

export type HistoryState = "loading" | "ready" | "error";

export interface TaskDetailProps {
  /** The id the address bar points at, even when no such task exists. */
  taskId: string | null;
  task: TaskRow | null;
  index: TaskIndex;
  mutation: TaskMutation;
  onClose: () => void;
  onAction: (id: TaskActionId) => void;
  onOpenTask: (id: string) => void;
  onRefresh: () => void;
  history: ActivityEvent[];
  historyState: HistoryState;
  historyError: Error | null;
  onRetryHistory: () => void;
}

export function TaskDetail(props: TaskDetailProps) {
  const { taskId, task, onClose } = props;

  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="sm:max-w-xl">
        {task ? (
          <TaskDetailContent {...props} task={task} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>That task is not in this project</SheetTitle>
              <SheetDescription>
                The address bar points at {taskId}, and no task with that
                identifier came back from the local service. It may have been
                cancelled and removed, or the link may have come from a
                different project.
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <Empty
                title="Nothing to show for this identifier"
                explanation="Close this panel to go back to the full list of tasks, or refresh in case the project database has moved on since this page was read."
                actions={[
                  { label: "Back to the task list", onClick: onClose },
                  {
                    label: "Refresh the tasks",
                    onClick: props.onRefresh,
                    variant: "outline",
                  },
                ]}
              />
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------------
   Layout helpers, local to the panel
   --------------------------------------------------------------------------- */

function Section({
  title,
  icon: Icon,
  children,
  aside,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-rule pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-chassis text-label text-ink-3 uppercase">
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * A recorded value, or a plain sentence saying it was never recorded and what
 * would put it there. Never an empty line.
 */
function Prose({
  value,
  absent,
}: {
  value: string | null | undefined;
  absent: string;
}) {
  // Markdown rather than whitespace-pre-line: task descriptions and outcomes
  // carry backticked identifiers and lists, and preserving newlines showed the
  // source instead of rendering it.
  if (value && value.trim()) return <Markdown>{value}</Markdown>;
  return (
    <p className="font-prose text-small text-ink-3 prose-measure">{absent}</p>
  );
}

function Reading({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-chassis text-label text-ink-3 uppercase">
        {label}
      </span>
      <span className="font-chassis text-chassis-sm text-ink-2">
        {children}
      </span>
    </div>
  );
}

/**
 * One blocker, dependent task or subtask. An anchor rather than a button: the
 * hash it points at is the same address the panel opens on, so the row can be
 * opened in a new tab, copied, and read as a link.
 */
function TaskLink({
  id,
  index,
  prefix,
}: {
  id: string;
  index: TaskIndex;
  prefix?: string;
}) {
  const other = index.byId.get(id);
  return (
    <a
      href={hrefFor("tasks", id)}
      className="flex w-full items-center gap-2 rounded-sd border border-rule bg-panel px-2 py-1.5 text-left transition-colors duration-[120ms] ease-sd focus-ring hover:bg-inset"
    >
      {other ? <Status value={other.status} size="sm" /> : null}
      <span className="min-w-0 flex-1 truncate font-prose text-small text-ink">
        {prefix ? <span className="text-ink-3">{prefix} </span> : null}
        {other ? other.name : "This task is not in the current list"}
      </span>
      <span className="shrink-0 font-chassis text-chassis-sm text-ink-3">
        {id}
      </span>
    </a>
  );
}

/* ---------------------------------------------------------------------------
   The panel itself
   --------------------------------------------------------------------------- */

function TaskDetailContent({
  task,
  index,
  mutation,
  onAction,
  onOpenTask,
  onRefresh,
  onClose,
  history,
  historyState,
  historyError,
  onRetryHistory,
}: TaskDetailProps & { task: TaskRow }) {
  const holder = holderOf(task, index);
  const feature = featureNameOf(task, index);
  const links = index.linksByTask.get(task.id) ?? [];
  const dependsOn = index.dependsOn.get(task.id) ?? [];
  const requiredBy = index.requiredBy.get(task.id) ?? [];
  const subtasks = index.childrenOf.get(task.id) ?? [];
  const evidence = (index.evidenceByTask.get(task.id) ?? []) as EvidenceRow[];
  const assignments = index.assignmentsByTask.get(task.id) ?? [];
  const criteria = task.completion_criteria_json ?? [];
  const verification = task.verification_requirements_json ?? [];
  const parent = task.parent_task_id
    ? index.byId.get(task.parent_task_id)
    : null;
  const taskHistory = history.filter(
    (event) => event.task_id === task.id || event.summary.includes(task.id),
  );

  return (
    <>
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Status value={task.status} />
          <Badge variant="outline">{priorityLabel(task.priority)}</Badge>
          {task.categoryName ? (
            <Badge variant="outline">{task.categoryName}</Badge>
          ) : null}
          {task.enabling ? (
            <Badge variant="signal">Enabling work</Badge>
          ) : null}
        </div>
        <SheetTitle>{task.name}</SheetTitle>
        <SheetDescription>
          <span
            className={cn(
              "font-chassis text-chassis-sm text-ink-3",
              task.status === "superseded" && "line-through",
            )}
          >
            {task.id}
          </span>
          {parent ? (
            <>
              {" "}
              is a subtask of{" "}
              <RecordLink
                name={parent.name}
                id={parent.id}
                href={hrefFor("tasks", parent.id)}
              />
            </>
          ) : null}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="flex flex-col gap-4">
        {mutation.refusal ? (
          <RefusalNotice
            refusal={mutation.refusal}
            task={task}
            index={index}
            onOpenTask={onOpenTask}
            onAction={onAction}
            onRefresh={onRefresh}
            onDismiss={mutation.clear}
          />
        ) : null}

        {mutation.confirmed ? (
          <p
            role="status"
            className="rounded-sd border border-state-complete/45 bg-state-complete-wash px-2 py-1.5 font-prose text-small text-ink"
          >
            Done: {mutation.confirmed}. The panel below is the reading after that
            change.
          </p>
        ) : null}

        {task.status === "blocked" ? (
          <div className="rounded-sd-lg border border-state-blocked/45 bg-state-blocked-wash p-3">
            <h3 className="font-chassis text-label text-state-blocked uppercase">
              Why it is blocked
            </h3>
            <Prose
              value={task.block_reason}
              absent="No reason was recorded when this task was blocked, which means the next person has nothing to work from. Reopen the block through the Block control to record one."
            />
          </div>
        ) : null}

        <TaskActionBar
          task={task}
          onAction={onAction}
          pending={mutation.pending}
        />

        <Section title="Why it exists">
          <Prose
            value={task.why_needed}
            absent="Nobody has recorded why this work is needed. Use Edit to say what would go wrong if it were never done."
          />
        </Section>

        <Section title="Expected outcome">
          <Prose
            value={task.expected_outcome}
            absent="No outcome has been recorded, so there is nothing to check this against when it is finished. Use Edit to state what will be observably true."
          />
        </Section>

        {task.description ? (
          <Section title="Description">
            <Prose value={task.description} absent="" />
          </Section>
        ) : null}

        <Section title="Progress">
          <ProgressMeter
            progress={task.progress}
            qualifier="met"
            subject={`Task ${task.id}`}
          />
        </Section>

        <Section
          title="What it implements"
          icon={Link2}
          aside={
            <Button size="sm" variant="ghost" onClick={() => onAction("link")}>
              Link a contract
            </Button>
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-chassis text-chassis-sm text-ink-3">
                Feature
              </span>
              {task.feature_id ? (
                <a
                  href={hrefFor("features", task.feature_id)}
                  className="inline-flex items-center gap-1.5 rounded-sd-sm font-prose text-small text-signal underline underline-offset-4 focus-ring hover:no-underline"
                >
                  {feature ?? task.feature_id}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="font-prose text-small text-ink-3">
                  No feature recorded, which should not happen: every task
                  belongs to exactly one feature.
                </span>
              )}
            </div>

            {task.enabling ? (
              <div className="rounded-sd border border-signal-edge bg-signal-wash p-2">
                <p className="font-prose text-small text-ink prose-measure">
                  This is enabling work. It unblocks{" "}
                  {task.enabled_feature_id ? (
                    <a
                      href={hrefFor("features", task.enabled_feature_id)}
                      className="rounded-sd-sm text-signal underline underline-offset-4 focus-ring hover:no-underline"
                    >
                      {index.featureNames.get(task.enabled_feature_id) ??
                        task.enabled_feature_id}
                    </a>
                  ) : (
                    "a feature that has not been named"
                  )}
                  .
                </p>
                <Prose
                  value={task.enabling_rationale}
                  absent="No rationale was recorded, and the service refuses to move enabling work without one. Use Edit to say why that feature is blocked without this."
                />
              </div>
            ) : null}

            {links.length === 0 ? (
              <Empty
                density="inline"
                title="This task implements nothing yet"
                explanation="A task cannot leave Draft until it points at one part of the product contract: a workflow step, UI action, API operation, data entity, migration, integration, job, webhook, requirement, document or decision."
                actions={[
                  { label: "Link a contract", onClick: () => onAction("link") },
                ]}
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {links.map((link) => (
                  <li
                    key={`${link.target_type}-${link.target_id}-${link.relationship}`}
                    className="flex items-center gap-2 rounded-sd border border-rule bg-panel px-2 py-1.5"
                  >
                    <span className="font-chassis text-chassis-sm text-ink-2">
                      {relationshipLabel(link.relationship)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-prose text-small text-ink">
                      {contractTargetLabel(link.target_type)}
                    </span>
                    {/* Only data entities have a detail view addressed by their
                        own id. Workflow steps are held in the Workflows view's
                        own state, and requirements, surfaces and acceptance
                        criteria are only ever rendered inside a feature. */}
                    {link.target_type === "data_entity" ? (
                      <a
                        href={hrefFor("data", link.target_id)}
                        className="shrink-0 rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-4 focus-ring hover:no-underline"
                      >
                        {link.target_id}
                      </a>
                    ) : (
                      <span className="shrink-0 font-chassis text-chassis-sm text-ink-3">
                        {link.target_id}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section title="Completion criteria" icon={FileCheck2}>
          {criteria.length === 0 ? (
            <p className="font-prose text-small text-ink-3 prose-measure">
              No completion criteria are recorded, so progress on this task is
              not measurable and nobody can settle whether it is done. Use Edit
              to list what has to be true.
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {criteria.map((criterion, position) => (
                <li
                  key={`${position}-${criterion}`}
                  className="font-prose text-body text-ink-2 prose-measure"
                >
                  {criterion}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Verification requirements">
          {verification.length === 0 ? (
            <p className="font-prose text-small text-ink-3 prose-measure">
              Nothing has to be run to prove this task. If it should be proved,
              use Edit to say how, and the service will hold completion until
              passing evidence exists.
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {verification.map((requirement, position) => (
                <li
                  key={`${position}-${requirement}`}
                  className="font-prose text-body text-ink-2 prose-measure"
                >
                  {requirement}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Dependencies" icon={Timer}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-chassis text-chassis-sm text-ink-3">
                This task is waiting on
              </span>
              {dependsOn.length === 0 ? (
                <p className="font-prose text-small text-ink-3">
                  Nothing. No other task has to finish before this one can start.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {dependsOn.map((dependency) => (
                    <li key={dependency.depends_on_task_id}>
                      <TaskLink
                        id={dependency.depends_on_task_id}
                        index={index}
                        prefix={
                          DEPENDENCY_LABELS[dependency.dependency_type] ??
                          titleCase(dependency.dependency_type)
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-chassis text-chassis-sm text-ink-3">
                Waiting on this task
              </span>
              {requiredBy.length === 0 ? (
                <p className="font-prose text-small text-ink-3">
                  Nothing. Finishing this does not release other work.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {requiredBy.map((dependency) => (
                    <li key={dependency.task_id}>
                      <TaskLink id={dependency.task_id} index={index} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Subtasks"
          icon={ListTree}
          aside={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction("subtask")}
            >
              Add subtask
            </Button>
          }
        >
          {subtasks.length === 0 ? (
            <p className="font-prose text-small text-ink-3 prose-measure">
              This task has no subtasks. Add one when the work splits into
              pieces that can be finished separately.
            </p>
          ) : (
            <>
              <p className="font-chassis text-chassis-sm text-ink-2">
                {countPhrase(
                  subtasks.filter((child) => isOpenStatus(child.status)).length,
                  "subtask",
                )}{" "}
                still open, out of {countPhrase(subtasks.length, "subtask")}. A
                parent cannot complete while any of them is open.
              </p>
              <ul className="flex flex-col gap-1">
                {subtasks.map((child) => (
                  <li key={child.id}>
                    <TaskLink id={child.id} index={index} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title="Evidence" icon={FileCheck2}>
          {evidence.length === 0 ? (
            <p className="font-prose text-small text-ink-3 prose-measure">
              No verification evidence has been recorded against this task.
              Evidence is written by whatever actually runs the check, not typed
              in here, so run the verification and it will appear.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {evidence.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-col gap-1 rounded-sd border border-rule bg-panel p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Status
                      value={record.result ?? record.status}
                      size="sm"
                      label={
                        record.result
                          ? record.result === "pass"
                            ? "Passed"
                            : record.result === "fail"
                              ? "Failed"
                              : titleCase(record.result)
                          : undefined
                      }
                      tone={
                        record.result === "pass"
                          ? "complete"
                          : record.result === "fail"
                            ? "blocked"
                            : undefined
                      }
                    />
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {titleCase(record.evidence_type)}
                    </span>
                    {record.stale_at ? (
                      <Badge variant="outline" className="text-state-attention">
                        Stale since {relativeTime(record.stale_at).toLowerCase()}
                      </Badge>
                    ) : null}
                  </div>
                  <Markdown>{record.summary}</Markdown>
                  <span
                    className="font-chassis text-chassis-sm text-ink-3"
                    title={absoluteTime(record.recorded_at)}
                  >
                    Recorded {relativeTime(record.recorded_at).toLowerCase()}
                    {record.recorded_by ? ` by ${record.recorded_by}` : ""}
                    {record.reference ? `, reference ${record.reference}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Who holds it" icon={UserRound}>
          <div className="flex flex-col gap-2">
            <p className="font-prose text-body text-ink-2">
              {holder.assignment
                ? `Claimed by ${holder.label}.`
                : "Not claimed by anyone. Claim it to record who is working on it."}
            </p>
            {holder.assignment ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {/* Each of these opens the Team view highlighting that
                    developer, agent or branch everywhere it appears. */}
                <Reading label="Developer">
                  {holder.developer ? (
                    <a
                      href={hrefFor("team", holder.developer.id)}
                      className="rounded-sd-sm text-signal underline underline-offset-4 focus-ring hover:no-underline"
                    >
                      {holder.developer.display_name}
                    </a>
                  ) : (
                    "Not recorded"
                  )}
                </Reading>
                <Reading label="Agent">
                  {holder.agent ? (
                    <a
                      href={hrefFor("team", holder.agent.id)}
                      className="rounded-sd-sm text-signal underline underline-offset-4 focus-ring hover:no-underline"
                    >
                      {titleCase(holder.agent.harness)}
                      {holder.agent.model_label
                        ? ` (${holder.agent.model_label})`
                        : ""}
                    </a>
                  ) : (
                    "Not recorded"
                  )}
                </Reading>
                <Reading label="Branch">
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="size-3.5" aria-hidden="true" />
                    {holder.branch ? (
                      <a
                        href={hrefFor("team", holder.branch.id)}
                        className="rounded-sd-sm text-signal underline underline-offset-4 focus-ring hover:no-underline"
                      >
                        {holder.branch.name}
                      </a>
                    ) : (
                      "Not recorded"
                    )}
                  </span>
                </Reading>
                <Reading label="Claimed">
                  <span title={absoluteTime(holder.assignment.assigned_at)}>
                    {relativeTime(holder.assignment.assigned_at)}
                  </span>
                </Reading>
              </div>
            ) : null}

            {assignments.length > 1 ? (
              <details>
                <summary className="cursor-pointer rounded-sd font-chassis text-chassis-sm text-ink-3 focus-ring hover:text-ink-2">
                  Earlier claims, {countPhrase(assignments.length - 1, "record")}
                </summary>
                <ul className="flex flex-col gap-1 pt-1.5">
                  {assignments
                    .filter((entry) => !entry.active)
                    .map((entry) => (
                      <li
                        key={entry.id}
                        className="font-chassis text-chassis-sm text-ink-3"
                        title={absoluteTime(entry.assigned_at)}
                      >
                        {entry.developer_id
                          ? (index.developerById.get(entry.developer_id)
                              ?.display_name ?? entry.developer_id)
                          : "Unnamed session"}
                        , claimed {relativeTime(entry.assigned_at).toLowerCase()}
                        {entry.released_at
                          ? `, released ${relativeTime(entry.released_at).toLowerCase()}`
                          : ""}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </div>
        </Section>

        <Section title="Recorded times" icon={CalendarClock}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Reading label="Started">
              <TimeReading value={task.started_at} absent="Not started yet" />
            </Reading>
            <Reading label="Completed">
              <TimeReading
                value={task.completed_at}
                absent="Not completed yet"
              />
            </Reading>
            <Reading label="Cancelled">
              <TimeReading
                value={task.cancelled_at}
                absent="Not cancelled"
              />
            </Reading>
            <Reading label="Due">
              <TimeReading value={task.due_at} absent="No due date set" />
            </Reading>
            <Reading label="Estimate">
              {task.estimate ?? "No estimate recorded"}
            </Reading>
            <Reading label="Risk">
              {task.risk ?? "No risk recorded"}
            </Reading>
          </div>
        </Section>

        <Section
          title="What has happened to it"
          aside={
            <a
              href={hrefFor("activity")}
              className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-4 focus-ring hover:no-underline"
            >
              Open the full timeline
            </a>
          }
        >
          {historyState === "loading" ? (
            <Loading
              density="inline"
              rows={3}
              title="Reading the change history"
              explanation="Fetching the recent activity events that mention this task from the local service."
            />
          ) : historyState === "error" ? (
            <ErrorState
              density="inline"
              title="The history did not load"
              error={historyError}
              onRetry={onRetryHistory}
            />
          ) : taskHistory.length === 0 ? (
            <Empty
              density="inline"
              title="No recorded events for this task"
              explanation="Nothing about this task appears in the most recent activity the service returned. Older events are still on record: open the full timeline and search for the identifier."
              details={<span>Searched the latest activity for {task.id}.</span>}
              actions={[
                {
                  label: "Open the full timeline",
                  href: hrefFor("activity"),
                },
              ]}
            />
          ) : (
            <ol className="flex flex-col gap-1.5">
              {taskHistory.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-0.5 border-l-2 border-rule pl-2.5"
                >
                  <span className="font-chassis text-chassis-sm text-ink-2">
                    {titleCase(event.event_type)}
                  </span>
                  <Markdown measure={false}>{event.summary}</Markdown>
                  <span
                    className="font-chassis text-chassis-sm text-ink-3"
                    title={absoluteTime(event.created_at)}
                  >
                    {relativeTime(event.created_at)}
                    {event.actorName ? ` by ${event.actorName}` : ""}, change{" "}
                    {event.sequence}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Where this task stands">
          <p className="font-prose text-small text-ink-3 prose-measure">
            {task.id} is {statusLabel(task.status)}.{" "}
            {isOpenStatus(task.status)
              ? "It is open work, so it still counts towards what remains."
              : "It is closed, so it no longer counts towards what remains."}{" "}
            Version {task.version} in the project database.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Back to the list
            </Button>
            <Button size="sm" variant="ghost" onClick={onRefresh}>
              Refresh this reading
            </Button>
          </div>
        </Section>
      </SheetBody>
    </>
  );
}

function TimeReading({
  value,
  absent,
}: {
  value: string | null | undefined;
  absent: string;
}) {
  if (!value) return <span className="text-ink-3">{absent}</span>;
  return <span title={absoluteTime(value)}>{relativeTime(value)}</span>;
}
