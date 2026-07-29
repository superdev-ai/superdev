/**
 * Overview: the briefing.
 *
 * It answers, in this order and in plain language: what are we building, where
 * are we now, what works, what is active, what is blocked or at risk, what
 * should happen next, and is this data current.
 *
 * Reads GET /api/overview. It also reads GET /api/product for one thing only,
 * the current milestone, because the overview payload does not carry it and a
 * briefing that cannot say which milestone we are in is not a briefing. That
 * second read is allowed to fail on its own without taking the page down.
 *
 * Layout follows DESIGN_DIRECTION.md section 8: one bordered region divided by
 * hairlines, not a wall of separate cards.
 */

import { AlertTriangle, ArrowRight, CheckCircle2, CircleCheck, CircleDot, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type * as React from "react";

import { RecordLink } from "@/components/product/panel";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Distribution, FigureRow, Meter, Trend, stateOf } from "@/components/shell/figures";
import { Markdown } from "@/components/ui/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressMeter } from "@/components/ui/progress";
import { ApiError, getOverview, getProduct } from "@/lib/api";
import {
  absoluteTime,
  countPhrase,
  formatNumber,
  relativeTime,
  titleCase,
  exitConditions,
} from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, type View } from "@/lib/route";
import type { ConnectionState } from "@/types";
import type {
  ActiveWorkItem,
  Freshness,
  Meta,
  Milestone,
  OverviewPayload,
  ScopeType,
} from "@/types";
import { cn } from "@/lib/utils";

/** A session that has not reported in for this long is no longer reporting. */
const HEARTBEAT_STALE_MS = 15 * 60 * 1000;

export function OverviewView() {
  const {
    overview,
    milestone,
    milestoneError,
    meta,
    error,
    loading,
    refresh,
  } = useOverviewData();
  const { status, reconnect } = useLive();

  const header = (
    <ViewHeader
      view="overview"
      description="What is being built, where it stands, what is moving, what is stuck, and what to do next."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw aria-hidden="true" />
          {loading ? "Reading" : "Refresh"}
        </Button>
      }
    />
  );

  if (!overview && loading) {
    return (
      <>
        {header}
        <ViewBody>
          <Loading
            title="Reading the project briefing"
            explanation="Fetching the product statement, progress, active work and freshness readings from the local Superdev service."
            rows={5}
          />
        </ViewBody>
      </>
    );
  }

  if (!overview && error) {
    return (
      <>
        {header}
        <ViewBody>
          {error instanceof ApiError && error.isOffline ? (
            <Offline onReconnect={refresh} state="offline" meta={meta} />
          ) : (
            <ErrorState
              title="The briefing did not load"
              error={error}
              onRetry={refresh}
            />
          )}
        </ViewBody>
      </>
    );
  }

  if (!overview) {
    return (
      <>
        {header}
        <ViewBody>
          <Empty
            title="There is no project on this machine yet"
            explanation="The service answered but returned no project. Run the Superdev setup in this directory to record what you are building, then come back here."
            actions={[{ label: "Check again", onClick: refresh }]}
          />
        </ViewBody>
      </>
    );
  }

  const warnings = alignmentWarnings(overview);

  return (
    <>
      {header}
      <ViewBody>
        {status.state !== "live" ? (
          <Offline
            state={status.state === "reconnecting" ? "reconnecting" : "offline"}
            onReconnect={reconnect}
            meta={meta}
            density="inline"
          />
        ) : null}

        {meta?.stale ? (
          <Stale
            meta={meta}
            onRefresh={refresh}
            showing="the briefing below"
          />
        ) : null}

        {error ? (
          <ErrorState
            title="The last refresh failed"
            error={error}
            onRetry={refresh}
            density="inline"
          />
        ) : null}

        {/*
          The shape, before the prose.

          Everything below this was here already and none of it changed: the seven
          questions still get their sections, in order, in the same words. What was
          missing was an answer to "how is this going" that does not require reading
          all seven top to bottom. This band is that answer, and it is deliberately
          three readings rather than a wall of tiles: what is finished, how the open
          work divides, and whether anything is moving. A fourth would compete with
          the three.
        */}
        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section
            heading="Where this stands"
            note="Each reading names what it counts, so the bar is a summary of the number beside it rather than a replacement for it."
          >
            <ShapeSection overview={overview} />
          </Section>
        </div>

        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section
            heading="What we are building"
            note="The product statement, in the words the project was set up with."
          >
            <BuildingSection overview={overview} />
          </Section>

          <Section
            heading="Where we are now"
            note="Progress is always a count of something real. Where no completion criteria have been agreed, this says Not measurable rather than a percentage that would not be true."
          >
            <WhereWeAreSection
              overview={overview}
              milestone={milestone}
              milestoneError={milestoneError}
              onRetryMilestone={refresh}
            />
          </Section>

          <Section heading="What works">
            <WhatWorksSection overview={overview} />
          </Section>

          <Section heading="What is active">
            <ActiveSection overview={overview} />
          </Section>

          <Section heading="What is blocked or at risk">
            <BlockedSection overview={overview} warnings={warnings} />
          </Section>

          <Section heading="What should happen next">
            <NextActionSection overview={overview} />
          </Section>
        </div>

        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section
            heading="Is this data current"
            note="Every reading below comes from the same response, so they describe one moment rather than several."
          >
            <FreshnessSection
              freshness={overview.freshness}
              meta={meta}
              connection={status.state}
              connectionExplanation={status.explanation}
            />
          </Section>
        </div>
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Data
   --------------------------------------------------------------------------- */

interface OverviewState {
  overview: OverviewPayload | null;
  milestone: Milestone | null;
  milestoneError: Error | null;
  meta: Meta | null;
  error: Error | null;
  loading: boolean;
}

/**
 * ponytail: this view owns its own live subscription because there is no shared
 * provider in the shell. Only one view is mounted at a time, so this is at most
 * one extra connection to the local service. Lift it into a context if several
 * mounted regions ever need the same stream.
 */
function useOverviewData() {
  const { revision } = useLive();
  const [token, setToken] = useState(0);
  const [state, setState] = useState<OverviewState>({
    overview: null,
    milestone: null,
    milestoneError: null,
    meta: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));

    Promise.allSettled([
      getOverview(controller.signal),
      getProduct(controller.signal),
    ]).then(([overviewResult, productResult]) => {
      if (controller.signal.aborted) return;

      setState((previous) => {
        const next: OverviewState = { ...previous, loading: false };

        if (overviewResult.status === "fulfilled") {
          next.overview = overviewResult.value.data;
          next.meta = overviewResult.value.meta;
          next.error = null;
        } else {
          next.error = asError(overviewResult.reason);
        }

        if (productResult.status === "fulfilled") {
          next.milestone = currentMilestone(productResult.value.data.milestones);
          next.milestoneError = null;
        } else {
          next.milestone = null;
          next.milestoneError = asError(productResult.reason);
        }

        return next;
      });
    });

    return () => controller.abort();
  }, [revision, token]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);

  return { ...state, refresh };
}

function asError(reason: unknown): Error {
  return reason instanceof Error
    ? reason
    : new Error(
        "Something went wrong reading the project database. Choose Retry, and check the service log if it happens again.",
      );
}

/**
 * The milestone we are in: the first one still being worked on, in sequence
 * order. If none is in flight, the earliest one not yet finished. If everything
 * is finished, the last one, so the page can say the plan is complete.
 */
function currentMilestone(milestones: Milestone[]): Milestone | null {
  if (!milestones || milestones.length === 0) return null;
  const ordered = [...milestones].sort(
    (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0),
  );
  const closed = new Set(["complete", "cancelled", "superseded"]);
  return (
    ordered.find((item) => item.status === "in_progress") ??
    ordered.find((item) => !closed.has(item.status)) ??
    ordered.at(-1) ??
    null
  );
}

/* ---------------------------------------------------------------------------
   Layout pieces
   --------------------------------------------------------------------------- */

function Section({
  heading,
  note,
  children,
}: {
  heading: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={heading}
      className="flex flex-col gap-3 border-b border-rule p-4 last:border-b-0 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-chassis text-label text-ink-3 uppercase">
          {heading}
        </h3>
        {note ? (
          <p className="font-prose text-small text-ink-3 prose-measure">
            {note}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled reading. The label is always present, so no value is naked. */
function Reading({
  label,
  children,
  title,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-chassis text-label text-ink-3 uppercase">{label}</dt>
      <dd
        className="min-w-0 font-chassis text-chassis text-ink break-words"
        title={title}
      >
        {children}
      </dd>
    </div>
  );
}

/** Used wherever the payload left something out that the product needs. */
function MissingNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5 font-prose text-small text-state-attention">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   What we are building
   --------------------------------------------------------------------------- */

/**
 * Three readings: what is finished, how open work divides, whether it is moving.
 *
 * The progress components come from the same payload the prose below reads, so the
 * two can never disagree. Each meter links to the area that holds the detail,
 * because a figure somebody cannot follow is a figure they have to trust.
 */
function ShapeSection({ overview }: { overview: OverviewPayload }) {
  const components = (overview.progress?.components ?? []).filter((c) => c.applies);
  const shape = (overview.taskShape ?? []).map((slice) => ({
    label: slice.label,
    count: slice.count,
    state: stateOf(slice.state),
    href: "#/tasks",
  }));

  return (
    <div className="flex flex-col gap-4">
      {components.length ? (
        <FigureRow>
          {components.map((component) => (
            <Meter
              key={component.name}
              label={component.name}
              done={component.done}
              total={component.total}
              unit={overview.progress?.counts ?? "item"}
              href={hrefForComponent(component.name)}
            />
          ))}
        </FigureRow>
      ) : (
        <p className="font-prose text-small text-ink-3 prose-measure">
          Nothing has been accepted yet, so there is no completion contract to
          measure against. Accept a feature and this fills in.
        </p>
      )}

      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <h4 className="font-chassis text-label text-ink-3 uppercase">How the work divides</h4>
          <Distribution
            slices={shape}
            caption="No task has been created yet, so there is no work to divide up. Derive tasks from an accepted feature and this fills in."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="font-chassis text-label text-ink-3 uppercase">Whether it is moving</h4>
          <Trend points={overview.activity ?? []} unit="recorded change" />
        </div>
      </div>
    </div>
  );
}

/** Which area holds the detail behind a progress component. */
function hrefForComponent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("feature")) return "#/features";
  if (n.includes("milestone") || n.includes("goal")) return "#/product";
  if (n.includes("task")) return "#/tasks";
  if (n.includes("document")) return "#/changes";
  if (n.includes("capability") || n.includes("module completeness")) return "#/readiness";
  if (n.includes("surface")) return "#/surfaces";
  return "#/readiness";
}

function BuildingSection({ overview }: { overview: OverviewPayload }) {
  const project = overview.project;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className="font-prose text-title text-ink">{project.name}</h4>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {project.id}
          </span>
        </div>
        <Status value={project.status} />
      </div>

      {project.statement ? (
        <Markdown>{project.statement}</Markdown>
      ) : (
        <MissingNote>
          No product statement has been recorded, so this page cannot say what
          the project is for. Add one in Discovery and it will appear here.
        </MissingNote>
      )}

      {project.problem ? (
        <p className="font-prose text-body text-ink-2 prose-measure">
          The problem it solves: {project.problem}
        </p>
      ) : (
        <p className="font-prose text-small text-ink-3 prose-measure">
          No problem statement has been recorded yet, so the reason this product
          exists is not written down anywhere the team can read it.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Reading label="Working mode">
          {project.working_mode ? (
            titleCase(project.working_mode)
          ) : (
            <span className="text-ink-3">Not set</span>
          )}
        </Reading>
        <Reading label="Documentation profile">
          {project.docs_profile ? (
            titleCase(project.docs_profile)
          ) : (
            <span className="text-ink-3">Not set</span>
          )}
        </Reading>
        <Reading label="Source of truth">
          {project.local_authority
            ? "This machine decides"
            : "A remote copy decides"}
        </Reading>
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Where we are now
   --------------------------------------------------------------------------- */

function WhereWeAreSection({
  overview,
  milestone,
  milestoneError,
  onRetryMilestone,
}: {
  overview: OverviewPayload;
  milestone: Milestone | null;
  milestoneError: Error | null;
  onRetryMilestone: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sd border border-rule bg-inset p-3">
        <h4 className="font-chassis text-label text-ink-3 uppercase">
          Current milestone
        </h4>
        <div className="pt-2">
          {milestoneError ? (
            <ErrorState
              title="The current milestone could not be read"
              explanation="The rest of this briefing is fine: only the milestone lookup failed. Choose Retry to try that read again."
              error={milestoneError}
              onRetry={onRetryMilestone}
              density="inline"
            />
          ) : milestone ? (
            <MilestoneReading milestone={milestone} />
          ) : (
            <Empty
              title="No milestone has been set"
              explanation="Milestones are what turn a list of features into a plan with an order. Until one exists this briefing can only report overall progress."
              actions={[{ label: "Open Product", href: hrefFor("product") }]}
              density="inline"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="font-chassis text-label text-ink-3 uppercase">
          Overall progress
        </h4>
        <ProgressMeter
          progress={overview.progress}
          qualifier="met"
          subject="This project"
          className="max-w-md"
        />
        {overview.progress?.sourceRevision !== undefined ? (
          <p className="font-chassis text-chassis-sm text-ink-3">
            Counted at database revision {overview.progress.sourceRevision}
            {overview.progress.computedAt
              ? `, ${relativeTime(overview.progress.computedAt).toLowerCase()}`
              : ""}
            .
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="font-chassis text-label text-ink-3 uppercase">
          Headline counts
        </h4>
        {overview.headline && overview.headline.length > 0 ? (
          <ul
            role="list"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {overview.headline.map((count) => {
              // The service sends the singular noun and this page agrees it
              // with the number. Printing the unit verbatim was how the page
              // came to read "1 features" and "1 tasks".
              const value = countPhrase(count.value, count.unit);
              const body = (
                <>
                  <span className="font-chassis text-title text-ink tabular-nums">
                    {value}
                  </span>
                  <span className="font-prose text-small text-ink-2">
                    {count.label}
                  </span>
                </>
              );
              return (
                <li key={`${count.label}-${count.unit}`}>
                  {count.href ? (
                    <a
                      href={count.href}
                      className="flex flex-col gap-0.5 rounded-sd border border-rule bg-inset p-3 transition-colors duration-[120ms] ease-sd hover:border-signal-edge hover:bg-signal-wash focus-ring"
                    >
                      {body}
                      <span className="inline-flex items-center gap-1 pt-1 font-chassis text-chassis-sm text-signal">
                        Open
                        <ArrowRight aria-hidden="true" className="size-3" />
                      </span>
                    </a>
                  ) : (
                    <div className="flex flex-col gap-0.5 rounded-sd border border-rule bg-inset p-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="No headline counts were returned"
            explanation="Headline counts summarise features, tasks and decisions. The service returned none, which usually means the project has no records to count yet."
            actions={[{ label: "Open Product", href: hrefFor("product") }]}
            density="inline"
          />
        )}
      </div>
    </div>
  );
}

function MilestoneReading({ milestone }: { milestone: Milestone }) {
  const exit = exitConditions(milestone.exit_conditions_json);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={hrefFor("product", milestone.id)}
            className="w-fit rounded-sd font-prose text-subtitle text-ink underline-offset-4 hover:underline focus-ring"
          >
            {milestone.name}
          </a>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {milestone.id}
          </span>
        </div>
        <Status value={milestone.status} size="sm" />
      </div>

      {milestone.outcome ? (
        <Markdown>{milestone.outcome}</Markdown>
      ) : (
        <MissingNote>
          This milestone does not say what it delivers, so there is no agreed
          test for calling it finished.
        </MissingNote>
      )}

      <ProgressMeter
        progress={milestone.progress}
        qualifier="met"
        subject="This milestone"
        className="max-w-md"
      />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Reading
          label="Target date"
          title={milestone.target_date ? absoluteTime(milestone.target_date) : undefined}
        >
          {milestone.target_date ? (
            `${absoluteTime(milestone.target_date)} (${relativeTime(milestone.target_date).toLowerCase()})`
          ) : (
            <span className="text-ink-3">No target date set</span>
          )}
        </Reading>
        <Reading label="Exit conditions">
          {exit.length > 0 ? (
            countPhrase(exit.length, "exit condition")
          ) : (
            <span className="text-ink-3">None recorded</span>
          )}
        </Reading>
      </dl>

      {exit.length > 0 ? (
        <ul
          role="list"
          className="flex flex-col gap-1 font-prose text-small text-ink-2 prose-measure"
        >
          {exit.map((entry) => (
            <li key={entry.condition} className="flex items-start gap-2">
              {/* A condition that has been judged says so, because the whole
                  point of recording the judgement was to make it readable. */}
              {entry.met === true ? (
                <CircleCheck aria-hidden="true" className="mt-1 size-3 shrink-0 text-state-complete" />
              ) : (
                <CircleDot aria-hidden="true" className="mt-1 size-3 shrink-0 text-ink-3" />
              )}
              <span>
                {entry.condition}
                {entry.reading ? (
                  <span className="text-ink-3"> {entry.reading}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   What works
   --------------------------------------------------------------------------- */

function WhatWorksSection({ overview }: { overview: OverviewPayload }) {
  const items = overview.whatWorks ?? [];

  if (items.length === 0) {
    return (
      <Empty
        title="Nothing is recorded as working yet"
        explanation="A capability appears here once its acceptance criteria are met and verification evidence is attached. Nothing has reached that point, which is normal early in a project."
        actions={[
          { label: "Open Features", href: hrefFor("features") },
          {
            label: "Open Tasks",
            href: hrefFor("tasks"),
            variant: "outline" as const,
          },
        ]}
        density="inline"
      />
    );
  }

  return (
    <>
      <p className="font-chassis text-chassis-sm text-ink-2">
        {countPhrase(items.length, "capability")} verified as working.
      </p>
      <ul role="list" className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 font-prose text-body text-ink-2"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-state-complete"
            />
            <Markdown measure={false}>{item}</Markdown>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------------------------------------------------------------------
   What is active
   --------------------------------------------------------------------------- */

function ActiveSection({ overview }: { overview: OverviewPayload }) {
  const items = overview.activeWork ?? [];

  if (items.length === 0) {
    return (
      <Empty
        title="Nothing is being worked on right now"
        explanation="No task is claimed and in progress. Pick up the next action below, or open Tasks to choose something else to start."
        actions={[{ label: "Open Tasks", href: hrefFor("tasks") }]}
        density="inline"
      />
    );
  }

  return (
    <>
      <p className="font-chassis text-chassis-sm text-ink-2">
        {countPhrase(items.length, "task")} in flight.
      </p>
      <ul role="list" className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.taskId}>
            <ActiveWorkRow item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

function ActiveWorkRow({ item }: { item: ActiveWorkItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-sd border border-rule bg-inset p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={hrefFor("tasks", item.taskId)}
            className="w-fit rounded-sd font-prose text-subtitle text-ink underline-offset-4 hover:underline focus-ring"
          >
            {item.taskName}
          </a>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {item.taskId}
          </span>
        </div>
        <Status value={item.status} size="sm" />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Reading label="Person or agent">
          {item.actor ?? (
            <span className="text-ink-3">Not claimed by anyone</span>
          )}
        </Reading>
        <Reading label="Branch">
          {item.branch ?? (
            <span className="text-ink-3">No branch recorded</span>
          )}
        </Reading>
        <Reading
          label="Started"
          title={item.startedAt ? absoluteTime(item.startedAt) : undefined}
        >
          {item.startedAt ? (
            relativeTime(item.startedAt)
          ) : (
            <span className="text-ink-3">Not started</span>
          )}
        </Reading>
        <Reading
          label="Last activity"
          title={
            item.lastActivityAt ? absoluteTime(item.lastActivityAt) : undefined
          }
        >
          {item.lastActivityAt ? (
            relativeTime(item.lastActivityAt)
          ) : (
            <span className="text-ink-3">Nothing reported yet</span>
          )}
        </Reading>
      </dl>

      <div className="font-prose text-small text-ink-2">
        {item.featureId ? (
          // Opens the feature this task moves, so its contract and acceptance
          // criteria are one click from the task that is in flight.
          <span className="inline-flex flex-wrap items-baseline gap-1.5">
            Part of
            <RecordLink
              name={item.featureName ?? "Name not returned with this briefing"}
              id={item.featureId}
              href={hrefFor("features", item.featureId)}
            />
          </span>
        ) : (
          <MissingNote>
            This task is not linked to any feature, so finishing it will not
            move any measured progress. Link it to a feature in Tasks.
          </MissingNote>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Blocked and at risk
   --------------------------------------------------------------------------- */

interface Warning {
  id: string;
  title: string;
  explanation: string;
  action: { label: string; href: string };
}

/**
 * Warnings the freshness readings imply. These are not failures of the service:
 * they are places where the record and the reality have drifted apart, and each
 * one names the single thing that closes the gap.
 */
function alignmentWarnings(overview: OverviewPayload): Warning[] {
  const freshness = overview.freshness;
  const warnings: Warning[] = [];
  if (!freshness) return warnings;

  if (freshness.staleEvidenceCount > 0) {
    warnings.push({
      id: "stale-evidence",
      title: `${countPhrase(freshness.staleEvidenceCount, "verification record")} ${freshness.staleEvidenceCount === 1 ? "has" : "have"} gone stale`,
      explanation:
        "The code moved on after these checks were recorded, so anything counted as working on their strength is no longer proven. Re-run the checks and attach fresh evidence.",
      action: { label: "Open Readiness", href: hrefFor("readiness") },
    });
  }

  if (freshness.pendingDocProposalCount > 0) {
    warnings.push({
      id: "doc-proposals",
      title: `${countPhrase(freshness.pendingDocProposalCount, "documentation change")} ${freshness.pendingDocProposalCount === 1 ? "is" : "are"} waiting for a decision`,
      explanation:
        "Someone edited generated documentation by hand. Superdev will not overwrite those edits, so the file and the database will stay out of step until each change is accepted or rejected.",
      action: { label: "Open Activity", href: hrefFor("activity") },
    });
  }

  if (!freshness.lastDocumentationGeneratedAt) {
    warnings.push({
      id: "docs-never",
      title: "Documentation has never been generated",
      explanation:
        "Everything on this page comes from the database. Nobody outside the control center can read any of it until the documentation is written out at least once.",
      action: { label: "Open Activity", href: hrefFor("activity") },
    });
  }

  const active = overview.activeWork ?? [];
  const heartbeat = freshness.activeSessionHeartbeatAt
    ? new Date(freshness.activeSessionHeartbeatAt).getTime()
    : null;
  const silent =
    heartbeat === null || Date.now() - heartbeat > HEARTBEAT_STALE_MS;
  if (active.length > 0 && silent) {
    warnings.push({
      id: "silent-session",
      title: `${countPhrase(active.length, "task")} marked active, but no session is reporting`,
      explanation:
        heartbeat === null
          ? "No work session has checked in at all, so the task may have been abandoned mid-flight. Release it or claim it again."
          : `The last session check-in was ${relativeTime(freshness.activeSessionHeartbeatAt).toLowerCase()}. Release the task or claim it again so the record matches who is actually working.`,
      action: { label: "Open Team And Agents", href: hrefFor("team") },
    });
  }

  return warnings;
}

function BlockedSection({
  overview,
  warnings,
}: {
  overview: OverviewPayload;
  warnings: Warning[];
}) {
  const blockers = overview.whatIsBlocked ?? [];

  if (blockers.length === 0 && warnings.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-sd border border-state-complete/45 bg-state-complete-wash p-3">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-state-complete"
        />
        <p className="font-prose text-body text-state-complete prose-measure">
          Nothing is blocked and no alignment warnings were raised at database
          revision {overview.freshness?.databaseRevision ?? 0}. Blockers appear
          here the moment a task is marked blocked or the record and the working
          tree drift apart.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h4 className="font-chassis text-label text-ink-3 uppercase">
          Blockers
        </h4>
        {blockers.length > 0 ? (
          <ul role="list" className="flex flex-col gap-2">
            {blockers.map((blocker) => (
              <li
                key={blocker}
                className="flex flex-wrap items-start justify-between gap-2 rounded-sd border border-state-blocked/45 bg-state-blocked-wash p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Status
                    value="blocked"
                    size="sm"
                    variant="inline"
                    label="Blocked"
                    className="shrink-0"
                  />
                  <span className="font-prose text-body text-ink prose-measure">
                    {blocker}
                  </span>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={hrefFor("tasks")}>Open Tasks</a>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-prose text-small text-ink-3 prose-measure">
            No task is blocked. The warnings below are about the record drifting
            from reality rather than work being stopped.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="font-chassis text-label text-ink-3 uppercase">
          Alignment warnings
        </h4>
        {warnings.length > 0 ? (
          <ul role="list" className="flex flex-col gap-2">
            {warnings.map((warning) => (
              <li
                key={warning.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-sd border border-state-attention/45 bg-state-attention-wash p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-state-attention"
                    />
                    <span className="font-prose text-subtitle text-ink">
                      {warning.title}
                    </span>
                  </div>
                  <Markdown>{warning.explanation}</Markdown>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={warning.action.href}>{warning.action.label}</a>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-prose text-small text-ink-3 prose-measure">
            None. The documentation, the evidence and the active sessions all
            agree with the database.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Next action
   --------------------------------------------------------------------------- */

/**
 * Fallback only: the service sends its own href for every next action it emits
 * today. There is deliberately no `project` entry, because Product resolves a
 * record as a goal, milestone or module and answers a project id with its
 * "nothing matches that link" banner.
 */
const TARGET_VIEWS: Record<string, View> = {
  goal: "product",
  milestone: "product",
  module: "product",
  feature: "features",
  workflow: "workflows",
  task: "tasks",
  decision: "decisions",
  question: "readiness",
};

function targetHref(
  targetType: ScopeType | null,
  targetId: string | null,
): string | null {
  if (!targetType) return null;
  const view = TARGET_VIEWS[targetType];
  if (!view) return null;
  return hrefFor(view, targetId);
}

function NextActionSection({ overview }: { overview: OverviewPayload }) {
  const next = overview.nextAction;

  if (!next) {
    return (
      <Empty
        title="No next action has been worked out"
        explanation="Superdev proposes the next action from ready tasks, unanswered questions and unmet acceptance criteria. It found none of those, so either the plan is finished or nothing has been planned yet."
        actions={[
          { label: "Open Tasks", href: hrefFor("tasks") },
          {
            label: "Open Readiness",
            href: hrefFor("readiness"),
            variant: "outline" as const,
          },
        ]}
        density="inline"
      />
    );
  }

  const href = next.href ?? targetHref(next.targetType, next.targetId);

  return (
    <div className="flex flex-col gap-3 rounded-sd border border-signal-edge bg-signal-wash p-3">
      <Markdown>{next.summary}</Markdown>
      <p className="font-prose text-body text-ink-2 prose-measure">
        Why this one: {next.reason}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {href ? (
          <Button asChild size="sm">
            <a href={href}>
              Go there
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <span className="font-prose text-small text-ink-2">
            This action is not attached to a record, so there is nothing to open.
          </span>
        )}
        {next.targetType ? (
          <Badge variant="outline">
            {titleCase(next.targetType)}
            {next.targetId ? ` ${next.targetId}` : ""}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Freshness
   --------------------------------------------------------------------------- */

function FreshnessSection({
  freshness,
  meta,
  connection,
  connectionExplanation,
}: {
  freshness: Freshness | null | undefined;
  meta: Meta | null;
  connection: ConnectionState;
  connectionExplanation: string;
}) {
  if (!freshness) {
    return (
      <Empty
        title="No freshness readings were returned"
        explanation="Without them this page cannot say how current anything above is. Treat everything above as unverified age until the service returns freshness again."
        density="inline"
      />
    );
  }

  const staleEvidence = freshness.staleEvidenceCount;
  const proposals = freshness.pendingDocProposalCount;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <Status value={connection} size="sm" />
        <p className="font-prose text-small text-ink-2 prose-measure">
          {connectionExplanation}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Reading label="Database revision">
          Revision {formatNumber(freshness.databaseRevision)}
        </Reading>
        <Reading label="Last event">
          Sequence {formatNumber(freshness.lastEventSequence)}
        </Reading>
        <Reading
          label="This page was read"
          title={meta ? absoluteTime(meta.generatedAt) : undefined}
        >
          {meta ? (
            `${relativeTime(meta.generatedAt)}, at revision ${formatNumber(meta.revision)}`
          ) : (
            <span className="text-ink-3">Not recorded</span>
          )}
        </Reading>
        <Reading
          label="Documentation last written"
          title={
            freshness.lastDocumentationGeneratedAt
              ? absoluteTime(freshness.lastDocumentationGeneratedAt)
              : undefined
          }
        >
          {freshness.lastDocumentationGeneratedAt ? (
            relativeTime(freshness.lastDocumentationGeneratedAt)
          ) : (
            <span className="text-state-attention">Never written</span>
          )}
        </Reading>
        <Reading
          label="Session heartbeat"
          title={
            freshness.activeSessionHeartbeatAt
              ? absoluteTime(freshness.activeSessionHeartbeatAt)
              : undefined
          }
        >
          {freshness.activeSessionHeartbeatAt ? (
            relativeTime(freshness.activeSessionHeartbeatAt)
          ) : (
            <span className="text-ink-3">No session is reporting</span>
          )}
        </Reading>
        <Reading label="Branch head">
          {freshness.branchHead ?? (
            <span className="text-ink-3">No branch recorded</span>
          )}
        </Reading>
        <Reading label="Stale evidence">
          <span
            className={cn(staleEvidence > 0 ? "text-state-attention" : undefined)}
          >
            {countPhrase(staleEvidence, "verification record")}
            {staleEvidence > 0 ? " to re-check" : " out of date"}
          </span>
        </Reading>
        <Reading label="Documentation proposals">
          <span className={cn(proposals > 0 ? "text-state-attention" : undefined)}>
            {countPhrase(proposals, "hand edit")} waiting for a decision
          </span>
        </Reading>
      </dl>

      <p className="font-prose text-small text-ink-3 prose-measure">
        The database revision and the last event sequence should match. When
        they do, everything above was true as of that revision. When they do
        not, the page is behind the database and the banner at the top of this
        view says so.
      </p>
    </div>
  );
}
