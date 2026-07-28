/**
 * One read, its freshness, and the states that go with it.
 *
 * There is no data library. A view names the route it reads, the key that
 * identifies it and the live revision, and gets back the payload plus the
 * loading, error, offline and stale states that principle I of
 * DESIGN_DIRECTION.md requires it to render. Keeping the states here is what
 * stops one view quietly shipping a blank panel.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { ApiError } from "@/lib/api";
import { absoluteTime, relativeTime } from "@/lib/format";
import type { Meta, Result } from "@/types";

export interface Resource<T> {
  /** The last payload received, kept while a later read fails. */
  data: T | null;
  meta: Meta | null;
  error: ApiError | Error | null;
  loading: boolean;
  /** True when the failure was that the local service did not answer at all. */
  offline: boolean;
  reload: () => void;
}

/**
 * `key` identifies what is being read, for example "product" or
 * "feature:FEAT-0007". Changing it starts a new read. `revision` is the live
 * sequence, so a committed change refetches without a poll.
 */
export function useResource<T>(
  read: (signal: AbortSignal) => Promise<Result<T>>,
  key: string,
  revision: number,
): Resource<T> {
  const readRef = useRef(read);
  readRef.current = read;

  const [token, setToken] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    meta: Meta | null;
    error: ApiError | Error | null;
    loading: boolean;
  }>({ data: null, meta: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));
    readRef.current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          data: result.data,
          meta: result.meta,
          error: null,
          loading: false,
        });
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          error: failure as Error,
          loading: false,
        }));
      });
    return () => controller.abort();
  }, [key, revision, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);

  return {
    ...state,
    offline: state.error instanceof ApiError && state.error.isOffline,
    reload,
  };
}

/**
 * The blocking state, shown instead of the content: still loading with nothing
 * to show, failed with nothing to show, or the service is not answering.
 * Returns null once there is a payload, so the view renders itself.
 */
export function ResourceFallback({
  resource,
  subject,
  appears,
}: {
  resource: Resource<unknown>;
  /** What is being read, in plain language: "the product plan". */
  subject: string;
  /** What will be on screen once it arrives. */
  appears: string;
}) {
  if (resource.data !== null) return null;

  if (resource.offline) {
    return <Offline onReconnect={resource.reload} state="offline" />;
  }
  if (resource.error) {
    return (
      <ErrorState
        title={`${capitalise(subject)} did not load`}
        error={resource.error}
        onRetry={resource.reload}
      />
    );
  }
  return (
    <Loading
      title={`Loading ${subject}`}
      explanation={`Reading the project database on this machine. ${appears}`}
    />
  );
}

/**
 * The non-blocking banner, shown above content that did arrive: the read is
 * behind the database, or the stream has dropped and what is on screen is the
 * last data received.
 */
export function ResourceBanner({
  resource,
  showing,
}: {
  resource: Resource<unknown>;
  /** What is on screen despite the warning, e.g. "12 features". */
  showing?: string;
}) {
  if (resource.data === null) return null;

  if (resource.offline) {
    return (
      <Offline
        state="offline"
        density="inline"
        meta={resource.meta}
        onReconnect={resource.reload}
        explanation="The local Superdev service stopped answering, so everything below is the last data received rather than the current state of the project."
      />
    );
  }
  if (resource.error) {
    return (
      <ErrorState
        density="inline"
        title="The last refresh failed"
        error={resource.error}
        onRetry={resource.reload}
      />
    );
  }
  if (resource.meta?.stale) {
    return (
      <Stale meta={resource.meta} showing={showing} onRefresh={resource.reload} />
    );
  }
  return null;
}

/**
 * The freshness reading required by section 16.3: which database revision this
 * page was derived from, and how long ago that was.
 */
export function FreshnessNote({
  meta,
  className,
  prefix = "Read",
}: {
  meta: Meta | null;
  className?: string;
  prefix?: string;
}) {
  if (!meta) {
    return (
      <span className={className}>
        No reading has been taken from the project database yet.
      </span>
    );
  }
  return (
    <span className={className} title={absoluteTime(meta.generatedAt)}>
      {prefix} {relativeTime(meta.generatedAt).toLowerCase()}, from database
      revision {meta.revision} (last change {meta.lastEventSequence}).
    </span>
  );
}

/** A refresh control that says what it refreshes. */
export function RefreshLabel({ meta }: { meta: Meta | null }) {
  return (
    <>
      Refresh
      <span className="sr-only">
        {meta
          ? ` this page. It was read from database revision ${meta.revision}.`
          : " this page."}
      </span>
    </>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
