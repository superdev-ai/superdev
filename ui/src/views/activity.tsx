/**
 * Activity And Memory.
 *
 * Three readings of the same history: what changed and when, how each session
 * ended and what it handed on, and what the project remembers.
 *
 * The timeline is paged rather than loaded whole, grouped by day, and every
 * entry says who did what, when, in plain language, with a link to the record
 * it concerns. Memory entries always show how much they can be trusted and
 * always carry the reminder that recall has to be checked against the current
 * records before anything consequential is done with it.
 *
 * Reads GET /api/activity only. See docs/rebuild/MODULE_CONTRACT.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Circle,
  Code2,
  FilePlus2,
  FileText,
  Hand,
  LogIn,
  LogOut,
  OctagonX,
  PenLine,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Markdown } from "@/components/ui/markdown";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status, type StatusTone } from "@/components/shell/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, getActivity } from "@/lib/api";
import { useLive } from "@/lib/live";
import {
  absoluteTime,
  countPhrase,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { hrefFor, useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  ActivityPayload,
  MemoryEntry,
  Meta,
  Page,
  WorkSession,
} from "@/types";

/** How many events one page asks for. The service caps this at 500. */
const PAGE_SIZE = 50;

/* ---------------------------------------------------------------------------
   Payload shape
   --------------------------------------------------------------------------- */

/** Fields the service sends that the shared contract types do not name yet. */
type Event = ActivityEvent & {
  typeLabel?: string | null;
  actor_label?: string | null;
};

type Session = WorkSession & { next_action?: string | null };

type ActivityData = Omit<ActivityPayload, "events" | "sessions"> & {
  events: Event[];
  sessions: Session[];
};

/* ---------------------------------------------------------------------------
   Vocabulary
   --------------------------------------------------------------------------- */

/**
 * A glyph per event family. It is decoration only: the plain-language type is
 * always printed next to it, so nothing depends on recognising the shape.
 */
const EVENT_ICONS: Record<string, LucideIcon> = {
  task_created: FilePlus2,
  task_claimed: Hand,
  task_started: Play,
  task_updated: PenLine,
  task_blocked: OctagonX,
  task_unblocked: Play,
  task_released: Undo2,
  task_completed: CheckCircle2,
  task_reopened: RotateCcw,
  task_cancelled: Ban,
  verification_attached: ShieldCheck,
  decision_created: Scale,
  decision_transitioned: Scale,
  specification_changed: FileText,
  code_changed: Code2,
  session_started: LogIn,
  session_compacted: Archive,
  session_handed_off: ArrowRightLeft,
  session_ended: LogOut,
};

const SESSION_LABELS: Record<string, string> = {
  active: "Running",
  compacted: "Compacted",
  handed_off: "Handed Off",
  ended: "Finished",
};

const SESSION_TONES: Record<string, StatusTone> = {
  active: "active",
  compacted: "idle",
  handed_off: "idle",
  ended: "idle",
};

/** How far a memory entry can be trusted, said in words rather than a code. */
const EPISTEMIC_TONES: Record<string, StatusTone> = {
  confirmed: "complete",
  verified: "complete",
  stated: "idle",
  inferred: "idle",
  assumed: "attention",
  unknown: "attention",
  contradicted: "blocked",
  declined: "retired",
};

const EPISTEMIC_MEANINGS: Record<string, string> = {
  confirmed: "Checked against a record and found to hold.",
  verified: "Checked against evidence.",
  stated: "Somebody said it. Nothing has checked it.",
  inferred: "Worked out from other facts rather than stated directly.",
  assumed: "Taken as true without evidence. Check it before acting on it.",
  unknown: "Nobody has established whether this holds.",
  contradicted: "A later record disagrees with this.",
  declined: "Offered and turned down.",
};

const MEMORY_KIND_MEANINGS: Record<string, string> = {
  outcome: "What actually happened at the end of a piece of work.",
  decision: "A choice that was made. The binding record lives in Decisions.",
  learned_fact: "Something discovered about this project while working on it.",
  unresolved_question: "Something nobody has answered yet.",
  blocker: "Something that stopped work at the time.",
  handoff: "What one session left for the next one.",
  summary: "A condensed account of a longer stretch of work.",
};

function key(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/* ---------------------------------------------------------------------------
   Days
   --------------------------------------------------------------------------- */

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayLabel(value: string | null | undefined): string {
  if (!value) return "No date recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date recorded";
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return DAY_FORMAT.format(date);
}

function dayKey(value: string | null | undefined): string {
  if (!value) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : String(startOfDay(date));
}

/* ---------------------------------------------------------------------------
   Reading the data
   --------------------------------------------------------------------------- */

interface Loaded {
  events: Event[];
  memory: MemoryEntry[];
  sessions: Session[];
  page: Page | null;
  meta: Meta | null;
  error: ApiError | null;
  loading: boolean;
}

const EMPTY: Loaded = {
  events: [],
  memory: [],
  sessions: [],
  page: null,
  meta: null,
  error: null,
  loading: true,
};

/** Newest first, one entry per sequence, so a refresh cannot duplicate a row. */
function mergeEvents(existing: Event[], incoming: Event[]): Event[] {
  const merged = new Map<number, Event>();
  for (const event of existing) merged.set(event.sequence, event);
  for (const event of incoming) merged.set(event.sequence, event);
  return [...merged.values()].sort((a, b) => b.sequence - a.sequence);
}

function toApiError(cause: unknown, what: string): ApiError {
  return cause instanceof ApiError
    ? cause
    : new ApiError(
        "E_UNEXPECTED",
        `Something went wrong while ${what}. Try again, and check the service log if it happens again.`,
        500,
      );
}

function useActivity(search: string) {
  const { status, revision, reconnect } = useLive();
  const [token, setToken] = useState(0);
  const [state, setState] = useState<Loaded>(EMPTY);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  /** The search these events were fetched for, so a new one replaces them. */
  const appliedSearch = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));
    getActivity(
      { limit: PAGE_SIZE, search: search || undefined },
      controller.signal,
    )
      .then((result) => {
        const replace = appliedSearch.current !== search;
        appliedSearch.current = search;
        const payload = result.data as ActivityData;
        setState((previous) => ({
          events: replace
            ? payload.events
            : mergeEvents(previous.events, payload.events),
          memory: payload.memory ?? [],
          sessions: payload.sessions ?? [],
          page: payload.page ?? null,
          meta: result.meta,
          error: null,
          loading: false,
        }));
        setOlderError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: toApiError(cause, "reading the activity"),
        }));
      });
    return () => controller.abort();
  }, [revision, token, search]);

  const showOlder = useCallback(async () => {
    const cursor = state.page?.nextCursor;
    if (!cursor || olderBusy) return;
    setOlderBusy(true);
    setOlderError(null);
    try {
      const result = await getActivity({
        before: cursor,
        limit: PAGE_SIZE,
        search: search || undefined,
      });
      const payload = result.data as ActivityData;
      setState((previous) => ({
        ...previous,
        events: mergeEvents(previous.events, payload.events),
        page: payload.page ?? previous.page,
        meta: result.meta,
      }));
    } catch (cause: unknown) {
      setOlderError(toApiError(cause, "reading older activity").message);
    } finally {
      setOlderBusy(false);
    }
  }, [state.page, search, olderBusy]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);
  return {
    ...state,
    connection: status,
    refresh,
    reconnect,
    showOlder,
    olderBusy,
    olderError,
  };
}

/* ---------------------------------------------------------------------------
   Small shared pieces
   --------------------------------------------------------------------------- */

function Panel({
  id,
  title,
  reading,
  description,
  children,
}: {
  id: string;
  title: string;
  reading?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="overflow-hidden rounded-sd-lg border border-rule bg-panel"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-3">
        <h3 id={`${id}-title`} className="font-prose text-title text-ink">
          {title}
        </h3>
        {reading ? (
          <span className="font-chassis text-chassis-sm text-ink-3">
            {reading}
          </span>
        ) : null}
        {description ? (
          <p className="w-full font-prose text-small text-ink-2 prose-measure">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-chassis text-label text-ink-3 uppercase">
        {label}
      </span>
      <div className="min-w-0 font-prose text-small text-ink-2">{children}</div>
    </div>
  );
}

function RecordLink({
  view,
  id,
  label,
}: {
  view: Parameters<typeof hrefFor>[0];
  id: string;
  label?: string;
}) {
  return (
    <a
      href={hrefFor(view, id)}
      className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
    >
      {label ?? id}
    </a>
  );
}

function MetaLine({ meta }: { meta: Meta | null }) {
  if (!meta) return null;
  return (
    <p
      className="font-chassis text-chassis-sm text-ink-3"
      title={absoluteTime(meta.generatedAt)}
    >
      Read from database revision {meta.revision},{" "}
      {relativeTime(meta.generatedAt).toLowerCase()}.
    </p>
  );
}

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

type Tab = "timeline" | "sessions" | "memory";

export function ActivityView() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const {
    events,
    memory,
    sessions,
    page,
    meta,
    error,
    loading,
    connection,
    refresh,
    reconnect,
    showOlder,
    olderBusy,
    olderError,
  } = useActivity(search);
  const { route } = useRoute();
  const selected = route.record;
  const [tab, setTab] = useState<Tab>("timeline");
  const jumped = useRef<string | null>(null);

  // The search box is a filter, not a submit: apply it once typing settles.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  /** A deep link opens the tab that actually holds the record it names. */
  useEffect(() => {
    if (!selected || jumped.current === selected) return;
    if (memory.some((entry) => entry.id === selected)) {
      jumped.current = selected;
      setTab("memory");
      return;
    }
    if (sessions.some((session) => session.id === selected)) {
      jumped.current = selected;
      setTab("sessions");
      return;
    }
    if (events.some((event) => event.id === selected)) {
      jumped.current = selected;
      setTab("timeline");
    }
  }, [selected, memory, sessions, events]);

  /** Sessions carry actor ids only, so names are taken from their events. */
  const actorForSession = useMemo(() => {
    const names = new Map<string, string>();
    for (const event of events) {
      const name = event.actorName ?? event.actor_label ?? null;
      if (event.session_id && name && !names.has(event.session_id)) {
        names.set(event.session_id, name);
      }
    }
    return names;
  }, [events]);

  const days = useMemo(() => {
    const groups = new Map<string, Event[]>();
    for (const event of events) {
      const k = dayKey(event.created_at);
      const bucket = groups.get(k);
      if (bucket) bucket.push(event);
      else groups.set(k, [event]);
    }
    return [...groups.entries()].map(([k, list]) => ({
      key: k,
      label: dayLabel(list[0]?.created_at),
      events: list,
    }));
  }, [events]);

  const searching = search.length > 0;
  const notFound =
    selected !== null &&
    events.every((event) => event.id !== selected) &&
    memory.every((entry) => entry.id !== selected) &&
    sessions.every((session) => session.id !== selected);

  /* ------------------------------------------------------------------ states */

  if (loading && events.length === 0 && memory.length === 0 && !error) {
    return (
      <>
        <ViewHeader view="activity" />
        <ViewBody width="prose">
          <Loading
            title="Loading the activity"
            explanation="Reading the change timeline and project memory from the database on this machine. Only the most recent page is fetched, so this stays quick however long the history gets."
            rows={6}
          />
        </ViewBody>
      </>
    );
  }

  if (error && events.length === 0 && memory.length === 0) {
    return (
      <>
        <ViewHeader view="activity" />
        <ViewBody width="prose">
          {error.isOffline ? (
            <Offline onReconnect={reconnect} state="offline" meta={meta} />
          ) : (
            <ErrorState
              title="The activity did not load"
              error={error}
              onRetry={refresh}
            />
          )}
        </ViewBody>
      </>
    );
  }

  return (
    <>
      <ViewHeader
        view="activity"
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="activity-search"
              className="font-chassis text-label text-ink-3 uppercase"
            >
              Search
            </label>
            <div className="flex items-center gap-2">
              <Search aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
              <Input
                id="activity-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Words in an entry, for example blocked or provider"
                className="w-72 max-w-full"
                aria-describedby="activity-search-help"
              />
              {query ? (
                <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                  Clear
                </Button>
              ) : null}
            </div>
            <p
              id="activity-search-help"
              className="font-prose text-small text-ink-3 prose-measure"
            >
              Searches the timeline and project memory. Sessions are always
              listed in full.
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex flex-col gap-0.5">
              <dt className="font-chassis text-label text-ink-3 uppercase">
                Timeline
              </dt>
              <dd className="font-chassis text-chassis text-ink">
                {countPhrase(events.length, "entry", "entries")} loaded
                {page?.hasMore ? ", more available" : ""}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-chassis text-label text-ink-3 uppercase">
                Memory
              </dt>
              <dd className="font-chassis text-chassis text-ink">
                {countPhrase(memory.length, "entry", "entries")}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-chassis text-label text-ink-3 uppercase">
                Sessions
              </dt>
              <dd className="font-chassis text-chassis text-ink">
                {countPhrase(sessions.length, "session")}
              </dd>
            </div>
          </dl>
        </div>
      </ViewHeader>

      <ViewBody width="prose">
        {connection.state === "offline" ? (
          <Offline
            state="offline"
            onReconnect={reconnect}
            meta={meta}
            density="inline"
            explanation="The live connection to the local Superdev service has dropped, so new entries will not arrive on their own. Everything shown is the last data received."
          />
        ) : null}

        {error ? (
          <ErrorState
            title="The last refresh failed"
            explanation={`${error.message} The entries below are the last copy that arrived.`}
            error={error}
            onRetry={refresh}
            density="inline"
          />
        ) : null}

        {meta?.stale ? (
          <Stale
            meta={meta}
            onRefresh={refresh}
            showing={countPhrase(events.length, "entry", "entries")}
          />
        ) : null}

        {notFound ? (
          <div className="flex flex-wrap items-center gap-3 rounded-sd border border-state-attention/45 bg-state-attention-wash px-3 py-2">
            <span className="font-prose text-small text-ink-2">
              {selected} is not in the activity loaded so far. Show older
              activity until it appears, or clear the search if one is active.
            </span>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <a href={hrefFor("activity")}>Clear the selection</a>
            </Button>
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="timeline">What changed</TabsTrigger>
            <TabsTrigger value="sessions">Sessions and handoffs</TabsTrigger>
            <TabsTrigger value="memory">Project memory</TabsTrigger>
          </TabsList>

          {/* ----------------------------------------------------- timeline */}
          <TabsContent value="timeline">
            <Panel
              id="timeline"
              title="What changed"
              reading={`${countPhrase(events.length, "entry", "entries")} loaded`}
              description="Newest first, grouped by day. Evidence attached to a task appears here as a Verification Attached entry."
            >
              {events.length === 0 ? (
                <Empty
                  density="inline"
                  className="rounded-none border-0"
                  title={
                    searching
                      ? "Nothing in the timeline matches that search"
                      : "Nothing has happened on this project yet"
                  }
                  explanation={
                    searching
                      ? "The search runs over what each entry says and the kind of entry it is. A shorter word usually matches more."
                      : "An entry is written every time a record changes: a task claimed, a decision moved, evidence attached. None has been written yet."
                  }
                  details={
                    searching ? (
                      <span>Searched for "{search}" across every entry.</span>
                    ) : undefined
                  }
                  actions={
                    searching
                      ? [
                          { label: "Clear the search", onClick: () => setQuery("") },
                          { label: "Refresh", onClick: refresh, icon: RefreshCw },
                        ]
                      : [{ label: "Refresh", onClick: refresh, icon: RefreshCw }]
                  }
                />
              ) : (
                <>
                  {days.map((day) => (
                    <section key={day.key} aria-label={day.label}>
                      <h4 className="sticky top-12 z-10 flex flex-wrap items-baseline gap-x-3 border-b border-rule bg-panel-raised px-4 py-1.5 font-chassis text-label text-ink-3 uppercase">
                        <span className="text-ink-2">{day.label}</span>
                        <span>
                          {countPhrase(day.events.length, "entry", "entries")}
                        </span>
                      </h4>
                      <ul className="flex flex-col">
                        {day.events.map((event) => {
                          const Icon =
                            EVENT_ICONS[key(event.event_type)] ?? Circle;
                          const actor =
                            event.actorName ??
                            event.actor_label ??
                            event.actor_id ??
                            null;
                          return (
                            <li
                              key={event.id}
                              data-selected={
                                selected === event.id || undefined
                              }
                              className={cn(
                                "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-b border-rule px-4 py-2 last:border-b-0",
                                "transition-colors duration-[120ms] ease-sd hover:bg-inset",
                                "data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sd-sm border border-rule bg-inset text-ink-3"
                              >
                                <Icon className="size-3.5" />
                              </span>
                              <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                  <span className="font-chassis text-chassis-sm text-ink">
                                    {event.typeLabel ??
                                      titleCase(event.event_type)}
                                  </span>
                                  {/* The entry's own address. An event id is
                                      never printed, so the time it happened is
                                      what carries the link to it. */}
                                  <a
                                    href={hrefFor("activity", event.id)}
                                    className="rounded-sd-sm font-chassis text-chassis-sm text-ink-3 hover:text-signal focus-ring"
                                    title={absoluteTime(event.created_at)}
                                  >
                                    {relativeTime(event.created_at)}
                                  </a>
                                  <span className="font-prose text-small text-ink-3">
                                    {actor ? `by ${actor}` : "actor not recorded"}
                                  </span>
                                </div>
                                {/* Summary and its links share a line. A
                                    timeline is read by scanning, and a third
                                    row per entry turned twenty-nine entries
                                    into a page nobody scrolls to the end of. */}
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                  <Markdown>{event.summary}</Markdown>
                                  {event.task_id ? (
                                    <RecordLink
                                      view="tasks"
                                      id={event.task_id}
                                      label={`Task ${event.task_id}`}
                                    />
                                  ) : null}
                                  {event.feature_id ? (
                                    <RecordLink
                                      view="features"
                                      id={event.feature_id}
                                      label={`Feature ${event.feature_id}`}
                                    />
                                  ) : null}
                                  {event.session_id ? (
                                    <RecordLink
                                      view="activity"
                                      id={event.session_id}
                                      label={`Session ${event.session_id}`}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}

                  <div className="flex flex-col gap-2 border-t border-rule px-4 py-3">
                    {olderError ? (
                      <p
                        role="alert"
                        className="rounded-sd border border-state-blocked/45 bg-state-blocked-wash px-2 py-1.5 font-prose text-small text-ink-2 prose-measure"
                      >
                        {olderError}
                      </p>
                    ) : null}
                    {page?.hasMore ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={showOlder}
                          disabled={olderBusy}
                        >
                          {olderBusy
                            ? "Reading older activity"
                            : `Show ${PAGE_SIZE} older entries`}
                        </Button>
                        <span className="font-prose text-small text-ink-3">
                          {countPhrase(events.length, "entry", "entries")} loaded
                          so far. There is more history before this.
                        </span>
                      </div>
                    ) : (
                      <span className="font-prose text-small text-ink-3">
                        That is the whole history:{" "}
                        {countPhrase(events.length, "entry", "entries")}, back to
                        the first thing recorded on this project.
                      </span>
                    )}
                  </div>
                </>
              )}
            </Panel>
          </TabsContent>

          {/* ----------------------------------------------------- sessions */}
          <TabsContent value="sessions">
            <Panel
              id="sessions"
              title="Sessions and handoffs"
              reading={countPhrase(sessions.length, "session")}
              description="How each stretch of work ended, and what it left for whoever picks the project up next."
            >
              {sessions.length === 0 ? (
                <Empty
                  density="inline"
                  className="rounded-none border-0"
                  title="No sessions recorded yet"
                  explanation="A session is opened when a person or an agent starts work with Superdev on this project. None has been recorded, so there is nothing to report on."
                  actions={[
                    { label: "Refresh", onClick: refresh, icon: RefreshCw },
                    { label: "See who is working", href: hrefFor("team") },
                  ]}
                />
              ) : (
                <ul className="flex flex-col">
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      data-selected={selected === session.id || undefined}
                      className={cn(
                        "flex flex-col gap-2 border-b border-rule px-4 py-3 last:border-b-0",
                        "data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]",
                      )}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-prose text-subtitle text-ink">
                          {actorForSession.get(session.id) ??
                            "Actor not recorded on this session"}
                        </span>
                        <RecordLink
                          view="activity"
                          id={session.id}
                          label={`Session ${session.id}`}
                        />
                        <span
                          className="font-chassis text-chassis-sm text-ink-3"
                          title={absoluteTime(session.started_at)}
                        >
                          Started {relativeTime(session.started_at).toLowerCase()}
                        </span>
                        <div className="ml-auto">
                          <Status
                            size="sm"
                            value={session.status}
                            tone={SESSION_TONES[key(session.status)] ?? "idle"}
                            label={
                              SESSION_LABELS[key(session.status)] ??
                              titleCase(session.status)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                        <Field label="What it set out to do">
                          {session.objective ? (
                            <Markdown>{session.objective}</Markdown>
                          ) : (
                            <span className="text-ink-3">
                              No objective was recorded for this session.
                            </span>
                          )}
                        </Field>
                        <Field label="How it ended">
                          {session.outcome ? (
                            <Markdown>{session.outcome}</Markdown>
                          ) : session.ended_at ? (
                            <span className="text-ink-3">
                              It ended without an outcome being written down.
                            </span>
                          ) : (
                            <span className="text-ink-3">
                              Still running, so there is no outcome yet.
                            </span>
                          )}
                        </Field>
                        <Field label="Handed on">
                          {session.handoff ? (
                            <Markdown>{session.handoff}</Markdown>
                          ) : (
                            <span className="text-ink-3">
                              Nothing was handed on from this session.
                            </span>
                          )}
                        </Field>
                        <Field label="What should happen next">
                          {session.next_action ? (
                            <Markdown>{session.next_action}</Markdown>
                          ) : (
                            <span className="text-ink-3">
                              No next action was recorded.
                            </span>
                          )}
                        </Field>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {session.active_task_id ? (
                          <RecordLink
                            view="tasks"
                            id={session.active_task_id}
                            label={`Task ${session.active_task_id}`}
                          />
                        ) : (
                          <span className="font-prose text-small text-ink-3">
                            No task was claimed on this session.
                          </span>
                        )}
                        <span
                          className="font-chassis text-chassis-sm text-ink-3"
                          title={absoluteTime(
                            session.ended_at ?? session.last_activity_at,
                          )}
                        >
                          {session.ended_at
                            ? `Ended ${relativeTime(session.ended_at).toLowerCase()}`
                            : `Last active ${relativeTime(session.last_activity_at).toLowerCase()}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </TabsContent>

          {/* ------------------------------------------------------- memory */}
          <TabsContent value="memory">
            <Panel
              id="memory"
              title="Project memory"
              reading={countPhrase(memory.length, "entry", "entries")}
              description="What sessions wrote down so the next one does not start from nothing. Superseded entries are left out; each entry below is the current version."
            >
              <div className="flex items-start gap-3 border-b border-rule bg-state-attention-wash px-4 py-3">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-state-attention"
                />
                <div className="min-w-0">
                  <p className="font-chassis text-label text-ink uppercase">
                    Recall, not record
                  </p>
                  <p className="pt-1 font-prose text-small text-ink-2 prose-measure">
                    Memory is what somebody remembered at the time, not the
                    current state of the project. Before you act on anything
                    here in a way that is hard to undo, check it against the
                    record it refers to: the task, the feature or the decision.
                  </p>
                </div>
              </div>

              {memory.length === 0 ? (
                <Empty
                  density="inline"
                  className="rounded-none border-0"
                  title={
                    searching
                      ? "Nothing in memory matches that search"
                      : "Nothing has been remembered yet"
                  }
                  explanation={
                    searching
                      ? "The search runs over the title and the body of each entry. A shorter word usually matches more."
                      : "An entry is written when a session records an outcome, a fact it learned, a blocker or a handoff. No session has written one yet."
                  }
                  details={
                    searching ? (
                      <span>Searched for "{search}" across every entry.</span>
                    ) : undefined
                  }
                  actions={
                    searching
                      ? [
                          { label: "Clear the search", onClick: () => setQuery("") },
                          { label: "Refresh", onClick: refresh, icon: RefreshCw },
                        ]
                      : [{ label: "Refresh", onClick: refresh, icon: RefreshCw }]
                  }
                />
              ) : (
                <ul className="flex flex-col">
                  {memory.map((entry) => (
                    <li
                      key={entry.id}
                      data-selected={selected === entry.id || undefined}
                      className={cn(
                        "flex flex-col gap-2 border-b border-rule px-4 py-3 last:border-b-0",
                        "data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]",
                      )}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h4 className="font-prose text-subtitle text-ink">
                          {entry.title}
                        </h4>
                        <RecordLink view="activity" id={entry.id} />
                        <span
                          className="font-chassis text-chassis-sm text-ink-3"
                          title={absoluteTime(entry.created_at)}
                        >
                          {relativeTime(entry.created_at)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge title={MEMORY_KIND_MEANINGS[key(entry.kind)]}>
                          {titleCase(entry.kind)}
                        </Badge>
                        <Status
                          size="sm"
                          value={entry.epistemic_status}
                          tone={
                            EPISTEMIC_TONES[key(entry.epistemic_status)] ??
                            "attention"
                          }
                          label={titleCase(entry.epistemic_status)}
                          title={
                            EPISTEMIC_MEANINGS[key(entry.epistemic_status)] ??
                            "How far this entry can be trusted was not recorded."
                          }
                        />
                      </div>

                      <Markdown>{entry.content}</Markdown>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {entry.task_id ? (
                          <RecordLink
                            view="tasks"
                            id={entry.task_id}
                            label={`Task ${entry.task_id}`}
                          />
                        ) : null}
                        {entry.feature_id ? (
                          <RecordLink
                            view="features"
                            id={entry.feature_id}
                            label={`Feature ${entry.feature_id}`}
                          />
                        ) : null}
                        {entry.session_id ? (
                          <RecordLink
                            view="activity"
                            id={entry.session_id}
                            label={`Session ${entry.session_id}`}
                          />
                        ) : null}
                        {entry.source_ref ? (
                          <span className="font-chassis text-chassis-sm text-ink-3">
                            Source {entry.source_ref}
                          </span>
                        ) : null}
                      </div>

                      <p className="font-prose text-small text-ink-3 prose-measure">
                        Check this against the current record before acting on
                        it.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </TabsContent>
        </Tabs>

        <MetaLine meta={meta} />
      </ViewBody>
    </>
  );
}
