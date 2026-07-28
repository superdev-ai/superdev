/**
 * Team And Agents.
 *
 * Answers one operational question before anything else: who is on which
 * branch, and what did they claim. That pairing is what stops two agents
 * editing the same thing at the same time, so it gets its own panel rather
 * than being buried inside the session list.
 *
 * A session that has been quiet for hours is a normal, healthy state. It is
 * labelled Idle and toned as idle, never as a fault, because "no activity for
 * a while" is what a finished piece of work looks like.
 *
 * Reads GET /api/team only. See docs/rebuild/MODULE_CONTRACT.md.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { ApiError, getTeam } from "@/lib/api";
import { useLive } from "@/lib/live";
import {
  absoluteTime,
  countPhrase,
  listPhrase,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { hrefFor, useRoute, type View } from "@/lib/route";
import { cn } from "@/lib/utils";
import type {
  Agent,
  Branch,
  Developer,
  Meta,
  PresenceEntry,
  SyncConflict,
  TeamPayload,
  WorkSession,
} from "@/types";

/* ---------------------------------------------------------------------------
   Payload shape
   --------------------------------------------------------------------------- */

/**
 * The service sends a few fields the shared contract types do not name yet.
 * They are declared here rather than read blind.
 */
type Session = WorkSession & { next_action?: string | null };

type Presence = PresenceEntry & {
  sessionId?: string | null;
  objective?: string | null;
};

type Conflict = SyncConflict & { detected_at?: string | null };

interface HandoffNote {
  sessionId: string;
  handoff: string | null;
  nextAction: string | null;
  outcome: string | null;
  endedAt: string | null;
}

type TeamData = Omit<TeamPayload, "sessions" | "presence" | "conflicts"> & {
  sessions: Session[];
  presence: Presence[];
  conflicts: Conflict[];
  handoffs?: HandoffNote[];
};

/* ---------------------------------------------------------------------------
   Vocabulary
   --------------------------------------------------------------------------- */

/** Presence is never a fault. Idle and Offline are both ordinary resting states. */
const PRESENCE_TONES: Record<string, StatusTone> = {
  live: "active",
  idle: "idle",
  offline: "idle",
};

const PRESENCE_MEANINGS: Record<string, string> = {
  live: "Activity was reported in the last few minutes.",
  idle: "No activity for a while. A session can sit idle for hours and still be perfectly healthy.",
  offline:
    "No activity for long enough that this session is treated as finished.",
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

const BRANCH_LABELS: Record<string, string> = {
  active: "Open",
  merged: "Merged",
  abandoned: "Abandoned",
};

const BRANCH_TONES: Record<string, StatusTone> = {
  active: "active",
  merged: "complete",
  abandoned: "retired",
};

/**
 * Where a conflicted record opens. Only record types whose view resolves the
 * identifier are listed; the column has no fixed vocabulary, so anything else
 * stays plain text rather than linking to a page that would ignore it.
 */
const CONFLICT_VIEWS: Record<string, View> = {
  task: "tasks",
  feature: "features",
  workflow: "workflows",
  data_entity: "data",
  decision: "decisions",
};

function key(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/* ---------------------------------------------------------------------------
   Reading the data
   --------------------------------------------------------------------------- */

interface Loaded {
  data: TeamData | null;
  meta: Meta | null;
  error: ApiError | null;
  loading: boolean;
}

function useTeam() {
  const { status, revision, reconnect } = useLive();
  const [token, setToken] = useState(0);
  const [state, setState] = useState<Loaded>({
    data: null,
    meta: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    getTeam(controller.signal)
      .then((result) => {
        setState({
          data: result.data as TeamData,
          meta: result.meta,
          error: null,
          loading: false,
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error:
            cause instanceof ApiError
              ? cause
              : new ApiError(
                  "E_UNEXPECTED",
                  "Something went wrong while reading the team data. Choose Retry, and check the service log if it happens again.",
                  500,
                ),
        }));
      });
    return () => controller.abort();
  }, [revision, token]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);
  return { ...state, connection: status, refresh, reconnect };
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

/**
 * Column headers for wide screens. Every row repeats the same labels for
 * assistive technology at every width, so this visual header is hidden from it.
 */
function HeadRow({
  columns,
  template,
}: {
  columns: string[];
  template: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "hidden gap-3 border-b border-rule-strong bg-panel-raised px-4 py-1.5 md:grid",
        template,
      )}
    >
      {columns.map((column) => (
        <span
          key={column}
          className="font-chassis text-label text-ink-3 uppercase"
        >
          {column}
        </span>
      ))}
    </div>
  );
}

/** One record: a stacked list of labelled pairs narrow, a dense grid wide. */
function Row({
  template,
  selected,
  children,
}: {
  template: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "grid gap-x-3 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0",
        "transition-colors duration-[120ms] ease-sd hover:bg-inset",
        "data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]",
        "md:items-baseline md:gap-y-1 md:py-2",
        template,
      )}
    >
      {children}
    </div>
  );
}

function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-2 md:block", className)}>
      <span className="w-28 shrink-0 font-chassis text-label text-ink-3 uppercase md:sr-only">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Since({
  value,
  fallback = "Nothing recorded",
}: {
  value: string | null | undefined;
  fallback?: string;
}) {
  if (!value) {
    return <span className="text-ink-3">{fallback}</span>;
  }
  return (
    <span className="text-ink-2" title={absoluteTime(value)}>
      {relativeTime(value)}
    </span>
  );
}

function TaskLink({ id }: { id: string | null | undefined }) {
  if (!id) {
    return <span className="text-ink-3">No task claimed</span>;
  }
  return (
    <a
      href={hrefFor("tasks", id)}
      aria-label={`Open task ${id} in the Tasks view`}
      className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
    >
      {id}
    </a>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-chassis text-label text-ink-3 uppercase">{label}</dt>
      <dd className="font-chassis text-chassis text-ink">{value}</dd>
    </div>
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
   Derivations
   --------------------------------------------------------------------------- */

interface Claim {
  sessionId: string;
  actorName: string;
  actorKind: string;
  taskId: string | null;
  objective: string | null;
  lastActivityAt: string | null;
}

interface BranchBoardEntry {
  branchId: string | null;
  branchName: string;
  branch: Branch | null;
  claims: Claim[];
  /** Two open sessions on one branch is the collision this panel exists for. */
  collision: boolean;
}

function agentName(agent: Agent | undefined, fallback: string): string {
  if (!agent) return fallback;
  const harness = titleCase(agent.harness);
  return agent.model_label ? `${agent.model_label} on ${harness}` : harness;
}

const PRESENCE_COLUMNS =
  "md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)]";
const BRANCH_COLUMNS =
  "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]";
const SESSION_COLUMNS =
  "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)]";
const CONFLICT_COLUMNS =
  "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.7fr)]";
const ROSTER_COLUMNS =
  "md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]";

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

export function TeamView() {
  const { data, meta, error, loading, connection, refresh, reconnect } =
    useTeam();
  const { route } = useRoute();
  const selected = route.record;
  const [allSessions, setAllSessions] = useState(false);

  /**
   * True when the deep link names one of these records. Comparing the route
   * against a nullable id directly would match null against null and light up
   * every row that happens to have no agent or no session.
   */
  const matches = useCallback(
    (...ids: (string | null | undefined)[]) =>
      selected !== null && ids.some((id) => id === selected),
    [selected],
  );

  const developers = useMemo(() => data?.developers ?? [], [data]);
  const agents = useMemo(() => data?.agents ?? [], [data]);
  const branches = useMemo(() => data?.branches ?? [], [data]);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const presence = data?.presence ?? [];
  const conflicts = data?.conflicts ?? [];

  const nameOfSession = useCallback(
    (session: Session): { name: string; kind: string } => {
      if (session.agent_id) {
        const agent = agents.find((item) => item.id === session.agent_id);
        return { name: agentName(agent, session.agent_id), kind: "Agent" };
      }
      if (session.developer_id) {
        const developer = developers.find(
          (item) => item.id === session.developer_id,
        );
        return {
          name: developer?.display_name ?? session.developer_id,
          kind: "Person",
        };
      }
      return { name: "Actor not recorded", kind: "Unknown" };
    },
    [agents, developers],
  );

  const board = useMemo<BranchBoardEntry[]>(() => {
    const open = sessions.filter(
      (session) => session.status === "active" || session.status === "compacted",
    );
    const claimsFor = (branchId: string | null): Claim[] =>
      open
        .filter((session) => (session.branch_id ?? null) === branchId)
        .map((session) => {
          const actor = nameOfSession(session);
          return {
            sessionId: session.id,
            actorName: actor.name,
            actorKind: actor.kind,
            taskId: session.active_task_id,
            objective: session.objective,
            lastActivityAt: session.last_activity_at ?? session.started_at,
          };
        });

    const entries: BranchBoardEntry[] = branches.map((branch) => {
      const claims = claimsFor(branch.id);
      return {
        branchId: branch.id,
        branchName: branch.name,
        branch,
        claims,
        collision:
          new Set(claims.map((claim) => claim.actorName)).size > 1 ||
          new Set(claims.map((claim) => claim.taskId).filter(Boolean)).size > 1,
      };
    });

    const unplaced = claimsFor(null);
    if (unplaced.length > 0) {
      entries.push({
        branchId: null,
        branchName: "No branch recorded",
        branch: null,
        claims: unplaced,
        collision: false,
      });
    }
    return entries;
  }, [branches, sessions, nameOfSession]);

  const handoffs = useMemo<HandoffNote[]>(() => {
    if (data?.handoffs && data.handoffs.length > 0) return data.handoffs;
    return sessions
      .filter((session) => Boolean(session.handoff))
      .map((session) => ({
        sessionId: session.id,
        handoff: session.handoff,
        nextAction: session.next_action ?? null,
        outcome: session.outcome,
        endedAt: session.ended_at,
      }));
  }, [data, sessions]);

  const selectionLabel = useMemo(() => {
    if (!selected) return null;
    const person = developers.find((item) => item.id === selected);
    if (person) return `${person.display_name} (${selected})`;
    const agent = agents.find((item) => item.id === selected);
    if (agent) return `${agentName(agent, selected)} (${selected})`;
    const branch = branches.find((item) => item.id === selected);
    if (branch) return `the branch ${branch.name}`;
    const session = sessions.find((item) => item.id === selected);
    if (session) return `session ${selected}`;
    return null;
  }, [selected, developers, agents, branches, sessions]);

  const running = sessions.filter((session) => session.status === "active");
  const shownSessions = allSessions ? sessions : sessions.slice(0, 12);

  /* ------------------------------------------------------------------ states */

  if (loading && !data) {
    return (
      <>
        <ViewHeader view="team" />
        <ViewBody>
          <Loading
            title="Loading the team"
            explanation="Reading developers, agents, branches and sessions from the project database on this machine. This normally takes well under a second."
            rows={5}
          />
        </ViewBody>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <ViewHeader view="team" />
        <ViewBody>
          {error?.isOffline ? (
            <Offline onReconnect={reconnect} state="offline" meta={meta} />
          ) : (
            <ErrorState
              title="The team data did not load"
              error={error}
              onRetry={refresh}
            />
          )}
        </ViewBody>
      </>
    );
  }

  /* ------------------------------------------------------------------- panels */

  return (
    <>
      <ViewHeader
        view="team"
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        }
      >
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <Reading
            label="People"
            value={countPhrase(developers.length, "developer")}
          />
          <Reading label="Agents" value={countPhrase(agents.length, "agent")} />
          <Reading
            label="Branches"
            value={countPhrase(branches.length, "branch", "branches")}
          />
          <Reading
            label="Sessions"
            value={`${countPhrase(running.length, "session")} running of ${countPhrase(
              sessions.length,
              "session",
            )} recorded`}
          />
          <Reading
            label="Conflicts"
            value={
              conflicts.length === 0
                ? "No conflicts open"
                : `${countPhrase(conflicts.length, "conflict")} open`
            }
          />
        </dl>
      </ViewHeader>

      <ViewBody>
        {connection.state === "offline" ? (
          <Offline
            state="offline"
            onReconnect={reconnect}
            meta={meta}
            density="inline"
            explanation="The live connection to the local Superdev service has dropped, so presence below has stopped updating on its own. Everything shown is the last data received."
          />
        ) : null}

        {error ? (
          <ErrorState
            title="The last refresh failed"
            explanation={`${error.message} The team data below is the last copy that arrived.`}
            error={error}
            onRetry={refresh}
            density="inline"
          />
        ) : null}

        {meta?.stale ? (
          <Stale
            meta={meta}
            onRefresh={refresh}
            showing={`${countPhrase(sessions.length, "session")} and ${countPhrase(
              branches.length,
              "branch",
              "branches",
            )}`}
          />
        ) : null}

        {selected ? (
          <div className="flex flex-wrap items-center gap-3 rounded-sd border border-signal-edge bg-signal-wash px-3 py-2">
            <span className="font-prose text-small text-ink">
              {selectionLabel
                ? `Highlighting ${selectionLabel} everywhere it appears below.`
                : `Nothing on this page matches ${selected}. It may belong to another project, or it may since have been removed.`}
            </span>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <a href={hrefFor("team")}>Clear the selection</a>
            </Button>
          </div>
        ) : null}

        {/* --------------------------------------------------------- presence */}
        <Panel
          id="presence"
          title="Who is working right now"
          reading={countPhrase(presence.length, "running session")}
          description="One line per running session. Idle means no activity has been reported for a while, which is a normal resting state and not a problem."
        >
          {presence.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="Nobody is working right now"
              explanation="No session has reported activity recently. A session appears here the moment a person or an agent starts work on this project on this machine."
              details={
                <span>
                  {countPhrase(sessions.length, "session")} recorded in total.
                  Finished sessions are listed further down this page.
                </span>
              }
              actions={[
                { label: "Refresh", onClick: refresh, icon: RefreshCw },
                { label: "See the work waiting", href: hrefFor("tasks") },
              ]}
            />
          ) : (
            <>
              <HeadRow
                template={PRESENCE_COLUMNS}
                columns={[
                  "Person or agent",
                  "Presence",
                  "Working on",
                  "Branch",
                  "Last activity",
                ]}
              />
              {presence.map((entry) => (
                <Row
                  key={entry.actorId}
                  template={PRESENCE_COLUMNS}
                  selected={matches(entry.actorId, entry.sessionId)}
                >
                  <Cell label="Person or agent">
                    <a
                      href={hrefFor("team", entry.actorId)}
                      className="rounded-sd-sm font-prose text-subtitle text-ink underline-offset-2 hover:underline focus-ring"
                    >
                      {entry.actorName}
                    </a>
                    <div className="font-chassis text-chassis-sm text-ink-3">
                      {entry.actorKind === "agent" ? "Agent" : "Person"},{" "}
                      {entry.actorId}
                    </div>
                    {entry.objective ? (
                      <Markdown measure={false}>{entry.objective}</Markdown>
                    ) : null}
                  </Cell>
                  <Cell label="Presence">
                    <Status
                      size="sm"
                      value={entry.presence}
                      tone={PRESENCE_TONES[key(entry.presence)] ?? "idle"}
                      label={titleCase(entry.presence)}
                      title={
                        PRESENCE_MEANINGS[key(entry.presence)] ??
                        "Presence as reported by the local service."
                      }
                    />
                  </Cell>
                  <Cell label="Working on">
                    <TaskLink id={entry.activeTaskId} />
                  </Cell>
                  <Cell label="Branch">
                    {entry.branchName ? (
                      <span className="font-chassis text-chassis-sm text-ink-2">
                        {entry.branchName}
                      </span>
                    ) : (
                      <span className="text-ink-3">No branch recorded</span>
                    )}
                  </Cell>
                  <Cell label="Last activity">
                    <Since value={entry.lastActivityAt} fallback="Never" />
                  </Cell>
                </Row>
              ))}
            </>
          )}
        </Panel>

        {/* --------------------------------------------------------- branches */}
        <Panel
          id="branches"
          title="Which branch each agent is on"
          reading={countPhrase(board.length, "branch", "branches")}
          description="What each open session claimed, next to the branch it claimed it on. Read this before starting work: it is what stops two agents changing the same thing at once."
        >
          {board.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No branches recorded yet"
              explanation="A branch is recorded the first time a session reports work on it. None has yet, so there is nothing here to collide over."
              actions={[{ label: "Refresh", onClick: refresh, icon: RefreshCw }]}
            />
          ) : (
            <>
              <HeadRow
                template={BRANCH_COLUMNS}
                columns={[
                  "Branch",
                  "Who is on it",
                  "What they claimed",
                  "Last seen",
                ]}
              />
              {board.map((entry) => (
                <Row
                  key={entry.branchId ?? "no-branch"}
                  template={BRANCH_COLUMNS}
                  selected={matches(entry.branchId)}
                >
                  <Cell label="Branch">
                    {entry.branchId ? (
                      <a
                        href={hrefFor("team", entry.branchId)}
                        className="rounded-sd-sm font-prose text-subtitle text-ink underline-offset-2 hover:underline focus-ring"
                      >
                        {entry.branchName}
                      </a>
                    ) : (
                      <span className="font-prose text-subtitle text-ink">
                        {entry.branchName}
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {entry.branch ? (
                        <Status
                          size="sm"
                          value={entry.branch.status}
                          tone={BRANCH_TONES[key(entry.branch.status)] ?? "idle"}
                          label={
                            BRANCH_LABELS[key(entry.branch.status)] ??
                            titleCase(entry.branch.status)
                          }
                        />
                      ) : null}
                      {entry.collision ? (
                        <Status
                          size="sm"
                          value="conflict"
                          tone="attention"
                          label="Two Claims At Once"
                        />
                      ) : null}
                    </div>
                    {entry.branch?.head_revision ? (
                      <div className="pt-1 font-chassis text-chassis-sm text-ink-3">
                        Head at {entry.branch.head_revision.slice(0, 12)}
                      </div>
                    ) : null}
                  </Cell>

                  <Cell label="Who is on it">
                    {entry.claims.length === 0 ? (
                      <span className="text-ink-3">
                        No session on this branch right now
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {entry.claims.map((claim) => (
                          <li key={claim.sessionId} className="min-w-0">
                            <span className="font-prose text-small text-ink">
                              {claim.actorName}
                            </span>{" "}
                            <span className="font-chassis text-chassis-sm text-ink-3">
                              {claim.actorKind}
                            </span>
                            {claim.objective ? (
                              <Markdown measure={false}>{claim.objective}</Markdown>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Cell>

                  <Cell label="What they claimed">
                    {entry.claims.length === 0 ? (
                      <span className="text-ink-3">Nothing claimed</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {entry.claims.map((claim) => (
                          <li key={claim.sessionId}>
                            <TaskLink id={claim.taskId} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Cell>

                  <Cell label="Last seen">
                    <Since
                      value={
                        entry.branch?.last_seen_at ??
                        entry.claims[0]?.lastActivityAt
                      }
                      fallback="Never"
                    />
                  </Cell>

                  {entry.collision ? (
                    <p className="flex items-start gap-2 rounded-sd border border-state-attention/45 bg-state-attention-wash px-2 py-1.5 font-prose text-small text-ink-2 md:col-span-4">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0 text-state-attention"
                      />
                      <span>
                        {listPhrase(entry.claims.map((claim) => claim.actorName))}{" "}
                        are working on {entry.branchName} at the same time. Agree
                        who owns which files, or move one of them onto a branch
                        of their own, before either one pushes.
                      </span>
                    </p>
                  ) : null}
                </Row>
              ))}
            </>
          )}
        </Panel>

        {/* --------------------------------------------------------- sessions */}
        <Panel
          id="sessions"
          title="Sessions"
          reading={`${countPhrase(shownSessions.length, "session")} shown of ${countPhrase(
            sessions.length,
            "session",
          )}`}
          description="Every stretch of work recorded on this project, newest first, with what it set out to do and how it ended."
        >
          {sessions.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No sessions recorded yet"
              explanation="A session is opened when a person or an agent starts work with Superdev on this project. None has been recorded, so there is no history to show yet."
              actions={[{ label: "Refresh", onClick: refresh, icon: RefreshCw }]}
            />
          ) : (
            <>
              <HeadRow
                template={SESSION_COLUMNS}
                columns={[
                  "Who",
                  "What it set out to do",
                  "Branch and task",
                  "Started",
                  "State",
                ]}
              />
              {shownSessions.map((session) => {
                const actor = nameOfSession(session);
                const actorId = session.agent_id ?? session.developer_id;
                const branch = branches.find(
                  (item) => item.id === session.branch_id,
                );
                return (
                  <Row
                    key={session.id}
                    template={SESSION_COLUMNS}
                    selected={matches(
                      session.id,
                      session.agent_id,
                      session.developer_id,
                    )}
                  >
                    <Cell label="Who">
                      <div className="font-prose text-subtitle text-ink">
                        {actorId ? (
                          <a
                            href={hrefFor("team", actorId)}
                            className="rounded-sd-sm underline-offset-2 hover:underline focus-ring"
                          >
                            {actor.name}
                          </a>
                        ) : (
                          actor.name
                        )}
                      </div>
                      <div className="font-chassis text-chassis-sm text-ink-3">
                        {actor.kind}, session{" "}
                        {/* Selects this session, which also picks out its
                            handoff note further down the page. */}
                        <a
                          href={hrefFor("team", session.id)}
                          className="rounded-sd-sm underline-offset-2 hover:underline focus-ring"
                        >
                          {session.id}
                        </a>
                      </div>
                    </Cell>
                    <Cell label="What it set out to do">
                      {session.objective ? (
                        <Markdown measure={false}>{session.objective}</Markdown>
                      ) : (
                        <span className="text-ink-3">
                          No objective was recorded for this session
                        </span>
                      )}
                      {session.outcome ? (
                        <p className="pt-1 font-prose text-small text-ink-2">
                          <span className="font-chassis text-label text-ink-3 uppercase">
                            Outcome
                          </span>{" "}
                          {session.outcome}
                        </p>
                      ) : null}
                      {session.next_action ? (
                        <p className="pt-1 font-prose text-small text-ink-2">
                          <span className="font-chassis text-label text-ink-3 uppercase">
                            Next
                          </span>{" "}
                          {session.next_action}
                        </p>
                      ) : null}
                    </Cell>
                    <Cell label="Branch and task">
                      <div className="font-chassis text-chassis-sm text-ink-2">
                        {branch ? (
                          <a
                            href={hrefFor("team", branch.id)}
                            className="rounded-sd-sm underline-offset-2 hover:underline focus-ring"
                          >
                            {branch.name}
                          </a>
                        ) : (
                          "No branch recorded"
                        )}
                      </div>
                      <div className="pt-0.5">
                        <TaskLink id={session.active_task_id} />
                      </div>
                    </Cell>
                    <Cell label="Started">
                      <Since value={session.started_at} />
                      <div className="pt-0.5 font-chassis text-chassis-sm text-ink-3">
                        {session.ended_at ? (
                          <span title={absoluteTime(session.ended_at)}>
                            Ended {relativeTime(session.ended_at).toLowerCase()}
                          </span>
                        ) : (
                          <span
                            title={absoluteTime(
                              session.last_activity_at ?? session.started_at,
                            )}
                          >
                            Last active{" "}
                            {relativeTime(
                              session.last_activity_at ?? session.started_at,
                            ).toLowerCase()}
                          </span>
                        )}
                      </div>
                    </Cell>
                    <Cell label="State">
                      <Status
                        size="sm"
                        value={session.status}
                        tone={SESSION_TONES[key(session.status)] ?? "idle"}
                        label={
                          SESSION_LABELS[key(session.status)] ??
                          titleCase(session.status)
                        }
                      />
                    </Cell>
                  </Row>
                );
              })}
              {sessions.length > 12 ? (
                <div className="border-t border-rule px-4 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllSessions((value) => !value)}
                  >
                    {allSessions
                      ? "Show only the twelve most recent sessions"
                      : `Show all ${countPhrase(sessions.length, "session")}`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Panel>

        {/* --------------------------------------------------------- handoffs */}
        <Panel
          id="handoffs"
          title="Handoffs"
          reading={countPhrase(handoffs.length, "handoff")}
          description="What one session left for the next one to pick up. A handoff is the only thing that survives a session ending, so it is worth reading before claiming anything."
        >
          {handoffs.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No handoffs left behind"
              explanation="No session has written a note for whoever comes next. That is expected while work is still running, and normal for a short session that finished what it started."
              actions={[{ label: "Refresh", onClick: refresh, icon: RefreshCw }]}
            />
          ) : (
            <ul className="flex flex-col">
              {handoffs.map((note) => (
                <li
                  key={note.sessionId}
                  data-selected={matches(note.sessionId) || undefined}
                  className="border-b border-rule px-4 py-3 last:border-b-0 data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-prose text-subtitle text-ink">
                      Left by session{" "}
                      {/* Picks out the row for that session in Sessions above. */}
                      <a
                        href={hrefFor("team", note.sessionId)}
                        className="rounded-sd-sm underline-offset-2 hover:underline focus-ring"
                      >
                        {note.sessionId}
                      </a>
                    </span>
                    <span
                      className="font-chassis text-chassis-sm text-ink-3"
                      title={absoluteTime(note.endedAt)}
                    >
                      {note.endedAt
                        ? `Ended ${relativeTime(note.endedAt).toLowerCase()}`
                        : "Still open"}
                    </span>
                  </div>
                  {note.handoff ? (
                    <Markdown>{note.handoff}</Markdown>
                  ) : null}
                  {note.outcome ? (
                    <p className="pt-1 font-prose text-small text-ink-2 prose-measure">
                      <span className="font-chassis text-label text-ink-3 uppercase">
                        Outcome
                      </span>{" "}
                      {note.outcome}
                    </p>
                  ) : null}
                  {note.nextAction ? (
                    <p className="pt-1 font-prose text-small text-ink-2 prose-measure">
                      <span className="font-chassis text-label text-ink-3 uppercase">
                        Next
                      </span>{" "}
                      {note.nextAction}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* -------------------------------------------------------- conflicts */}
        <Panel
          id="conflicts"
          title="Conflicts"
          reading={
            conflicts.length === 0
              ? "None open"
              : countPhrase(conflicts.length, "conflict")
          }
          description="A conflict is one record changed in two places without either change seeing the other. Until it is resolved, neither copy can be trusted as the answer."
        >
          {conflicts.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No conflicts"
              explanation="Nothing has been changed in two places at once. This is the state you want, and it needs no action from anyone."
            />
          ) : (
            <>
              <HeadRow
                template={CONFLICT_COLUMNS}
                columns={["Record", "What disagrees", "Detected", "State"]}
              />
              {conflicts.map((conflict) => (
                <Row
                  key={conflict.id}
                  template={CONFLICT_COLUMNS}
                  selected={selected === conflict.record_id}
                >
                  <Cell label="Record">
                    <div className="font-prose text-subtitle text-ink">
                      {titleCase(conflict.record_type)}
                    </div>
                    <div className="font-chassis text-chassis-sm text-ink-3">
                      {CONFLICT_VIEWS[key(conflict.record_type)] ? (
                        <a
                          href={hrefFor(
                            CONFLICT_VIEWS[key(conflict.record_type)],
                            conflict.record_id,
                          )}
                          className="rounded-sd-sm underline-offset-2 hover:underline focus-ring"
                        >
                          {conflict.record_id}
                        </a>
                      ) : (
                        conflict.record_id
                      )}
                    </div>
                  </Cell>
                  <Cell label="What disagrees">
                    <p className="font-prose text-small text-ink-2">
                      The copy on this machine is at version{" "}
                      {conflict.local_version}, the other copy is at version{" "}
                      {conflict.remote_version}
                      {conflict.base_version
                        ? `, and they last agreed at version ${conflict.base_version}`
                        : ", and no version they last agreed on was recorded"}
                      .
                    </p>
                    {conflict.resolution ? (
                      <p className="pt-1 font-prose text-small text-ink-2">
                        Resolved by keeping the {conflict.resolution} copy
                        {conflict.resolved_by
                          ? `, chosen by ${conflict.resolved_by}`
                          : ""}
                        .
                      </p>
                    ) : (
                      <p className="pt-1 font-prose text-small text-ink-3">
                        Nobody has chosen which copy wins yet.
                      </p>
                    )}
                  </Cell>
                  <Cell label="Detected">
                    <Since value={conflict.detected_at} />
                  </Cell>
                  <Cell label="State">
                    <Status
                      size="sm"
                      value={conflict.status}
                      tone={
                        key(conflict.status) === "resolved"
                          ? "complete"
                          : "blocked"
                      }
                      label={
                        key(conflict.status) === "resolved" ? "Resolved" : "Open"
                      }
                    />
                  </Cell>
                </Row>
              ))}
            </>
          )}
        </Panel>

        {/* ----------------------------------------------------------- roster */}
        <Panel
          id="roster"
          title="People and agents"
          reading={`${countPhrase(developers.length, "person", "people")} and ${countPhrase(
            agents.length,
            "agent",
          )}`}
          description="Everyone recorded on this project, whether they are working right now or not."
        >
          {developers.length === 0 && agents.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="Nobody is on this project yet"
              explanation="People and agents are recorded the first time they start a session here. Nothing has run against this project yet, so the roster is empty."
              actions={[{ label: "Refresh", onClick: refresh, icon: RefreshCw }]}
            />
          ) : (
            <>
              <HeadRow
                template={ROSTER_COLUMNS}
                columns={["Name", "Kind", "State", "Last seen"]}
              />
              {developers.map((developer: Developer) => (
                <Row
                  key={developer.id}
                  template={ROSTER_COLUMNS}
                  selected={selected === developer.id}
                >
                  <Cell label="Name">
                    <a
                      href={hrefFor("team", developer.id)}
                      className="rounded-sd-sm font-prose text-subtitle text-ink underline-offset-2 hover:underline focus-ring"
                    >
                      {developer.display_name}
                    </a>
                    <div className="font-chassis text-chassis-sm text-ink-3">
                      {developer.id}
                    </div>
                  </Cell>
                  <Cell label="Kind">
                    <span className="font-chassis text-chassis-sm text-ink-2">
                      Person
                    </span>
                  </Cell>
                  <Cell label="State">
                    <Status size="sm" value={developer.status} />
                  </Cell>
                  <Cell label="Last seen">
                    <span className="text-ink-3">
                      Tracked through their sessions
                    </span>
                  </Cell>
                </Row>
              ))}
              {agents.map((agent: Agent) => (
                <Row
                  key={agent.id}
                  template={ROSTER_COLUMNS}
                  selected={selected === agent.id}
                >
                  <Cell label="Name">
                    <a
                      href={hrefFor("team", agent.id)}
                      className="rounded-sd-sm font-prose text-subtitle text-ink underline-offset-2 hover:underline focus-ring"
                    >
                      {agentName(agent, agent.id)}
                    </a>
                    <div className="font-chassis text-chassis-sm text-ink-3">
                      {agent.id}
                    </div>
                  </Cell>
                  <Cell label="Kind">
                    <span className="font-chassis text-chassis-sm text-ink-2">
                      Agent on {titleCase(agent.harness)}
                    </span>
                  </Cell>
                  <Cell label="State">
                    <Status
                      size="sm"
                      value={agent.status}
                      tone={key(agent.status) === "active" ? "active" : "idle"}
                      label={titleCase(agent.status)}
                    />
                  </Cell>
                  <Cell label="Last seen">
                    <Since value={agent.last_seen_at} fallback="Never" />
                  </Cell>
                </Row>
              ))}
            </>
          )}
        </Panel>

        <MetaLine meta={meta} />
      </ViewBody>
    </>
  );
}
