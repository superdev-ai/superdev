/**
 * Changes: what moved in accepted scope, and what is being taken on faith.
 *
 * A change is append-only (see src/product/changes.mjs), written whenever
 * something already agreed moves. It is not an activity log entry: it always
 * carries a reason, so a reader months later can tell whether the product
 * drifted or was steered. Newest first, because "what changed most recently"
 * is the question this page exists to answer.
 *
 * An assumption is a reversible guess Superdev proceeded on instead of a
 * decided answer (section 8.4). Assumptions still holding are shown first
 * because those are the ones a reader has to treat as live; a resolved one is
 * kept for the record, the same way a superseded decision is.
 *
 * Reads GET /api/changes. This view has no mutation: recording a change or an
 * assumption happens from the tool that makes the change, not from here.
 */

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

import {
  CountStrip,
  Facts,
  Panel,
  RecordName,
  Tag,
  Value,
  useResource,
  type Fact,
} from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Empty, ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { Status, type StatusTone } from "@/components/shell/status";
import { Markdown } from "@/components/ui/markdown";
import { getChanges } from "@/lib/api";
import { absoluteTime, countPhrase, relativeTime, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, type View } from "@/lib/route";
import type { AssumptionRecord, ChangeRecord, ChangeTargetRecord } from "@/types";

/* ---------------------------------------------------------------------------
   Vocabulary the global Status map does not carry
   --------------------------------------------------------------------------- */

/**
 * Assumption resolutions (src/product/assumptions.mjs: holding, confirmed,
 * overturned, expired) are not in the shared status vocabulary, the same gap
 * decisions.tsx works around for its own statuses. Unmapped values still
 * render correctly through Status, just without a tone tuned to this list.
 */
const ASSUMPTION_TONES: Record<string, StatusTone> = {
  holding: "active",
  confirmed: "complete",
  overturned: "blocked",
  expired: "retired",
};

const ASSUMPTION_LABELS: Record<string, string> = {
  holding: "Holding",
  confirmed: "Confirmed",
  overturned: "Overturned",
  expired: "Expired",
};

/** Where each kind of change target can be opened, so 16.3 is a real link. */
const TARGET_VIEWS: Record<string, View> = {
  goal: "product",
  milestone: "product",
  module: "product",
  feature: "features",
  workflow: "workflows",
  workflow_step: "workflows",
  surface: "surfaces",
  api_operation: "apis",
  api_service: "apis",
  data_entity: "data",
  integration: "architecture",
  task: "tasks",
  decision: "decisions",
};

/**
 * A change target, linked when a view owns that kind of record. Acceptance
 * criteria, NFRs and test plans have no view that opens one by its own id, so
 * those stay plain text rather than a link that would not resolve.
 */
function TargetLink({ target }: { target: ChangeTargetRecord }) {
  const view = TARGET_VIEWS[target.target_type];
  const label = `${titleCase(target.target_type)} ${target.target_id}`;
  if (!view) {
    return <span className="font-chassis text-chassis-sm text-ink-2">{label}</span>;
  }
  return (
    <a
      href={hrefFor(view, target.target_id)}
      className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
    >
      {label}
    </a>
  );
}

/* ---------------------------------------------------------------------------
   One change
   --------------------------------------------------------------------------- */

function ChangeCard({ change }: { change: ChangeRecord }) {
  const facts: Fact[] = [
    {
      label: "Decided by",
      value: <Value missing="Not recorded">{change.decided_by}</Value>,
    },
    {
      label: "When",
      value: (
        <span title={absoluteTime(change.created_at)}>
          {relativeTime(change.created_at)}
        </span>
      ),
    },
  ];

  if (change.decision_id) {
    facts.push({
      label: "Governing decision",
      value: (
        <a href={hrefFor("decisions", change.decision_id)} className="focus-ring">
          <RecordName
            name={change.decision_title ?? "Untitled decision"}
            id={change.decision_id}
            size="sm"
          />
        </a>
      ),
    });
  }

  if (change.task_id) {
    facts.push({
      label: "Task that made it",
      value: (
        <a
          href={hrefFor("tasks", change.task_id)}
          className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
        >
          {change.task_id}
        </a>
      ),
    });
  }

  return (
    <article
      aria-labelledby={`change-${change.id}-title`}
      className="flex flex-col gap-3 border-b border-rule px-4 py-4 last:border-b-0"
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h4 id={`change-${change.id}-title`} className="font-prose text-subtitle text-ink">
            {change.summary}
          </h4>
          <span className="font-chassis text-chassis-sm text-ink-3">{change.id}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Tag>{titleCase(change.change_type)}</Tag>
          <Status value={change.status} size="sm" />
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <span className="font-chassis text-label text-ink-3 uppercase">
          Why it moved
        </span>
        <Markdown>{change.reason}</Markdown>
      </div>

      <Facts columns={2} items={facts} />

      <div className="flex flex-col gap-2">
        <span className="font-chassis text-label text-ink-3 uppercase">
          Records it touched
        </span>
        {change.targets.length === 0 ? (
          <p className="font-prose text-small text-ink-2 prose-measure">
            No target was recorded against this change, so what it moved is
            unknown. A change is required to name at least one target when it
            is written, so this is a gap worth asking about rather than
            expected.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {change.targets.map((target, index) => (
              <li
                key={`${target.target_id}-${index}`}
                className="flex flex-wrap items-baseline gap-2 font-prose text-small text-ink-2"
              >
                <TargetLink target={target} />
                {target.what_changed ? (
                  <span className="prose-measure">{target.what_changed}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------------------
   One assumption
   --------------------------------------------------------------------------- */

function AssumptionCard({ assumption }: { assumption: AssumptionRecord }) {
  const key = assumption.status.toLowerCase();
  const holding = key === "holding";

  const facts: Fact[] = [
    {
      label: "Why assumed rather than decided",
      value: <Markdown measure={false}>{assumption.why_assumed}</Markdown>,
    },
    {
      label: "What would reopen it",
      value: <Markdown measure={false}>{assumption.review_trigger}</Markdown>,
    },
  ];

  if (assumption.consequence_if_wrong) {
    facts.push({
      label: "If it turns out wrong",
      value: <Markdown measure={false}>{assumption.consequence_if_wrong}</Markdown>,
    });
  }

  return (
    <article
      aria-labelledby={`assumption-${assumption.id}-title`}
      className="flex flex-col gap-3 border-b border-rule px-4 py-4 last:border-b-0"
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h4
            id={`assumption-${assumption.id}-title`}
            className="font-prose text-subtitle text-ink"
          >
            {assumption.statement}
          </h4>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {assumption.id}
          </span>
        </div>
        <div className="ml-auto">
          <Status
            value={assumption.status}
            tone={ASSUMPTION_TONES[key]}
            label={ASSUMPTION_LABELS[key]}
            size="sm"
          />
        </div>
      </header>

      <Facts columns={2} items={facts} />

      {holding ? (
        <p className="font-prose text-small text-ink-3 prose-measure">
          Still holding. Nothing has confirmed or overturned it yet, so treat
          it as true only until its review trigger fires.
        </p>
      ) : (
        <div className="flex flex-col gap-1 rounded-sd border border-rule bg-inset px-3 py-2">
          <span className="font-chassis text-label text-ink-3 uppercase">
            Resolution
          </span>
          {assumption.resolution ? (
            <Markdown measure={false}>{assumption.resolution}</Markdown>
          ) : (
            <span className="font-prose text-small text-ink-3">
              Marked {ASSUMPTION_LABELS[key] ?? titleCase(assumption.status)} with
              no resolution text recorded.
            </span>
          )}
          {assumption.resolved_at ? (
            <span
              className="font-chassis text-chassis-sm text-ink-3"
              title={absoluteTime(assumption.resolved_at)}
            >
              {relativeTime(assumption.resolved_at)}
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

export function ChangesView() {
  const { revision } = useLive();
  const changes = useResource(getChanges, revision);
  const payload = changes.data;

  // The service already orders both lists this way (created_at DESC for
  // changes, holding first for assumptions), but sorting here too costs
  // nothing and keeps the page honest if a future response ever does not.
  const changeList = useMemo(
    () =>
      (payload?.changes ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [payload],
  );

  const assumptionList = useMemo(
    () =>
      (payload?.assumptions ?? []).slice().sort((a, b) => {
        const rank = (item: AssumptionRecord) =>
          item.status.toLowerCase() === "holding" ? 0 : 1;
        const byRank = rank(a) - rank(b);
        return byRank !== 0 ? byRank : Date.parse(b.created_at) - Date.parse(a.created_at);
      }),
    [payload],
  );

  if (changes.pending && changes.loading) {
    return (
      <>
        <ViewHeader view="changes" />
        <ViewBody width="prose">
          <Loading
            title="Loading the changes"
            explanation="Reading every recorded change to accepted scope, and every assumption standing in for a decision, from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="changes" />
        <ViewBody width="prose">
          {changes.offline ? (
            <Offline onReconnect={changes.reload} state="offline" />
          ) : (
            <ErrorState
              title="The changes did not load"
              error={changes.error}
              onRetry={changes.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const counts = [
    { label: "Changes", value: payload.counts.changes, unit: "recorded" },
    { label: "Assumptions", value: payload.counts.assumptions, unit: "recorded" },
    { label: "Holding", value: payload.counts.holding, unit: "still live" },
  ];

  return (
    <>
      <ViewHeader view="changes">
        <CountStrip items={counts} className="-mx-1" />
      </ViewHeader>

      <ViewBody width="prose">
        {changes.error && changes.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${changes.error.message} Everything below is the last reading that arrived.`}
            onRetry={changes.reload}
          />
        ) : null}

        {changes.meta?.stale ? (
          <Stale
            meta={changes.meta}
            onRefresh={changes.reload}
            showing={`${countPhrase(changeList.length, "change")}, ${countPhrase(assumptionList.length, "assumption")}`}
          />
        ) : null}

        <Panel
          title="Changes"
          description={`${countPhrase(changeList.length, "change")} to accepted scope, newest first.`}
          bodyClassName="p-0"
        >
          {changeList.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No changes recorded yet"
              explanation="No alteration to accepted scope has been recorded here, which is different from nothing having happened. It means nothing that was already agreed has since moved. A change is written whenever a decision, a task, or new evidence changes what was previously accepted."
              actions={[
                { label: "Refresh", onClick: changes.reload, icon: RefreshCw },
                { label: "Open Decisions", href: hrefFor("decisions") },
              ]}
            />
          ) : (
            changeList.map((change) => <ChangeCard key={change.id} change={change} />)
          )}
        </Panel>

        <Panel
          title="Assumptions"
          description={`${countPhrase(assumptionList.length, "assumption")}, still holding first because those are live.`}
          bodyClassName="p-0"
        >
          {assumptionList.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No assumptions recorded"
              explanation="Nothing on this project is currently being taken on faith. An assumption is recorded when Superdev proceeds on a reversible guess instead of a decided answer, together with what would make it worth checking again."
              actions={[{ label: "Refresh", onClick: changes.reload, icon: RefreshCw }]}
            />
          ) : (
            assumptionList.map((assumption) => (
              <AssumptionCard key={assumption.id} assumption={assumption} />
            ))
          )}
        </Panel>
      </ViewBody>
    </>
  );
}
