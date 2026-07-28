/**
 * Reading project data for a canvas view, and saying how current it is.
 *
 * Section 16.3 of the rebuild spec: the control center updates straight after a
 * committed transaction, so every read is repeated when the live stream reports
 * a new activity sequence. Nothing here waits for a Markdown rebuild.
 *
 * `FreshnessLine` is the visible half of the same promise: a person can always
 * see which database revision a figure came from and how long ago it was read.
 */

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/shell/status";
import type { ApiError } from "@/lib/api";
import { absoluteTime, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/now";
import { useLive } from "@/lib/live";
import type { ConnectionState, Meta } from "@/types";
import { cn } from "@/lib/utils";

export interface LiveRead<T> {
  data: T | null;
  meta: Meta | null;
  error: ApiError | Error | null;
  /** True only while the first read of this view is in flight. */
  loading: boolean;
  /** True while a repeat read triggered by a change is in flight. */
  refreshing: boolean;
  connection: ConnectionState;
  connectionExplanation: string;
  refresh: () => void;
  reconnect: () => void;
}

/**
 * Reads once, then again on every committed change. `load` must be stable, so
 * wrap it in `useCallback` in the view.
 */
export function useLiveRead<T>(
  load: (signal: AbortSignal) => Promise<{ data: T; meta: Meta }>,
): LiveRead<T> {
  const { status, revision, reconnect } = useLive();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    meta: Meta | null;
    error: ApiError | Error | null;
    settled: boolean;
    busy: boolean;
  }>({ data: null, meta: null, error: null, settled: false, busy: true });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((prev) => ({ ...prev, busy: true }));

    load(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setState({
          data: result.data,
          meta: result.meta,
          error: null,
          settled: true,
          busy: false,
        });
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error
              : new Error(
                  "The project database could not be read. Choose Refresh, and " +
                    "check the service log if it happens again.",
                ),
          settled: true,
          busy: false,
        }));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [load, revision, attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    data: state.data,
    meta: state.meta,
    error: state.error,
    loading: !state.settled,
    refreshing: state.settled && state.busy,
    connection: status.state,
    connectionExplanation: status.explanation,
    refresh,
    reconnect,
  };
}

/**
 * Folds several read envelopes into one. The oldest revision wins, because a
 * view is only as current as its stalest part, and a disagreement between the
 * reads is itself a reason to call the view stale.
 */
export function mergeMeta(metas: Meta[]): Meta {
  if (metas.length === 0) {
    return {
      revision: 0,
      lastEventSequence: 0,
      generatedAt: new Date().toISOString(),
      stale: true,
    };
  }
  const oldest = metas.reduce((low, next) =>
    next.revision < low.revision ? next : low,
  );
  const disagree = metas.some((meta) => meta.revision !== oldest.revision);
  return {
    ...oldest,
    stale: disagree || metas.some((meta) => meta.stale),
  };
}

/**
 * The one-line freshness reading. Every figure on the view can be traced back
 * to the revision named here.
 */
export function FreshnessLine({
  meta,
  connection,
  connectionExplanation,
  onRefresh,
  refreshing,
  className,
}: {
  meta: Meta | null;
  connection: ConnectionState;
  connectionExplanation: string;
  onRefresh: () => void;
  refreshing: boolean;
  className?: string;
}) {
  const now = useNow();
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <ConnectionStatus state={connection} explanation={connectionExplanation} />
      <span
        className="font-chassis text-chassis-sm text-ink-3"
        title={meta ? absoluteTime(meta.generatedAt) : undefined}
      >
        {meta
          ? `Read ${relativeTime(meta.generatedAt, now).toLowerCase()} at database revision ${meta.revision}`
          : "Nothing has been read from the project database yet"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="gap-1.5"
      >
        <RefreshCw aria-hidden="true" />
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}
