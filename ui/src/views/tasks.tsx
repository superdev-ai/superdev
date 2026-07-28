/**
 * Tasks: the work-management surface, brief section 15.2.
 *
 * One set of tasks, three layouts over it, and every filter, the layout and the
 * sort held in the address bar so a filtered view can be handed to someone else
 * as a link. Writes go out through the bounded mutation endpoint only, and a
 * refusal is always shown with the reason and the control that resolves it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { ApiError, getActivity, getProduct, getTasks } from "@/lib/api";
import { countPhrase } from "@/lib/format";
import { navigate, useRoute } from "@/lib/route";
import { useLive } from "@/lib/live";
import type {
  ActivityEvent,
  Meta,
  ProductPayload,
  TasksPayload,
} from "@/types";

import {
  ClaimDialog,
  LinkDialog,
  ReasonDialog,
  RefusalNotice,
  ShortcutsDialog,
  TaskFormDialog,
  isActionAvailable,
  unavailableReason,
  useTaskMutation,
  type FormMode,
  type ReasonKind,
  type TaskActionId,
} from "@/components/tasks/actions";
import { TaskBoard, TaskHierarchy, TaskList } from "@/components/tasks/layouts";
import { TaskDetail, type HistoryState } from "@/components/tasks/detail";
import { TaskToolbar } from "@/components/tasks/filters";
import {
  describeFilters,
  hasActiveFilters,
  useTaskParams,
  useTaskViewModel,
  type SortDirection,
  type SortKey,
  type TaskLayout,
} from "@/components/tasks/model";

const LAYOUT_KEYS: Record<string, TaskLayout> = {
  "1": "list",
  "2": "board",
  "3": "hierarchy",
};

export function TasksView() {
  const { route } = useRoute();
  const live = useLive();
  const { params, update, setFilters, clearFilters } = useTaskParams();

  const [payload, setPayload] = useState<TasksPayload | null>(null);
  const [product, setProduct] = useState<ProductPayload | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  /** True while a read is in flight, so a catch-up is not reported as staleness. */
  const [refreshing, setRefreshing] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const [history, setHistory] = useState<ActivityEvent[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>("ready");
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [historyToken, setHistoryToken] = useState(0);

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formOpen, setFormOpen] = useState(false);
  const [reasonKind, setReasonKind] = useState<ReasonKind>("block");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const activeRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);
  const mutation = useTaskMutation(refresh);

  /* ------------------------------------------------------------------ data */

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setRefreshing(true);

    getTasks(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setPayload(result.data);
        setMeta(result.meta);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    // Module and milestone live on features rather than on tasks, so the product
    // route is read alongside. Failing it degrades two filters, nothing else.
    getProduct(controller.signal)
      .then((result) => {
        if (!cancelled) setProduct(result.data);
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshToken, live.revision]);

  useEffect(() => {
    const id = route.record;
    if (!id) {
      setHistory([]);
      setHistoryState("ready");
      setHistoryError(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setHistoryState("loading");

    getActivity({ search: id, limit: 100 }, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setHistory(result.data.events ?? []);
        setHistoryError(null);
        setHistoryState("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setHistoryError(
          cause instanceof Error ? cause : new Error(String(cause)),
        );
        setHistoryState("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [route.record, historyToken, live.revision]);

  /* ----------------------------------------------------------------- model */

  const model = useTaskViewModel(payload, product, params, collapsed);

  const openTask = useCallback((id: string | null) => {
    navigate("tasks", id);
  }, []);

  const moveTo = useCallback((id: string | null | undefined) => {
    if (!id) return;
    setActiveId(id);
    setFocusNonce((nonce) => nonce + 1);
  }, []);

  // Keep the keyboard position on something that is still on screen.
  useEffect(() => {
    if (!model) return;
    if (activeId && model.order.includes(activeId)) return;
    const fallback =
      route.record && model.order.includes(route.record)
        ? route.record
        : (model.order[0] ?? null);
    setActiveId(fallback);
  }, [model, activeId, route.record]);

  useEffect(() => {
    if (focusNonce === 0) return;
    activeRef.current?.focus();
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusNonce]);

  // A note about why an action was not possible belongs to the task it was
  // about, so moving somewhere else clears it rather than leaving it stranded.
  useEffect(() => setNotice(null), [route.record, activeId]);

  const dialogOpen =
    formOpen || reasonOpen || claimOpen || linkOpen || shortcutsOpen;

  const subjectId = route.record ?? activeId;
  const subject = subjectId ? (model?.index.byId.get(subjectId) ?? null) : null;

  /* --------------------------------------------------------------- actions */

  const runAction = useCallback(
    (action: TaskActionId) => {
      if (!subject) {
        setNotice(
          "Choose a task first. Click one, or move to it with the arrow keys.",
        );
        return;
      }
      setNotice(null);
      mutation.clear();

      if (!isActionAvailable(action, subject)) {
        setNotice(unavailableReason(action, subject));
        return;
      }

      switch (action) {
        case "claim":
          setClaimOpen(true);
          return;
        case "release":
          setReasonKind("release");
          setReasonOpen(true);
          return;
        case "block":
          setReasonKind("block");
          setReasonOpen(true);
          return;
        case "cancel":
          setReasonKind("cancel");
          setReasonOpen(true);
          return;
        case "reopen":
          setReasonKind("reopen");
          setReasonOpen(true);
          return;
        case "complete":
          setReasonKind("complete");
          setReasonOpen(true);
          return;
        case "subtask":
          setFormMode("subtask");
          setFormOpen(true);
          return;
        case "edit":
          setFormMode("edit");
          setFormOpen(true);
          return;
        case "link":
          setLinkOpen(true);
          return;
        case "start":
          void mutation.run(
            "task.transition",
            { taskId: subject.id, to: "in_progress" },
            `Move ${subject.id} to In Progress`,
            subject.id,
          );
          return;
        case "review":
          void mutation.run(
            "task.transition",
            { taskId: subject.id, to: "in_review" },
            `Move ${subject.id} to In Review`,
            subject.id,
          );
          return;
        case "verify":
          void mutation.run(
            "task.transition",
            { taskId: subject.id, to: "verifying" },
            `Move ${subject.id} to Verifying`,
            subject.id,
          );
          return;
        case "pause":
          void mutation.run(
            "task.transition",
            { taskId: subject.id, to: "paused" },
            `Pause ${subject.id}`,
            subject.id,
          );
          return;
        default:
          return;
      }
    },
    [mutation, subject],
  );

  const toggleBranch = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* -------------------------------------------------------------- keyboard */

  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!model || model.order.length === 0) return;
      const groups = model.groups;

      let groupIndex = -1;
      let rowIndex = -1;
      for (let g = 0; g < groups.length; g += 1) {
        const found = activeId ? groups[g].indexOf(activeId) : -1;
        if (found !== -1) {
          groupIndex = g;
          rowIndex = found;
          break;
        }
      }
      if (groupIndex === -1) {
        groupIndex = groups.findIndex((group) => group.length > 0);
        rowIndex = -1;
      }
      if (groupIndex === -1) return;
      const column = groups[groupIndex];

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveTo(column[Math.min(rowIndex + 1, column.length - 1)]);
          return;
        case "ArrowUp":
          event.preventDefault();
          moveTo(column[Math.max(rowIndex - 1, 0)]);
          return;
        case "Home":
          event.preventDefault();
          moveTo(column[0]);
          return;
        case "End":
          event.preventDefault();
          moveTo(column[column.length - 1]);
          return;
        case "Enter":
          event.preventDefault();
          if (activeId) openTask(activeId);
          return;
        case "ArrowRight":
          event.preventDefault();
          if (params.layout === "hierarchy" && activeId) {
            const row = model.tree.find((entry) => entry.task.id === activeId);
            if (row?.hasChildren && !row.expanded) toggleBranch(activeId);
            else if (row?.hasChildren) moveTo(column[rowIndex + 1]);
            return;
          }
          for (let g = groupIndex + 1; g < groups.length; g += 1) {
            if (groups[g].length > 0) {
              moveTo(
                groups[g][
                  Math.max(0, Math.min(rowIndex, groups[g].length - 1))
                ],
              );
              return;
            }
          }
          return;
        case "ArrowLeft":
          event.preventDefault();
          if (params.layout === "hierarchy" && activeId) {
            const row = model.tree.find((entry) => entry.task.id === activeId);
            if (row?.hasChildren && row.expanded) toggleBranch(activeId);
            else if (row?.task.parent_task_id) moveTo(row.task.parent_task_id);
            return;
          }
          for (let g = groupIndex - 1; g >= 0; g -= 1) {
            if (groups[g].length > 0) {
              moveTo(
                groups[g][
                  Math.max(0, Math.min(rowIndex, groups[g].length - 1))
                ],
              );
              return;
            }
          }
          return;
        default:
          return;
      }
    },
    [activeId, model, moveTo, openTask, params.layout, toggleBranch],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(input|textarea|select)$/i.test(target.tagName) ||
          // A menu, a select popover or a dialog owns its own key handling, so
          // a single letter there is typeahead rather than a task shortcut.
          target.closest('[role="menu"],[role="listbox"],[role="dialog"]'))
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (dialogOpen) return;
        if (route.record) {
          event.preventDefault();
          openTask(null);
        }
        return;
      }
      if (dialogOpen) return;

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === "n") {
        event.preventDefault();
        setFormMode("create");
        setFormOpen(true);
        return;
      }
      const layout = LAYOUT_KEYS[event.key];
      if (layout) {
        event.preventDefault();
        update({ layout });
        return;
      }

      const shortcuts: Record<string, TaskActionId> = {
        c: "claim",
        r: "release",
        s: "start",
        v: "review",
        y: "verify",
        p: "pause",
        b: "block",
        d: "complete",
        o: "reopen",
        x: "cancel",
        t: "subtask",
        l: "link",
        e: "edit",
      };
      const action = shortcuts[event.key];
      if (action) {
        event.preventDefault();
        runAction(action);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, openTask, route.record, runAction, update]);

  /* ---------------------------------------------------------------- render */

  const described = useMemo(
    () => (model ? describeFilters(params.filters, model.index) : []),
    [model, params.filters],
  );

  const onSortChange = useCallback(
    (sort: SortKey, direction: SortDirection) => update({ sort, direction }),
    [update],
  );

  const layoutHandlers = model
    ? {
        model,
        activeId,
        openId: route.record,
        onActivate: setActiveId,
        onOpen: openTask,
        activeRef,
        onKeyDown: onGridKeyDown,
      }
    : null;

  const behind =
    meta !== null &&
    !refreshing &&
    live.revision > 0 &&
    live.revision > meta.revision;

  return (
    <>
      <ViewHeader view="tasks">
        {model ? (
          <TaskToolbar
            ref={searchRef}
            layout={params.layout}
            onLayoutChange={(layout) => update({ layout })}
            sort={params.sort}
            direction={params.direction}
            onSortChange={onSortChange}
            filters={params.filters}
            onFiltersChange={setFilters}
            onClearFilters={clearFilters}
            index={model.index}
            visibleCount={model.visible.length}
            totalCount={model.index.tasks.length}
            meta={meta}
            connection={live.status.state}
            onRefresh={refresh}
            onCreate={() => {
              setFormMode("create");
              setFormOpen(true);
            }}
            onShowShortcuts={() => setShortcutsOpen(true)}
          />
        ) : null}
      </ViewHeader>

      <ViewBody>
        {notice ? (
          <p
            role="status"
            className="rounded-sd border border-state-attention/45 bg-state-attention-wash px-3 py-2 font-prose text-small text-ink prose-measure"
          >
            {notice}
          </p>
        ) : null}

        {mutation.refusal && !route.record && model ? (
          <RefusalNotice
            refusal={mutation.refusal}
            task={
              mutation.refusal.taskId
                ? (model.index.byId.get(mutation.refusal.taskId) ?? null)
                : null
            }
            index={model.index}
            onOpenTask={openTask}
            onAction={runAction}
            onRefresh={refresh}
            onDismiss={mutation.clear}
          />
        ) : null}

        {loading && !payload ? (
          <Loading
            title="Loading the work"
            explanation="Reading every task, its assignment, its dependencies and its evidence from the project database on this machine."
            rows={6}
          />
        ) : null}

        {error && !payload ? (
          error instanceof ApiError && error.isOffline ? (
            <Offline onReconnect={live.reconnect} state="offline" meta={meta} />
          ) : (
            <ErrorState
              title="The tasks did not load"
              error={error}
              onRetry={refresh}
            />
          )
        ) : null}

        {error && payload ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation="Everything below is the previous reading, which may now be behind. The service reported a problem when this page tried to read it again."
            error={error}
            onRetry={refresh}
          />
        ) : null}

        {payload && (meta?.stale || behind) ? (
          <Stale
            meta={meta}
            showing={countPhrase(model?.visible.length ?? 0, "task")}
            onRefresh={refresh}
          />
        ) : null}

        {live.status.state === "offline" && payload ? (
          <Offline
            density="inline"
            state="offline"
            meta={meta}
            onReconnect={live.reconnect}
            title="Live updates have stopped"
            explanation="The change stream is not answering, so this list will not update on its own. What is below is the last reading. Reconnect, or refresh to read once."
          />
        ) : null}

        {model && layoutHandlers ? (
          model.index.tasks.length === 0 ? (
            <Empty
              title="This project has no tasks yet"
              explanation="Work is created against a feature, and it states the outcome finishing it produces. Create the first task, or open Features to see what is specified and ready to be worked on."
              actions={[
                {
                  label: "Create the first task",
                  onClick: () => {
                    setFormMode("create");
                    setFormOpen(true);
                  },
                },
                { label: "Open Features", href: "#/features" },
              ]}
            />
          ) : model.visible.length === 0 ? (
            <Empty
              title="No task matches these filters"
              explanation={`All ${countPhrase(model.index.tasks.length, "task")} in this project were checked and none passed. Widen or clear the filters to see the work again.`}
              details={
                described.length > 0 ? (
                  <span>Currently filtered by: {described.join("; ")}.</span>
                ) : (
                  <span>No filter is set, which should not hide anything.</span>
                )
              }
              actions={
                hasActiveFilters(params.filters)
                  ? [
                      { label: "Clear the filters", onClick: clearFilters },
                      {
                        label: "Create a task",
                        onClick: () => {
                          setFormMode("create");
                          setFormOpen(true);
                        },
                        variant: "outline",
                      },
                    ]
                  : [
                      {
                        label: "Create a task",
                        onClick: () => {
                          setFormMode("create");
                          setFormOpen(true);
                        },
                      },
                    ]
              }
            />
          ) : params.layout === "board" ? (
            <TaskBoard {...layoutHandlers} />
          ) : params.layout === "hierarchy" ? (
            <TaskHierarchy {...layoutHandlers} onToggle={toggleBranch} />
          ) : (
            <TaskList
              {...layoutHandlers}
              sort={params.sort}
              direction={params.direction}
              onSortChange={onSortChange}
            />
          )
        ) : null}
      </ViewBody>

      {model ? (
        <>
          <TaskDetail
            taskId={route.record}
            task={route.record ? (model.index.byId.get(route.record) ?? null) : null}
            index={model.index}
            mutation={mutation}
            onClose={() => openTask(null)}
            onAction={runAction}
            onOpenTask={openTask}
            onRefresh={refresh}
            history={history}
            historyState={historyState}
            historyError={historyError}
            onRetryHistory={() => setHistoryToken((token) => token + 1)}
          />

          <TaskFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            mode={formMode}
            task={formMode === "create" ? null : subject}
            index={model.index}
            mutation={mutation}
          />

          <ReasonDialog
            open={reasonOpen}
            onOpenChange={setReasonOpen}
            kind={reasonKind}
            task={subject}
            mutation={mutation}
          />

          <ClaimDialog
            open={claimOpen}
            onOpenChange={setClaimOpen}
            task={subject}
            index={model.index}
            mutation={mutation}
          />

          <LinkDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            task={subject}
            mutation={mutation}
          />
        </>
      ) : null}

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
