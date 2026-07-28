/**
 * The controls above the work: which layout, what is being filtered out, in
 * what order, and how current the reading is.
 *
 * Every filter is written into the address bar by the view, so what is on
 * screen here is always exactly what a colleague would get from the same link.
 */

import {
  ArrowDownUp,
  Columns3,
  Keyboard,
  ListTree,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { forwardRef } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { absoluteTime, countPhrase, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/now";
import type { ConnectionState, Meta } from "@/types";
import { cn } from "@/lib/utils";

import {
  ASSIGNMENT_LABELS,
  BLOCKED_LABELS,
  EVIDENCE_LABELS,
  FILTER_LABELS,
  LAYOUT_DESCRIPTIONS,
  LAYOUT_LABELS,
  MULTI_FILTERS,
  SORT_LABELS,
  TASK_LAYOUTS,
  countActiveFilters,
  toggleValue,
  type AssignmentFilter,
  type BlockedFilter,
  type EvidenceFilter,
  type MultiFilterKey,
  type SortDirection,
  type SortKey,
  type TaskFilters,
  type TaskIndex,
  type TaskLayout,
} from "@/components/tasks/model";

const LAYOUT_ICONS: Record<TaskLayout, LucideIcon> = {
  list: Rows3,
  board: Columns3,
  hierarchy: ListTree,
};

/** The number key that switches to each layout, so the hint matches the handler. */
const LAYOUT_KEYS: Record<TaskLayout, string> = {
  list: "1",
  board: "2",
  hierarchy: "3",
};

export interface TaskToolbarProps {
  layout: TaskLayout;
  onLayoutChange: (layout: TaskLayout) => void;
  sort: SortKey;
  direction: SortDirection;
  onSortChange: (sort: SortKey, direction: SortDirection) => void;
  filters: TaskFilters;
  onFiltersChange: (patch: Partial<TaskFilters>) => void;
  onClearFilters: () => void;
  index: TaskIndex;
  visibleCount: number;
  totalCount: number;
  meta: Meta | null;
  connection: ConnectionState;
  onRefresh: () => void;
  onCreate: () => void;
  onShowShortcuts: () => void;
}

export const TaskToolbar = forwardRef<HTMLInputElement, TaskToolbarProps>(
  function TaskToolbar(
    {
      layout,
      onLayoutChange,
      sort,
      direction,
      onSortChange,
      filters,
      onFiltersChange,
      onClearFilters,
      index,
      visibleCount,
      totalCount,
      meta,
      connection,
      onRefresh,
      onCreate,
      onShowShortcuts,
    },
    searchRef,
  ) {
    const activeCount = countActiveFilters(filters);

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="How the tasks are laid out"
            className="flex items-center gap-0.5 rounded-sd border border-rule bg-inset p-0.5"
          >
            {TASK_LAYOUTS.map((option) => {
              const Icon = LAYOUT_ICONS[option];
              const active = option === layout;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-keyshortcuts={LAYOUT_KEYS[option]}
                  title={`${LAYOUT_DESCRIPTIONS[option]}. Shortcut: ${LAYOUT_KEYS[option]}`}
                  onClick={() => onLayoutChange(option)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-sd-sm px-2 font-chassis text-chassis-sm transition-colors duration-[120ms] ease-sd focus-ring",
                    active
                      ? "bg-panel text-ink shadow-[inset_0_0_0_1px_var(--sd-signal-edge)]"
                      : "text-ink-3 hover:text-ink",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn("size-3.5", active && "text-signal")}
                  />
                  {LAYOUT_LABELS[option]}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3"
            />
            <Input
              ref={searchRef}
              type="search"
              value={filters.text}
              onChange={(event) => onFiltersChange({ text: event.target.value })}
              placeholder="Search tasks by name, purpose, id or feature"
              aria-label="Search tasks by name, purpose, identifier or feature"
              aria-keyshortcuts="/"
              className="pl-8"
            />
          </div>

          <Button size="sm" onClick={onCreate} aria-keyshortcuts="n">
            <Plus />
            New task
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onShowShortcuts}
            aria-keyshortcuts="?"
            title="Show the keyboard shortcuts for this view"
          >
            <Keyboard />
            <span className="hidden sm:inline">Shortcuts</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <SlidersHorizontal
            aria-hidden="true"
            className="size-3.5 shrink-0 text-ink-3"
          />
          {MULTI_FILTERS.map((key) => (
            <MultiFilter
              key={key}
              filterKey={key}
              filters={filters}
              index={index}
              onFiltersChange={onFiltersChange}
            />
          ))}

          <ChoiceFilter
            label="Claim"
            value={filters.assignment}
            labels={ASSIGNMENT_LABELS}
            onChange={(value) =>
              onFiltersChange({ assignment: value as AssignmentFilter })
            }
          />
          <ChoiceFilter
            label="Blocked"
            value={filters.blocked}
            labels={BLOCKED_LABELS}
            onChange={(value) =>
              onFiltersChange({ blocked: value as BlockedFilter })
            }
          />
          <ChoiceFilter
            label="Evidence"
            value={filters.evidence}
            labels={EVIDENCE_LABELS}
            onChange={(value) =>
              onFiltersChange({ evidence: value as EvidenceFilter })
            }
          />

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-rule" />

          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as SortKey, direction)}
          >
            <SelectTrigger size="sm" aria-label="Sort the tasks by">
              <ArrowDownUp className="size-3.5 text-ink-3" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onSortChange(sort, direction === "asc" ? "desc" : "asc")
            }
            title={`Sorted ${direction === "asc" ? "first to last" : "last to first"}. Reverse it.`}
          >
            {direction === "asc" ? "First to last" : "Last to first"}
          </Button>

          {activeCount > 0 ? (
            <Button size="sm" variant="ghost" onClick={onClearFilters}>
              <X />
              Clear {countPhrase(activeCount, "filter")}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-chassis text-chassis-sm text-ink-2">
            Showing {countPhrase(visibleCount, "task")} of{" "}
            {countPhrase(totalCount, "task")} in this project
          </p>
          <FreshnessLine
            meta={meta}
            connection={connection}
            onRefresh={onRefresh}
          />
          {!index.productAvailable ? (
            <p className="font-prose text-small text-state-attention">
              Module and milestone could not be read, so those two filters are
              empty. Everything else is unaffected.
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);

/* ---------------------------------------------------------------------------
   One multi-choice filter
   --------------------------------------------------------------------------- */

function MultiFilter({
  filterKey,
  filters,
  index,
  onFiltersChange,
}: {
  filterKey: MultiFilterKey;
  filters: TaskFilters;
  index: TaskIndex;
  onFiltersChange: (patch: Partial<TaskFilters>) => void;
}) {
  const options = index.options[filterKey];
  const selected = filters[filterKey];
  const label = FILTER_LABELS[filterKey];

  // An empty filter still opens, because "nothing records this yet" is a real
  // answer and a disabled control cannot give it.
  if (options.length === 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="text-ink-3">
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-72">
          <DropdownMenuLabel>Filter by {label.toLowerCase()}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 font-prose text-small text-ink-2">
            No task in this project records a {label.toLowerCase()} yet, so
            there is nothing to filter by. This list fills in as tasks are
            created and claimed.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? `${label}: ${
            options.find((option) => option.value === selected[0])?.label ??
            selected[0]
          }`
        : `${label}: ${countPhrase(selected.length, "choice")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={selected.length ? "secondary" : "ghost"}
          className={cn(selected.length && "text-ink")}
        >
          {summary}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Filter by {label.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() =>
              onFiltersChange({
                [filterKey]: toggleValue(selected, option.value),
              } as Partial<TaskFilters>)
            }
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="shrink-0 text-ink-3">
              {countPhrase(option.count, "task")}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() =>
                onFiltersChange({ [filterKey]: [] } as Partial<TaskFilters>)
              }
              className="flex w-full items-center gap-2 rounded-sd px-2 py-1.5 font-chassis text-chassis-sm text-ink-2 focus-ring hover:bg-inset hover:text-ink"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear this filter
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------------------------------
   One three-way choice
   --------------------------------------------------------------------------- */

function ChoiceFilter({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  labels: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const keys = Object.keys(labels);
  const isDefault = value === keys[0];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label={`Filter by ${label.toLowerCase()}`}
        className={cn(!isDefault && "border-signal-edge bg-signal-wash text-ink")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {keys.map((key) => (
          <SelectItem key={key} value={key}>
            {labels[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------------------------------------------------------------------------
   Freshness, per section 16.3 of the brief
   --------------------------------------------------------------------------- */

export function FreshnessLine({
  meta,
  connection,
  onRefresh,
  className,
}: {
  meta: Meta | null;
  connection: ConnectionState;
  onRefresh: () => void;
  className?: string;
}) {
  const now = useNow();
  if (!meta) {
    return (
      <p className={cn("font-chassis text-chassis-sm text-ink-3", className)}>
        No reading has arrived from the local service yet.
      </p>
    );
  }

  const connectionWords =
    connection === "live"
      ? "Changes arrive as they are committed."
      : connection === "reconnecting"
        ? "The change stream dropped and is being retried, so this may fall behind."
        : "The change stream is offline, so this will not update on its own.";

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 font-chassis text-chassis-sm text-ink-3",
        className,
      )}
    >
      <span title={absoluteTime(meta.generatedAt)}>
        Read {relativeTime(meta.generatedAt, now).toLowerCase()} at database revision{" "}
        {meta.revision}, last change event {meta.lastEventSequence}.
      </span>
      <span className="font-prose text-small">{connectionWords}</span>
      <Button size="sm" variant="ghost" onClick={onRefresh}>
        <RefreshCw />
        Refresh now
      </Button>
    </p>
  );
}
