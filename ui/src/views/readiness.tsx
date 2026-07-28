/**
 * Readiness: what would stop this going to production.
 *
 * Reads GET /api/readiness and writes back through the one mutation the
 * contract allows here, question.answer.
 *
 * The organising idea is that a silent gap must be impossible to miss. Areas
 * nobody has decided on are listed first, not last. A capability ruled out or
 * postponed without a reason, an owner, a revisit trigger or a consequence is
 * called out in place rather than rendered as an empty cell. A module assessed
 * against only part of the twenty steps says which steps were never looked at.
 */

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  OctagonX,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type * as React from "react";

import { RecordName } from "@/components/product/panel";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Markdown } from "@/components/ui/markdown";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status, statusTone, type StatusTone } from "@/components/shell/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressMeter } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getReadiness, postMutation } from "@/lib/api";
import {
  countPhrase,
  formatNumber,
  ofPhrase,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute, type View } from "@/lib/route";
import type {
  CapabilityArea,
  CapabilityState,
  Meta,
  ModuleCompleteness,
  Question,
  ReadinessPayload,
  ReadinessRisk,
} from "@/types";
import { cn } from "@/lib/utils";

/** Section 8.2 of the specification: every module is assessed against twenty. */
const TOTAL_MODULE_STEPS = 20;

/**
 * The four states an area can be in, in the order the specification names them.
 * The summary strip uses this order. The detail below is ordered gaps first,
 * because an undecided area is the thing a person came to this page to find.
 */
const STATE_ORDER: CapabilityState[] = [
  "specified",
  "awaiting_decision",
  "not_applicable",
  "deferred",
];

const DETAIL_ORDER: CapabilityState[] = [
  "awaiting_decision",
  "deferred",
  "not_applicable",
  "specified",
];

const STATE_LABELS: Record<string, string> = {
  specified: "Specified",
  awaiting_decision: "Awaiting a Decision",
  not_applicable: "Not Applicable",
  deferred: "Deferred",
};

const STATE_MEANINGS: Record<string, string> = {
  specified:
    "Decided and written down. Nothing further is needed from the product side.",
  awaiting_decision:
    "Nobody has decided yet. Each one carries a question that has to be answered before this can ship.",
  not_applicable:
    "Ruled out deliberately. Each one has to say why, or it cannot be told apart from something simply forgotten.",
  deferred:
    "Postponed deliberately. Each one has to name an owner, what would bring it back, and what it costs to leave undone.",
};

const UNKNOWN_STATE_MEANING =
  "This is not one of the four states the specification defines. It is shown in full rather than hidden, because an unrecognised state is itself a gap.";

export function ReadinessView() {
  const { payload, meta, error, loading, refresh } = useReadinessData();
  const { status, reconnect } = useLive();
  const { route } = useRoute();
  const selected = route.record;
  const scrolledTo = useRef<string | null>(null);

  useEffect(() => {
    if (!selected || scrolledTo.current === selected) return;
    // The hash addresses either a capability area or an open question: the
    // overview links a question straight into this page.
    const element =
      document.getElementById(`area-${selected}`) ??
      document.getElementById(`question-${selected}`);
    if (!element) return;
    scrolledTo.current = selected;
    element.scrollIntoView({ block: "start" });
  }, [selected, payload]);

  const header = (
    <ViewHeader
      view="readiness"
      description="The production readiness checklist: what is settled, what nobody has decided, what was ruled out, what was postponed, and what still stands between this project and a release."
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

  if (!payload && loading) {
    return (
      <>
        {header}
        <ViewBody width="prose">
          <Loading
            title="Reading the readiness assessment"
            explanation="Fetching capability areas, module completeness, open questions and material risks from the local Superdev service."
            rows={6}
          />
        </ViewBody>
      </>
    );
  }

  if (!payload && error) {
    return (
      <>
        {header}
        <ViewBody width="prose">
          {error instanceof ApiError && error.isOffline ? (
            <Offline onReconnect={refresh} state="offline" meta={meta} />
          ) : (
            <ErrorState
              title="The readiness assessment did not load"
              error={error}
              onRetry={refresh}
            />
          )}
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        {header}
        <ViewBody width="prose">
          <Empty
            title="No readiness assessment exists yet"
            explanation="The service answered but returned nothing to assess. Readiness is built from the capability areas Superdev records during setup, so run the setup in this project and then come back."
            actions={[{ label: "Check again", onClick: refresh }]}
          />
        </ViewBody>
      </>
    );
  }

  const areas = payload.capabilityAreas ?? [];
  const questions = payload.openQuestions ?? [];
  const questionsById = new Map(questions.map((item) => [item.id, item]));
  const grouped = groupAreas(areas);
  const detailStates = DETAIL_ORDER.concat(
    [...grouped.keys()].filter((state) => !DETAIL_ORDER.includes(state)),
  ).filter((state) => (grouped.get(state) ?? []).length > 0);

  return (
    <>
      {header}
      <ViewBody width="prose">
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
            showing="the readiness assessment below"
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

        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section heading="Release readiness">
            <ReleaseReadiness payload={payload} meta={meta} />
          </Section>

          <Section
            heading="Capability areas"
            note="Areas nobody has decided on are shown first, because an undecided area is the one that will stop a release."
          >
            <AreaSummary areas={areas} grouped={grouped} />
          </Section>
        </div>

        {areas.length === 0 ? (
          <Empty
            title="No capability area has been assessed"
            explanation="Capability areas cover what every production system needs: sign in, permissions, error handling, observability, backups and the rest. None have been recorded, so this project has no readiness assessment at all."
            actions={[{ label: "Open Discovery", href: hrefFor("discovery") }]}
          />
        ) : (
          detailStates.map((state) => (
            <AreaGroup
              key={state}
              state={state}
              areas={grouped.get(state) ?? []}
              questionsById={questionsById}
              selected={selected}
              onAnswered={refresh}
            />
          ))
        )}

        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section
            heading="Module completeness"
            note="Every module is assessed against the same twenty steps. A module with fewer than twenty recorded has not been fully looked at, and this says which steps were skipped."
          >
            <ModuleCompletenessSection modules={payload.modules ?? []} />
          </Section>
        </div>

        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section
            heading="Open questions"
            note="Questions waiting on whoever owns the product. Answering one here records it against the project straight away."
          >
            <QuestionsSection
              questions={questions}
              selected={selected}
              onAnswered={refresh}
            />
          </Section>
        </div>

        <div className="overflow-hidden rounded-sd-lg border border-rule bg-panel">
          <Section heading="Material risks">
            <RisksSection
              risks={payload.risks ?? []}
              areaIds={new Set(areas.map((area) => area.id))}
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

interface ReadinessState {
  payload: ReadinessPayload | null;
  meta: Meta | null;
  error: Error | null;
  loading: boolean;
}

/**
 * ponytail: this view owns its own live subscription because the shell has no
 * shared provider. Only one view is mounted at a time, so it costs at most one
 * extra connection to a service running on this machine. Lift it into a context
 * if several mounted regions ever need the same stream.
 */
function useReadinessData() {
  const { revision } = useLive();
  const [token, setToken] = useState(0);
  const [state, setState] = useState<ReadinessState>({
    payload: null,
    meta: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));

    getReadiness(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          payload: result.data,
          meta: result.meta,
          error: null,
          loading: false,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          error:
            reason instanceof Error
              ? reason
              : new Error(
                  "Something went wrong reading the readiness assessment. Choose Retry, and check the service log if it happens again.",
                ),
          loading: false,
        }));
      });

    return () => controller.abort();
  }, [revision, token]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);

  return { ...state, refresh };
}

function groupAreas(areas: CapabilityArea[]) {
  const grouped = new Map<CapabilityState, CapabilityArea[]>();
  for (const state of STATE_ORDER) grouped.set(state, []);
  for (const area of areas) {
    const key = (area.state ?? "specified") as CapabilityState;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(area);
    else grouped.set(key, [area]);
  }
  return grouped;
}

function stateLabel(state: CapabilityState): string {
  return STATE_LABELS[state] ?? titleCase(state);
}

function stateMeaning(state: CapabilityState): string {
  return STATE_MEANINGS[state] ?? UNKNOWN_STATE_MEANING;
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

function Reading({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-chassis text-label text-ink-3 uppercase">{label}</dt>
      <dd className="min-w-0 font-prose text-small text-ink-2 break-words">
        {children}
      </dd>
    </div>
  );
}

/**
 * The one way a gap is drawn. Never an empty cell, never a dash: a sentence
 * saying what is missing and why that matters.
 */
function Gap({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5 font-prose text-small text-state-attention">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Release readiness
   --------------------------------------------------------------------------- */

function ReleaseReadiness({
  payload,
  meta,
}: {
  payload: ReadinessPayload;
  meta: Meta | null;
}) {
  const release = payload.releaseReadiness;

  if (!release) {
    return (
      <Empty
        title="No release verdict was returned"
        explanation="Without a verdict this page cannot say whether the project could ship. Everything below still holds: read the capability areas and the risks and draw your own conclusion."
        density="inline"
      />
    );
  }

  const blockers = release.blockers ?? [];
  const clear = blockers.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-sd border p-3",
        clear
          ? "border-state-complete/45 bg-state-complete-wash"
          : "border-state-blocked/45 bg-state-blocked-wash",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Markdown>{release.verdict}</Markdown>
        <Status
          value={clear ? "complete" : "blocked"}
          size="sm"
          label={clear ? "Clear To Proceed" : "Blocked"}
        />
      </div>

      <Markdown>{release.explanation}</Markdown>

      {blockers.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="font-chassis text-label text-ink-3 uppercase">
            {countPhrase(blockers.length, "blocker")} in the way
          </h4>
          <ul role="list" className="flex flex-col gap-1.5">
            {blockers.map((blocker) => (
              <li
                key={blocker}
                className="flex items-start gap-2 font-prose text-body text-ink prose-measure"
              >
                <OctagonX
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-state-blocked"
                />
                <span>{blocker}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-2 font-prose text-body text-ink prose-measure">
          <CheckCircle2
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-state-complete"
          />
          <span>
            No blocker is recorded against a release. That is a statement about
            what has been assessed, not a promise about what has not.
          </span>
        </p>
      )}

      <ProgressMeter
        progress={payload.progress}
        qualifier="addressed"
        subject="Production readiness"
        className="max-w-md"
      />

      {meta ? (
        <p className="font-chassis text-chassis-sm text-ink-3">
          Assessed at database revision {formatNumber(meta.revision)}, read{" "}
          {relativeTime(meta.generatedAt).toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Capability areas
   --------------------------------------------------------------------------- */

function AreaSummary({
  areas,
  grouped,
}: {
  areas: CapabilityArea[];
  grouped: Map<CapabilityState, CapabilityArea[]>;
}) {
  const states = STATE_ORDER.concat(
    [...grouped.keys()].filter((state) => !STATE_ORDER.includes(state)),
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="font-chassis text-chassis-sm text-ink-2">
        {countPhrase(areas.length, "capability area")} assessed in total.
      </p>
      <ul
        role="list"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        {states.map((state) => {
          const count = (grouped.get(state) ?? []).length;
          return (
            <li
              key={state}
              className="flex flex-col gap-1 rounded-sd border border-rule bg-inset p-3"
            >
              <Status value={state} size="sm" label={stateLabel(state)} />
              <span className="font-chassis text-title text-ink tabular-nums">
                {countPhrase(count, "area")}
              </span>
              <p className="font-prose text-small text-ink-3">
                {stateMeaning(state)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AreaGroup({
  state,
  areas,
  questionsById,
  selected,
  onAnswered,
}: {
  state: CapabilityState;
  areas: CapabilityArea[];
  questionsById: Map<string, Question>;
  /** The area addressed by the hash, so a link into this page marks its row. */
  selected: string | null;
  onAnswered: () => void;
}) {
  const label = stateLabel(state);
  const tone = statusTone(state);

  return (
    <section
      aria-label={`Capability areas: ${label}`}
      className="overflow-hidden rounded-sd-lg border border-rule bg-panel"
    >
      <div className="flex flex-col gap-1.5 border-b border-rule bg-panel-raised p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Status value={state} label={label} tone={tone} />
          <span className="font-chassis text-chassis-sm text-ink-2">
            {countPhrase(areas.length, "area")}
          </span>
        </div>
        <p className="font-prose text-small text-ink-2 prose-measure">
          {stateMeaning(state)}
        </p>
      </div>

      <ul role="list" className="flex flex-col">
        {areas.map((area) => (
          <li
            key={area.id}
            id={`area-${area.id}`}
            data-selected={selected === area.id || undefined}
            className="border-b border-rule last:border-b-0 data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]"
          >
            <AreaRow
              area={area}
              tone={tone}
              questionsById={questionsById}
              onAnswered={onAnswered}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Fields the service sends that the shared contract type does not name yet. */
type Area = CapabilityArea & { decisionId?: string | null };

function AreaRow({
  area,
  tone,
  questionsById,
  onAnswered,
}: {
  area: Area;
  tone: StatusTone;
  questionsById: Map<string, Question>;
  onAnswered: () => void;
}) {
  const isDeferred = area.state === "deferred";
  const isNotApplicable = area.state === "not_applicable";
  const isAwaiting = area.state === "awaiting_decision";
  const needsReason = isDeferred || isNotApplicable;
  const linked = (area.questionIds ?? [])
    .map((id) => questionsById.get(id))
    .filter((question): question is Question => Boolean(question));
  // A question that has been answered or withdrawn leaves the open list, so the
  // area's own question id is reported rather than dropped. An area that says
  // nobody was ever asked, when a question exists, is the silent gap this page
  // is built to prevent.
  const unresolved = (area.questionIds ?? []).filter(
    (id) => !questionsById.has(id),
  );

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="font-prose text-subtitle text-ink">{area.name}</h4>
          {/* The area's own address on this page, to bookmark or send on. */}
          <a
            href={hrefFor("readiness", area.id)}
            className="w-fit rounded-sd-sm font-chassis text-chassis-sm text-ink-3 hover:text-signal focus-ring"
          >
            {area.id}
          </a>
        </div>
        <Status
          value={area.state}
          size="sm"
          label={stateLabel(area.state)}
          tone={tone}
        />
      </div>

      {area.reason ? (
        <p className="font-prose text-body text-ink-2 prose-measure">
          {isDeferred
            ? "Postponed because: "
            : isNotApplicable
              ? "Ruled out because: "
              : ""}
          {area.reason}
        </p>
      ) : needsReason ? (
        <Gap>
          No reason is recorded. A capability marked {stateLabel(area.state)}{" "}
          without a reason cannot be told apart from one that was simply
          forgotten. Record why before treating it as settled.
        </Gap>
      ) : null}

      {area.decisionId ? (
        <p className="font-prose text-small text-ink-2">
          Settled by decision{" "}
          <a
            href={hrefFor("decisions", area.decisionId)}
            className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
          >
            {area.decisionId}
          </a>
          .
        </p>
      ) : null}

      {isDeferred ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Reading label="Owner">
            {area.owner ?? (
              <Gap>
                Nobody owns this. A postponed capability with no owner does not
                come back on its own.
              </Gap>
            )}
          </Reading>
          <Reading label="What brings it back">
            {area.revisitTrigger ?? (
              <Gap>
                No revisit trigger is recorded, so no event would ever cause
                this to be reconsidered.
              </Gap>
            )}
          </Reading>
          <Reading label="Cost of leaving it">
            {area.consequence ?? (
              <Gap>
                The cost of shipping without this is not written down, so
                nobody can weigh the decision.
              </Gap>
            )}
          </Reading>
        </dl>
      ) : area.owner || area.consequence ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {area.owner ? <Reading label="Owner">{area.owner}</Reading> : null}
          {area.consequence ? (
            <Reading label="Cost of leaving it">{area.consequence}</Reading>
          ) : null}
        </dl>
      ) : null}

      {isAwaiting ? (
        linked.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h5 className="font-chassis text-label text-ink-3 uppercase">
              {countPhrase(linked.length, "question")} to answer
            </h5>
            {linked.map((question) => (
              <QuestionPanel
                key={question.id}
                question={question}
                onAnswered={onAnswered}
              />
            ))}
          </div>
        ) : unresolved.length > 0 ? (
          <Gap>
            This area is waiting on a decision, and every question recorded
            against it ({unresolved.join(", ")}) has been answered or withdrawn
            without the area being moved on. Settle the area, or raise the
            question again.
          </Gap>
        ) : (
          <Gap>
            This area is waiting on a decision, but no question has been written
            for it. Nobody can answer what has not been asked: write the
            question in Discovery so it reaches whoever owns the product.
          </Gap>
        )
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Module completeness
   --------------------------------------------------------------------------- */

function ModuleCompletenessSection({
  modules,
}: {
  modules: ModuleCompleteness[];
}) {
  if (modules.length === 0) {
    return (
      <Empty
        title="No module has been assessed"
        explanation="Module completeness walks each module through the same twenty steps, from its purpose through to how it is observed in production. No module has been through any of them, so nothing about completeness is known."
        actions={[{ label: "Open Product", href: hrefFor("product") }]}
        density="inline"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-chassis text-chassis-sm text-ink-2">
        {countPhrase(modules.length, "module")} assessed.
      </p>
      <div className="flex flex-col gap-2">
        {modules.map((module) => (
          <ModuleRow key={module.moduleId} module={module} />
        ))}
      </div>
    </div>
  );
}

function ModuleRow({ module }: { module: ModuleCompleteness }) {
  const steps = [...(module.steps ?? [])].sort((a, b) => a.step - b.step);
  const recorded = new Set(steps.map((step) => step.step));
  const missing: number[] = [];
  for (let step = 1; step <= TOTAL_MODULE_STEPS; step += 1) {
    if (!recorded.has(step)) missing.push(step);
  }
  const unsettled =
    steps.filter((step) => step.state !== "specified").length + missing.length;
  // A module with a gap opens itself, but a person who closes it stays closed.
  const [open, setOpen] = useState(unsettled > 0);

  return (
    <details
      className="group overflow-hidden rounded-sd border border-rule bg-inset"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3 transition-colors duration-[120ms] ease-sd hover:bg-panel-raised focus-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-3 transition-transform duration-[180ms] ease-sd group-open:rotate-90"
        />
        {/* Opens the module itself, in Product. */}
        <RecordName
          name={module.moduleName}
          id={module.moduleId}
          href={hrefFor("product", module.moduleId)}
          className="min-w-0"
        />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {ofPhrase(steps.length, TOTAL_MODULE_STEPS, "step", "recorded")}
          </Badge>
          {unsettled > 0 ? (
            <Status
              value="awaiting_decision"
              tone="attention"
              size="sm"
              label={`${countPhrase(unsettled, "step")} unsettled`}
            />
          ) : (
            <Status
              value="specified"
              size="sm"
              label="All Twenty Steps Specified"
            />
          )}
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-rule p-3">
        <ProgressMeter
          progress={module.progress}
          qualifier="specified"
          subject="This module"
          className="max-w-md"
        />

        {steps.length > 0 ? (
          <ul
            role="list"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
          >
            {steps.map((step) => (
              <li
                key={`${module.moduleId}-${step.step}`}
                className="flex flex-col gap-1.5 rounded-sd border border-rule bg-panel p-2.5"
              >
                <p className="font-prose text-small text-ink">
                  <span className="font-chassis text-chassis-sm text-ink-3">
                    Step {step.step} of {TOTAL_MODULE_STEPS}.{" "}
                  </span>
                  {step.name}
                </p>
                <Status
                  value={step.state}
                  size="sm"
                  label={stateLabel(step.state)}
                />
                {step.reason ? (
                  <Markdown measure={false}>{step.reason}</Markdown>
                ) : step.state === "not_applicable" ||
                  step.state === "deferred" ? (
                  <Gap>No reason recorded for setting this step aside.</Gap>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-prose text-body text-ink-2 prose-measure">
            None of the twenty steps have been recorded for this module, so
            nothing about its completeness is known.
          </p>
        )}

        {missing.length > 0 ? (
          <Gap>
            {countPhrase(missing.length, "step")} of the twenty were never
            assessed for this module:{" "}
            {missing.map((step) => `Step ${step}`).join(", ")}. An unassessed
            step is not a passed step.
          </Gap>
        ) : (
          <p className="font-chassis text-chassis-sm text-ink-3">
            All twenty steps have been assessed for this module.
          </p>
        )}
      </div>
    </details>
  );
}

/* ---------------------------------------------------------------------------
   Questions
   --------------------------------------------------------------------------- */

function QuestionsSection({
  questions,
  selected,
  onAnswered,
}: {
  questions: Question[];
  /** The question addressed by the hash, which the overview links here. */
  selected: string | null;
  onAnswered: () => void;
}) {
  if (questions.length === 0) {
    return (
      <Empty
        title="No question is waiting on you"
        explanation="Every question raised against this project has been answered. New ones appear here the moment Superdev meets something it cannot decide on its own."
        actions={[{ label: "Open Discovery", href: hrefFor("discovery") }]}
        density="inline"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-chassis text-chassis-sm text-ink-2">
        {countPhrase(questions.length, "question")} waiting for an answer.
      </p>
      {questions.map((question) => (
        <QuestionPanel
          key={question.id}
          question={question}
          // Only this copy carries the address. The same panel is rendered
          // again inline under the capability area waiting on it, and two
          // elements cannot share one id.
          anchorId={`question-${question.id}`}
          selected={selected === question.id}
          onAnswered={onAnswered}
        />
      ))}
    </div>
  );
}

/** Where each kind of scope has its own page. Anything else stays plain text. */
const SCOPE_VIEWS: Record<string, View> = {
  goal: "product",
  milestone: "product",
  module: "product",
  feature: "features",
  workflow: "workflows",
  task: "tasks",
};

function scopePhrase(question: Question): React.ReactNode {
  const type = question.scope_type ?? "project";
  const scope = type.replace(/_/g, " ");
  if (type === "project") return "About the project as a whole";
  if (!question.scope_id) return `About every ${scope}`;
  const view = SCOPE_VIEWS[type];
  if (!view) return `About the ${scope} ${question.scope_id}`;
  return (
    <span>
      About the {scope}{" "}
      <a
        href={hrefFor(view, question.scope_id)}
        className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
      >
        {question.scope_id}
      </a>
    </span>
  );
}

function QuestionPanel({
  question,
  anchorId,
  selected,
  onAnswered,
}: {
  question: Question;
  anchorId?: string;
  selected?: boolean;
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Error | null>(null);
  const alternatives = question.alternatives_json ?? [];
  // An unresolved question appears twice on this page: inline under the
  // capability area waiting on it, and again in Open questions. Deriving the
  // field id from the question id gave both copies the same id, so the second
  // label focused the first copy's box. The id belongs to the instance.
  const fieldId = useId();
  const alternativesId = `${fieldId}-alternatives`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = answer.trim();
    if (!text || sending) return;
    setSending(true);
    setFailure(null);
    postMutation("question.answer", {
      id: question.id,
      answer: text,
      version: question.version,
    })
      .then(() => {
        setAnswer("");
        setSending(false);
        onAnswered();
      })
      .catch((reason: unknown) => {
        setSending(false);
        setFailure(
          reason instanceof Error
            ? reason
            : new Error(
                "The answer could not be recorded. Try again, and check the service log if it happens twice.",
              ),
        );
      });
  };

  return (
    <div
      id={anchorId}
      data-selected={selected || undefined}
      className="flex flex-col gap-3 rounded-sd border border-state-attention/45 bg-state-attention-wash p-3 data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Markdown>{question.question}</Markdown>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {question.id}
          </span>
        </div>
        <Status value={question.status} size="sm" />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Reading label="Scope">{scopePhrase(question)}</Reading>
        <Reading label="Why it matters">
          {question.why_it_matters ?? (
            <Gap>
              Nobody wrote down why this matters, so its urgency cannot be
              weighed against anything else on this page.
            </Gap>
          )}
        </Reading>
      </dl>

      {question.recommendation ? (
        <p className="font-prose text-body text-ink-2 prose-measure">
          Superdev suggests: {question.recommendation}
        </p>
      ) : null}

      {alternatives.length > 0 ? (
        <div className="flex flex-col gap-1">
          {/* A caption for the list, not a section of the page. As a heading it
              landed at h5 under an h3 in Open questions and under an h4 in a
              capability area, so the outline skipped a level in one of them. */}
          <p
            id={alternativesId}
            className="font-chassis text-label text-ink-3 uppercase"
          >
            {countPhrase(alternatives.length, "alternative")} considered
          </p>
          <ul
            role="list"
            aria-labelledby={alternativesId}
            className="flex flex-col gap-1"
          >
            {alternatives.map((option) => (
              <li
                key={option}
                className="flex items-start gap-2 font-prose text-small text-ink-2 prose-measure"
              >
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 size-3 shrink-0 text-ink-3"
                />
                <span>{option}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {question.answer ? (
        <p className="font-prose text-body text-ink prose-measure">
          Answered {relativeTime(question.answered_at).toLowerCase()}
          {question.answered_by ? ` by ${question.answered_by}` : ""}:{" "}
          {question.answer}
        </p>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label
          htmlFor={fieldId}
          className="font-chassis text-label text-ink-3 uppercase"
        >
          Your answer
        </label>
        <Textarea
          id={fieldId}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={sending}
          placeholder="Say what should happen, in your own words. This is recorded against the project and unblocks the work waiting on it."
        />
        {failure ? (
          <ErrorState
            title="The answer was not recorded"
            error={failure}
            actions={[
              {
                label: "Dismiss this message",
                onClick: () => setFailure(null),
                variant: "outline" as const,
              },
            ]}
            density="inline"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={sending || !answer.trim()}>
            {sending ? "Recording" : "Record this answer"}
          </Button>
          <span className="font-prose text-small text-ink-3">
            {answer.trim()
              ? "This is written to the project database straight away."
              : "Type an answer to enable this."}
          </span>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Risks
   --------------------------------------------------------------------------- */

const SEVERITY_TONES: Record<string, StatusTone> = {
  critical: "blocked",
  high: "blocked",
  medium: "attention",
  moderate: "attention",
  low: "idle",
  minor: "idle",
};

function RisksSection({
  risks,
  areaIds,
}: {
  risks: ReadinessRisk[];
  /** Risks raised against a capability area link back to it on this page. */
  areaIds: Set<string>;
}) {
  if (risks.length === 0) {
    return (
      <Empty
        title="No material risk has been recorded"
        explanation="A material risk is something that could stop this project reaching production. None are written down, which means either there are none or nobody has looked. Record what worries you in Discovery so it is weighed rather than remembered."
        actions={[{ label: "Open Discovery", href: hrefFor("discovery") }]}
        density="inline"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-chassis text-chassis-sm text-ink-2">
        {countPhrase(risks.length, "material risk")} recorded.
      </p>
      <ul role="list" className="flex flex-col gap-2">
        {risks.map((risk) => {
          const severity = risk.severity ?? "";
          const tone = SEVERITY_TONES[severity.toLowerCase()] ?? "attention";
          return (
            <li
              key={risk.id}
              className="flex flex-col gap-2 rounded-sd border border-rule bg-inset p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <Markdown>{risk.statement}</Markdown>
                  {areaIds.has(risk.id) ? (
                    <a
                      href={hrefFor("readiness", risk.id)}
                      className="w-fit rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
                    >
                      {risk.id}
                    </a>
                  ) : null}
                </div>
                <Status
                  value={severity}
                  tone={tone}
                  size="sm"
                  label={
                    severity
                      ? `${titleCase(severity)} Severity`
                      : "Severity Not Recorded"
                  }
                />
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Reading label="Mitigation">
                  {risk.mitigation ?? (
                    <Gap>
                      Nothing is being done about this. An unmitigated risk is a
                      decision to accept it, so record either the mitigation or
                      the acceptance.
                    </Gap>
                  )}
                </Reading>
                <Reading label="Owner">
                  {risk.owner ?? (
                    <Gap>
                      Nobody owns this risk, so nobody is watching for it to
                      happen.
                    </Gap>
                  )}
                </Reading>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
