/**
 * Shared plumbing for the Workflows, Data and Architecture views.
 *
 * These three views read different endpoints but answer the same way: fetch on
 * mount, refetch when the live stream reports a committed change, keep the last
 * good data on screen while refetching, and never leave a region blank. The
 * pieces below are the parts that would otherwise be written three times.
 *
 * It lives beside the diagrams because those three views and their canvases are
 * the only callers.
 */

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { absoluteTime, formatNumber, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/now";
import { cn } from "@/lib/utils";
import type { Meta, Result } from "@/types";

/* ---------------------------------------------------------------------------
   Reading a payload
   --------------------------------------------------------------------------- */

export type Reader<T> = (signal?: AbortSignal) => Promise<Result<T>>;

export interface Resource<T> {
  /** The last payload that arrived, kept during a refetch so nothing flickers. */
  data: T | null;
  meta: Meta | null;
  error: Error | null;
  /** True only while a request is in flight. */
  loading: boolean;
  /** True when nothing has ever arrived: the view shows Loading, not content. */
  pending: boolean;
  /** True when the service could not be reached at all. */
  offline: boolean;
  reload: () => void;
}

/**
 * One endpoint, refetched whenever `revision` moves.
 *
 * `revision` comes from the live stream, so a committed transaction anywhere in
 * the project pulls fresh data into whichever view is open.
 */
export function useResource<T>(read: Reader<T>, revision: number): Resource<T> {
  const [state, setState] = useState<{
    data: T | null;
    meta: Meta | null;
    error: Error | null;
    loading: boolean;
  }>({ data: null, meta: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));

    read(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          data: result.data,
          meta: result.meta,
          error: null,
          loading: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
      });

    return () => controller.abort();
  }, [read, revision, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    ...state,
    pending: state.data === null && state.error === null,
    offline: state.error instanceof ApiError && state.error.isOffline,
    reload,
  };
}

/* ---------------------------------------------------------------------------
   Freshness
   --------------------------------------------------------------------------- */

/**
 * Section 16.3: the view can always say how current its numbers are. Database
 * revision and last event sequence come straight off the read envelope.
 */
export function FreshnessLine({
  meta,
  loading,
  onRefresh,
  className,
}: {
  meta: Meta | null;
  loading?: boolean;
  onRefresh: () => void;
  className?: string;
}) {
  const now = useNow();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 font-chassis text-chassis-sm text-ink-3",
        className,
      )}
    >
      {meta ? (
        <span title={absoluteTime(meta.generatedAt)}>
          Read {relativeTime(meta.generatedAt, now).toLowerCase()}, at database
          revision {formatNumber(meta.revision)}, last event sequence{" "}
          {formatNumber(meta.lastEventSequence)}.
        </span>
      ) : (
        <span>No reading has arrived from the service in this session yet.</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw aria-hidden="true" className={loading ? "opacity-55" : ""} />
        {loading ? "Reading" : "Refresh"}
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Layout primitives
   --------------------------------------------------------------------------- */

let panelSeed = 0;
function nextPanelId() {
  panelSeed += 1;
  return `panel-heading-${panelSeed}`;
}

/**
 * One bordered region with a hairline-divided head. Panels butt together rather
 * than floating as cards, per DESIGN_DIRECTION.md section 8.
 */
export function Panel({
  title,
  description,
  actions,
  bodyClassName,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [headingId] = useState(nextPanelId);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-sd-lg border border-rule bg-panel",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-rule bg-panel-raised px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={headingId} className="font-prose text-subtitle text-ink">
            {title}
          </h3>
          {description ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {actions}
          </div>
        ) : null}
      </div>
      <div className={cn("min-w-0", bodyClassName ?? "p-3")}>{children}</div>
    </section>
  );
}

export interface Fact {
  label: string;
  value: React.ReactNode;
}

/**
 * Key and value pairs. The label is chassis, the value is prose when it is a
 * sentence, so a specification reads as a specification rather than a dump.
 */
export function Facts({
  items,
  columns = 2,
  className,
}: {
  items: Fact[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1">
          <dt className="font-chassis text-label text-ink-3 uppercase">
            {item.label}
          </dt>
          <dd className="min-w-0 font-prose text-body text-ink-2 break-words">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A value that may be missing. Never prints an empty cell: it says what is
 * absent, so the reader knows the project has not recorded it rather than
 * wondering whether the page failed.
 */
export function Value({
  children,
  missing = "Not recorded",
}: {
  children: React.ReactNode;
  missing?: string;
}) {
  const empty =
    children === null ||
    children === undefined ||
    children === "" ||
    (Array.isArray(children) && children.length === 0);

  if (empty) {
    return <span className="font-chassis text-chassis-sm text-ink-3">{missing}</span>;
  }
  return <>{children}</>;
}

/** A stored list rendered as a readable list, with an explicit absence. */
export function ValueList({
  items,
  missing = "None recorded",
}: {
  items: string[] | null | undefined;
  missing?: string;
}) {
  const clean = (items ?? []).filter(Boolean);
  if (clean.length === 0) {
    return <span className="font-chassis text-chassis-sm text-ink-3">{missing}</span>;
  }
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4">
      {clean.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Plain language first, identifier second. The name is prose, the id is a
 * quiet chassis reading beside it.
 */
export function RecordName({
  name,
  id,
  className,
  size = "default",
}: {
  name: string;
  id: string;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <span
        className={cn(
          "truncate font-prose text-ink",
          size === "sm" ? "text-small" : "text-subtitle",
        )}
      >
        {name}
      </span>
      <span className="truncate font-chassis text-chassis-sm text-ink-3">
        {id}
      </span>
    </span>
  );
}

/** A neutral metadata tag. Never used to carry status. */
export function Tag({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-sd-sm border border-rule bg-inset px-1.5 py-0.5 font-chassis text-chassis-sm text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A count that always says what it counts, in the one place a headline row of
 * readings is drawn.
 */
export function CountStrip({
  items,
  className,
}: {
  items: { label: string; value: number; unit: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 divide-rule border-rule sm:grid-cols-4 sm:divide-x",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 px-3 py-2">
          <dt className="font-chassis text-label text-ink-3 uppercase">
            {item.label}
          </dt>
          <dd className="font-chassis text-title text-ink">
            {formatNumber(item.value)}{" "}
            <span className="font-chassis text-chassis-sm text-ink-3">
              {item.unit}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------------------------------------------------------------------
   Viewport
   --------------------------------------------------------------------------- */

/**
 * True on a narrow screen. A diagram is not readable on a phone, so the views
 * that own one open on their table instead and let the person choose the
 * diagram deliberately.
 */
export function useNarrow(query = "(max-width: 767px)") {
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return narrow;
}

/* ---------------------------------------------------------------------------
   Small shared helpers
   --------------------------------------------------------------------------- */

/** SQLite stores booleans as 0 and 1; the interface should not care which. */
export function isTrue(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1;
}

/** Index a list of records by id, for the lookups every view does. */
export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}
