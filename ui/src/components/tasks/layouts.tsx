/**
 * The three ways of looking at the same tasks: a dense sortable list, a board
 * of status columns, and the parent-and-subtask hierarchy.
 *
 * All three render the same records in the same order the keyboard walks, so
 * moving the selection with the arrow keys always matches what the eye follows.
 */

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Link2Off,
  ListTree,
  Timer,
} from "lucide-react";
import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/shell/status";
import { absoluteTime, countPhrase, relativeTime } from "@/lib/format";
import { hrefFor } from "@/lib/route";
import { cn } from "@/lib/utils";

import {
  SORT_LABELS,
  featureNameOf,
  holderOf,
  isOpenStatus,
  priorityLabel,
  type BoardColumn,
  type HierarchyRow,
  type Holder,
  type SortDirection,
  type SortKey,
  type TaskIndex,
  type TaskRow,
  type TaskViewModel,
} from "@/components/tasks/model";

/**
 * ponytail: rendering is skipped for rows outside the viewport by the browser
 * rather than by a windowing library, which keeps the whole list in the DOM for
 * the keyboard, for find-in-page and for assistive technology. Ceiling is a
 * browser without content-visibility, where every row simply paints as normal.
 */
const OFFSCREEN_SKIP: React.CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 28px",
};

export interface LayoutHandlers {
  model: TaskViewModel;
  /** The task the keyboard is on. */
  activeId: string | null;
  /** The task whose panel is open. */
  openId: string | null;
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
  /** Attached to whichever row is active, so the view can move focus to it. */
  activeRef: React.RefObject<HTMLDivElement | null>;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
}

/* ---------------------------------------------------------------------------
   Shared pieces
   --------------------------------------------------------------------------- */

/** The diagonal hatch that carries "blocked" without relying on colour. */
function BlockedHatch() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-state-blocked opacity-[0.08]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px)",
      }}
    />
  );
}

/**
 * The identifier is the row's own address. The row click already opens the
 * task, so the anchor is here for the things a click handler cannot do: open in
 * a new tab, copy the link, and read as a link rather than as a plain cell.
 */
function TaskIdentifier({ task }: { task: TaskRow }) {
  return (
    <a
      href={hrefFor("tasks", task.id)}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "shrink-0 rounded-sd-sm font-chassis text-chassis-sm text-ink-3 underline-offset-4 focus-ring hover:text-signal hover:underline",
        task.status === "superseded" && "line-through",
      )}
    >
      {task.id}
    </a>
  );
}

/** The feature the task belongs to, opened in the Features view. */
function FeatureReading({
  task,
  index,
  className,
}: {
  task: TaskRow;
  index: TaskIndex;
  className?: string;
}) {
  const name = featureNameOf(task, index);
  if (!task.feature_id || !name) {
    // Absent readings are quieter than recorded ones everywhere else here.
    return (
      <span className={cn(className, "text-ink-3")}>No feature recorded</span>
    );
  }
  return (
    <a
      href={hrefFor("features", task.feature_id)}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "rounded-sd-sm underline-offset-4 focus-ring hover:text-signal hover:underline",
        className,
      )}
    >
      {name}
    </a>
  );
}

/**
 * Who holds the task, opened in the Team view. The label keeps naming both the
 * person and the agent; the link goes to whichever record is recorded, the
 * person first because that is who someone asks.
 */
function HolderReading({
  holder,
  className,
}: {
  holder: Holder;
  className?: string;
}) {
  const actor = holder.developer ?? holder.agent;
  if (!actor) {
    return <span className={className}>{holder.label}</span>;
  }
  return (
    <a
      href={hrefFor("team", actor.id)}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "rounded-sd-sm underline-offset-4 focus-ring hover:text-signal hover:underline",
        className,
      )}
    >
      {holder.label}
    </a>
  );
}

/**
 * The few readings dense enough to belong on a row. Everything else waits in
 * the detail panel rather than crowding the line.
 */
function TaskMarkers({
  task,
  index,
  className,
}: {
  task: TaskRow;
  index: TaskIndex;
  className?: string;
}) {
  const subtasks = index.childrenOf.get(task.id) ?? [];
  const openSubtasks = subtasks.filter((child) => isOpenStatus(child.status));
  const waitingOn = (index.dependsOn.get(task.id) ?? []).filter((dependency) => {
    const other = index.byId.get(dependency.depends_on_task_id);
    return other ? isOpenStatus(other.status) : false;
  });
  const noContract =
    (task.contractLinkCount ?? (index.linksByTask.get(task.id) ?? []).length) ===
      0 && !task.enabling;

  if (!subtasks.length && !waitingOn.length && !noContract) return null;

  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {subtasks.length > 0 ? (
        <Badge
          variant="outline"
          title={`${countPhrase(subtasks.length, "subtask")}, ${countPhrase(openSubtasks.length, "still open")}`}
        >
          <ListTree aria-hidden="true" />
          {openSubtasks.length} of {subtasks.length}
          <span className="sr-only">subtasks still open</span>
        </Badge>
      ) : null}
      {waitingOn.length > 0 ? (
        <Badge
          variant="outline"
          className="text-state-attention"
          title={`Waiting on ${waitingOn
            .map((dependency) => dependency.depends_on_task_id)
            .join(", ")}`}
        >
          <Timer aria-hidden="true" />
          {waitingOn.length}
          <span className="sr-only">
            waiting on {countPhrase(waitingOn.length, "task")}
          </span>
        </Badge>
      ) : null}
      {noContract ? (
        <Badge
          variant="outline"
          className="text-state-attention"
          title="This task does not say what it implements, so it cannot leave Draft until it is linked to part of the product contract."
        >
          <Link2Off aria-hidden="true" />
          No contract linked
        </Badge>
      ) : null}
    </span>
  );
}

function DueReading({ task }: { task: TaskRow }) {
  if (!task.due_at) {
    return <span className="text-ink-3">No due date</span>;
  }
  const overdue =
    isOpenStatus(task.status) && new Date(task.due_at).getTime() < Date.now();
  return (
    <span
      title={absoluteTime(task.due_at)}
      className={cn(overdue && "text-state-attention")}
    >
      {overdue ? "Overdue, due " : "Due "}
      {relativeTime(task.due_at).toLowerCase()}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   List
   --------------------------------------------------------------------------- */

// The task name is what a person scans, so it gets a real minimum rather than
// whatever the fixed columns leave over. Sharing its cell with the id and the
// marker badges was truncating almost every name to a few words.
const LIST_GRID =
  "md:grid md:grid-cols-[8.5rem_minmax(18rem,2.4fr)_6rem] lg:grid-cols-[8.5rem_minmax(18rem,2.4fr)_10rem_6rem] xl:grid-cols-[8.5rem_minmax(18rem,2.4fr)_10rem_6rem_9rem_5rem_8rem]";

interface ColumnSpec {
  label: string;
  /** Absent where the reading cannot be ordered, so no sort control is drawn. */
  key?: SortKey;
  /**
   * Breakpoint classes. Every column shows on a phone, where the row is a
   * stacked list of labelled readings rather than a grid, and columns drop out
   * again between there and a wide desktop.
   */
  hide?: string;
  numeric?: boolean;
}

const LIST_COLUMNS: ColumnSpec[] = [
  { key: "status", label: "Status" },
  { key: "name", label: "Task" },
  { key: "feature", label: "Feature", hide: "md:hidden lg:flex" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Claimed by", hide: "md:hidden xl:flex" },
  { label: "Evidence", hide: "md:hidden xl:flex", numeric: true },
  { key: "due", label: "Due", hide: "md:hidden xl:flex" },
];

/** The column name repeated beside a reading while the row is stacked. */
function CellLabel({ children }: { children: string }) {
  return (
    <span className="shrink-0 font-chassis text-label text-ink-3 uppercase md:hidden">
      {children}
    </span>
  );
}

export function TaskList({
  model,
  activeId,
  openId,
  onActivate,
  onOpen,
  activeRef,
  onKeyDown,
  sort,
  direction,
  onSortChange,
}: LayoutHandlers & {
  sort: SortKey;
  direction: SortDirection;
  onSortChange: (sort: SortKey, direction: SortDirection) => void;
}) {
  const { visible, index } = model;

  return (
    <div
      role="grid"
      aria-label="Tasks"
      aria-rowcount={visible.length + 1}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="overflow-x-auto rounded-sd-lg border border-rule bg-panel"
    >
      <div
        role="row"
        className={cn(
          "sticky top-0 z-10 hidden border-b border-rule-strong bg-panel-raised",
          LIST_GRID,
        )}
      >
        {LIST_COLUMNS.map((column) => {
          const key = column.key;
          const sorted = key !== undefined && sort === key;
          return (
            <div
              key={column.label}
              role="columnheader"
              aria-sort={
                key === undefined
                  ? undefined
                  : sorted
                    ? direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
              }
              className={cn(
                "flex h-7 items-center px-3",
                column.numeric && "justify-end",
                column.hide,
              )}
            >
              {key === undefined ? (
                <span className="font-chassis text-label text-ink-3 uppercase">
                  {column.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onSortChange(
                      key,
                      sorted && direction === "asc" ? "desc" : "asc",
                    )
                  }
                  title={`Sort by ${SORT_LABELS[key]}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sd-sm font-chassis text-label uppercase focus-ring",
                    sorted ? "text-signal" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {column.label}
                  {sorted ? (
                    // Lucide, like every other icon here. The bare arrow
                    // characters were the only non-ASCII left in the source and
                    // the only glyphs not drawn from the icon set.
                    direction === "asc" ? (
                      <ArrowUp aria-hidden="true" className="size-3" />
                    ) : (
                      <ArrowDown aria-hidden="true" className="size-3" />
                    )
                  ) : null}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {visible.map((task, position) => {
        const active = task.id === activeId;
        const holder = holderOf(task, index);
        const evidence = index.evidenceByTask.get(task.id) ?? [];

        return (
          <div
            key={task.id}
            role="row"
            aria-rowindex={position + 2}
            aria-selected={task.id === openId}
            data-selected={task.id === openId ? "true" : undefined}
            tabIndex={active ? 0 : -1}
            ref={active ? activeRef : undefined}
            onClick={() => {
              onActivate(task.id);
              onOpen(task.id);
            }}
            onFocus={() => onActivate(task.id)}
            style={OFFSCREEN_SKIP}
            className={cn(
              "relative cursor-pointer border-b border-rule px-3 py-2 transition-colors duration-[120ms] ease-sd last:border-b-0",
              "flex flex-col gap-1 md:h-7 md:gap-0 md:px-0 md:py-0",
              LIST_GRID,
              "hover:bg-inset focus-visible:outline-none",
              task.id === openId &&
                "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
              active &&
                task.id !== openId &&
                "bg-inset shadow-[inset_2px_0_0_var(--sd-signal)]",
            )}
          >
            <div
              role="gridcell"
              className="relative flex items-center overflow-hidden md:px-3"
            >
              {task.status === "blocked" ? <BlockedHatch /> : null}
              <Status value={task.status} size="sm" />
            </div>

            <div
              role="gridcell"
              className="flex min-w-0 items-center gap-2 md:px-3"
            >
              <span className="min-w-0 flex-1 truncate font-prose text-body text-ink md:text-small">
                {task.name}
              </span>
              <TaskIdentifier task={task} />
              <TaskMarkers task={task} index={index} className="hidden sm:flex" />
            </div>

            <div
              role="gridcell"
              className="flex items-center gap-2 md:hidden lg:flex lg:px-3"
            >
              <CellLabel>Feature</CellLabel>
              <FeatureReading
                task={task}
                index={index}
                className="truncate font-prose text-small text-ink-2"
              />
            </div>

            <div
              role="gridcell"
              className="flex items-center gap-2 md:px-3"
            >
              <CellLabel>Priority</CellLabel>
              <span
                className={cn(
                  "font-chassis text-chassis-sm",
                  task.priority ? "text-ink-2" : "text-ink-3",
                )}
              >
                {priorityLabel(task.priority)}
              </span>
            </div>

            <div
              role="gridcell"
              className="flex items-center gap-2 md:hidden xl:flex xl:px-3"
            >
              <CellLabel>Claimed by</CellLabel>
              <HolderReading
                holder={holder}
                className={cn(
                  "truncate font-prose text-small",
                  holder.assignment ? "text-ink-2" : "text-ink-3",
                )}
              />
            </div>

            <div
              role="gridcell"
              className="flex items-center gap-2 md:hidden xl:flex xl:justify-end xl:px-3"
            >
              <CellLabel>Evidence</CellLabel>
              <span
                className="font-chassis text-chassis-sm text-ink-2"
                title={`${countPhrase(evidence.length, "piece")} of verification evidence recorded`}
              >
                {evidence.length}
                <span className="sr-only">
                  {" "}
                  pieces of verification evidence
                </span>
              </span>
            </div>

            <div
              role="gridcell"
              className="flex items-center gap-2 md:hidden xl:flex xl:px-3"
            >
              <CellLabel>Due</CellLabel>
              <span className="truncate font-chassis text-chassis-sm text-ink-2">
                <DueReading task={task} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Board
   --------------------------------------------------------------------------- */

export function TaskBoard({
  model,
  activeId,
  openId,
  onActivate,
  onOpen,
  activeRef,
  onKeyDown,
}: LayoutHandlers) {
  const { columns, index } = model;

  return (
    <div
      role="grid"
      aria-label="Tasks by status"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex gap-3 overflow-x-auto pb-2"
    >
      {columns.map((column) => (
        <BoardColumnPanel
          key={column.status}
          column={column}
          index={index}
          activeId={activeId}
          openId={openId}
          onActivate={onActivate}
          onOpen={onOpen}
          activeRef={activeRef}
        />
      ))}
    </div>
  );
}

function BoardColumnPanel({
  column,
  index,
  activeId,
  openId,
  onActivate,
  onOpen,
  activeRef,
}: {
  column: BoardColumn;
  index: TaskIndex;
  activeId: string | null;
  openId: string | null;
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
  activeRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      role="rowgroup"
      aria-label={`${column.label}, ${countPhrase(column.tasks.length, "task")}`}
      className="flex w-72 shrink-0 flex-col rounded-sd-lg border border-rule bg-panel"
    >
      <div
        role="row"
        className="flex items-center justify-between gap-2 border-b border-rule bg-panel-raised px-3 py-2"
      >
        <div role="columnheader" className="flex min-w-0 flex-1 items-center">
          <Status value={column.status} size="sm" />
        </div>
        <span className="font-chassis text-chassis-sm text-ink-3">
          {countPhrase(column.tasks.length, "task")}
        </span>
      </div>

      <div className="flex min-h-24 flex-col gap-1.5 p-1.5">
        {column.tasks.length === 0 ? (
          <p className="p-2 font-prose text-small text-ink-3 prose-measure">
            Nothing is {column.label} under the current filters. Widen the
            filters above, or move a task here from its own panel.
          </p>
        ) : (
          column.tasks.map((task) => {
            const active = task.id === activeId;
            const holder = holderOf(task, index);
            return (
              <div
                key={task.id}
                role="row"
                aria-selected={task.id === openId}
                tabIndex={active ? 0 : -1}
                ref={active ? activeRef : undefined}
                onClick={() => {
                  onActivate(task.id);
                  onOpen(task.id);
                }}
                onFocus={() => onActivate(task.id)}
                style={OFFSCREEN_SKIP}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1.5 rounded-sd border border-rule bg-panel p-2 transition-colors duration-[120ms] ease-sd focus-visible:outline-none",
                  "hover:bg-inset",
                  task.id === openId &&
                    "border-signal-edge bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
                  active &&
                    task.id !== openId &&
                    "shadow-[inset_2px_0_0_var(--sd-signal)]",
                )}
              >
                {task.status === "blocked" ? <BlockedHatch /> : null}
                <div role="gridcell" className="relative flex flex-col gap-1.5">
                  <span className="font-prose text-small text-ink">
                    {task.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TaskIdentifier task={task} />
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {priorityLabel(task.priority)}
                    </span>
                  </div>
                  <FeatureReading
                    task={task}
                    index={index}
                    className="truncate font-prose text-small text-ink-3"
                  />
                  <HolderReading
                    holder={holder}
                    className="truncate font-prose text-small text-ink-3"
                  />
                  <TaskMarkers task={task} index={index} className="flex-wrap" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Hierarchy
   --------------------------------------------------------------------------- */

export function TaskHierarchy({
  model,
  activeId,
  openId,
  onActivate,
  onOpen,
  activeRef,
  onKeyDown,
  onToggle,
}: LayoutHandlers & { onToggle: (id: string) => void }) {
  const { tree, index } = model;
  const contextRows = tree.filter((row) => !row.matched).length;

  return (
    <div className="flex flex-col gap-2">
      {contextRows > 0 ? (
        <p className="font-prose text-small text-ink-3 prose-measure">
          {countPhrase(contextRows, "parent task")} shown in a lighter tone
          because a subtask matches the filters rather than the parent itself.
        </p>
      ) : null}

      <div
        role="treegrid"
        aria-label="Tasks with their subtasks"
        aria-rowcount={tree.length}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="overflow-x-auto rounded-sd-lg border border-rule bg-panel"
      >
        {tree.map((row, position) => (
          <HierarchyLine
            key={row.task.id}
            row={row}
            position={position}
            index={index}
            activeId={activeId}
            openId={openId}
            onActivate={onActivate}
            onOpen={onOpen}
            onToggle={onToggle}
            activeRef={activeRef}
          />
        ))}
      </div>
    </div>
  );
}

function HierarchyLine({
  row,
  position,
  index,
  activeId,
  openId,
  onActivate,
  onOpen,
  onToggle,
  activeRef,
}: {
  row: HierarchyRow;
  position: number;
  index: TaskIndex;
  activeId: string | null;
  openId: string | null;
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  activeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { task, depth, hasChildren, expanded, matched } = row;
  const active = task.id === activeId;
  const holder = holderOf(task, index);

  return (
    <div
      role="row"
      aria-rowindex={position + 1}
      aria-level={depth + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={task.id === openId}
      tabIndex={active ? 0 : -1}
      ref={active ? activeRef : undefined}
      onClick={() => {
        onActivate(task.id);
        onOpen(task.id);
      }}
      onFocus={() => onActivate(task.id)}
      style={OFFSCREEN_SKIP}
      className={cn(
        "relative flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 border-b border-rule px-2 py-1.5 transition-colors duration-[120ms] ease-sd last:border-b-0 focus-visible:outline-none",
        "hover:bg-inset",
        task.id === openId &&
          "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
        active &&
          task.id !== openId &&
          "bg-inset shadow-[inset_2px_0_0_var(--sd-signal)]",
        !matched && "opacity-70",
      )}
    >
      {task.status === "blocked" ? <BlockedHatch /> : null}

      <div
        role="gridcell"
        className="relative flex min-w-0 flex-1 items-center gap-2"
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${expanded ? "Collapse" : "Expand"} the subtasks of ${task.name}`}
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(task.id);
            }}
            className="grid size-6 shrink-0 place-items-center rounded-sd text-ink-3 focus-ring hover:bg-panel-raised hover:text-ink"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="grid size-6 shrink-0 place-items-center text-ink-3">
            {depth > 0 ? (
              <CornerDownRight className="size-3" aria-hidden="true" />
            ) : null}
          </span>
        )}
        <Status value={task.status} size="sm" />
        <span className="min-w-0 flex-1 truncate font-prose text-small text-ink">
          {task.name}
        </span>
        <TaskIdentifier task={task} />
      </div>

      <div
        role="gridcell"
        className="flex shrink-0 flex-wrap items-center gap-2"
      >
        <TaskMarkers task={task} index={index} />
        <span className="font-chassis text-chassis-sm text-ink-3">
          {priorityLabel(task.priority)}
        </span>
        <HolderReading
          holder={holder}
          className="hidden font-prose text-small text-ink-3 sm:inline"
        />
        {!matched ? (
          <span className="font-prose text-small text-ink-3">
            Shown for context
          </span>
        ) : null}
      </div>
    </div>
  );
}
