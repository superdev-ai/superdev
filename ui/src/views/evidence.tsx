/**
 * Evidence: what proves the product works, section 16.1.
 *
 * Before this view, evidence was only ever visible inside the one task that
 * recorded it, so nobody could see how much of the product is actually
 * proven. This reads every piece of evidence and every test plan across the
 * whole project in one place.
 *
 * The distinction that matters most: evidence with a check command can be
 * re-run by `superdev verify`; evidence without one is a sentence somebody
 * wrote once that nothing can check again. Neither is wrong, a manual check
 * is an honest thing to record, but the two must never look the same, so
 * every row carries its own tag for which kind it is rather than leaving the
 * reader to notice the presence or absence of a code block.
 */

import { FileCheck2, RefreshCw } from "lucide-react";

import {
  CountStrip,
  FreshnessLine,
  Panel,
  RecordName,
  Tag,
  useResource,
} from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Empty, ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEvidence } from "@/lib/api";
import { countPhrase, ofPhrase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor } from "@/lib/route";
import type {
  EvidenceCriterion,
  EvidenceRecord,
  TestPlanCaseRecord,
  TestPlanRecord,
} from "@/types";

/** Evidence with a check command can be replayed; evidence without one cannot. */
function isReRunnable(item: EvidenceRecord): boolean {
  return Boolean(item.check_command?.trim());
}

/** The one visible marker for the re-runnable/manual split, everywhere it appears. */
function VerificationTag({ item }: { item: EvidenceRecord }) {
  return isReRunnable(item) ? (
    <Tag title="Has a check command: superdev verify can run this again.">
      <RefreshCw aria-hidden="true" className="size-3" />
      Re-runnable
    </Tag>
  ) : (
    <Tag title="No check command recorded: this is a sentence someone wrote once, with nothing to run again.">
      <FileCheck2 aria-hidden="true" className="size-3" />
      Manual record
    </Tag>
  );
}

/** A task identifier, linked when there is one to link to. */
function TaskLink({ id, name }: { id: string | null; name: string | null }) {
  if (!id) {
    return <span className="font-chassis text-chassis-sm text-ink-3">No task recorded</span>;
  }
  return (
    <a href={hrefFor("tasks", id)} className="min-w-0 rounded-sd-sm focus-ring">
      <RecordName name={name ?? id} id={id} size="sm" />
    </a>
  );
}

export function EvidenceView() {
  const { revision } = useLive();
  const resource = useResource(getEvidence, revision);
  const payload = resource.data;

  if (resource.pending && resource.loading) {
    return (
      <>
        <ViewHeader view="evidence" />
        <ViewBody>
          <Loading
            title="Loading the evidence"
            explanation="Reading every piece of recorded evidence and every test plan on this project from the database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="evidence" />
        <ViewBody>
          {resource.offline ? (
            <Offline onReconnect={resource.reload} state="offline" />
          ) : (
            <ErrorState
              title="The evidence did not load"
              error={resource.error}
              onRetry={resource.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const { evidence, criteria, testPlans, counts } = payload;

  const counters = [
    { label: "Recorded", value: counts.recorded, unit: "in total" },
    { label: "Passing", value: counts.passing, unit: "" },
    { label: "Failing", value: counts.failing, unit: "" },
    { label: "Inconclusive", value: counts.inconclusive, unit: "" },
    { label: "Stale", value: counts.stale, unit: "" },
    { label: "Re-runnable", value: counts.reRunnable, unit: "by superdev verify" },
  ];

  const nothingAtAll =
    evidence.length === 0 && criteria.length === 0 && testPlans.length === 0;

  return (
    <>
      <ViewHeader view="evidence">
        <CountStrip items={counters} className="-mx-1" />
        <p className="font-prose text-small text-ink-2 prose-measure">
          {ofPhrase(counts.criteriaMet, counts.criteriaTotal, "acceptance criteria", "met")}
          .
        </p>
        <FreshnessLine
          meta={resource.meta}
          loading={resource.loading}
          onRefresh={resource.reload}
        />
      </ViewHeader>

      <ViewBody>
        {resource.meta?.stale ? (
          <Stale
            meta={resource.meta}
            onRefresh={resource.reload}
            showing={countPhrase(evidence.length, "piece of evidence", "pieces of evidence")}
          />
        ) : null}

        {resource.error && resource.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${resource.error.message} Everything below is the last reading that arrived.`}
            onRetry={resource.reload}
          />
        ) : null}

        {nothingAtAll ? (
          <Empty
            title="No evidence has been recorded yet"
            explanation="Evidence is recorded against a task as it is verified: a check command that can be re-run, or a written record of what was manually confirmed. None has been written for this project yet, so nothing here is proven."
            actions={[{ label: "Open Tasks", href: hrefFor("tasks") }]}
          />
        ) : (
          <>
            <CriteriaPanel criteria={criteria} />
            <EvidencePanel evidence={evidence} />
            <TestPlansPanel testPlans={testPlans} />
          </>
        )}
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Acceptance criteria
   --------------------------------------------------------------------------- */

function CriteriaPanel({ criteria }: { criteria: EvidenceCriterion[] }) {
  return (
    <Panel
      title="Acceptance criteria"
      description="What each feature promises to satisfy, and whether the record says that has been met."
      bodyClassName="p-0"
    >
      {criteria.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No acceptance criteria recorded"
          explanation="No feature on this project has had its acceptance criteria written down yet, so there is nothing here to check evidence against."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criterion</TableHead>
              <TableHead>Feature</TableHead>
              <TableHead>How it is verified</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {criteria.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-prose text-ink">{item.criterion}</TableCell>
                <TableCell>
                  {item.feature_name ? (
                    <a
                      href={hrefFor("features", item.feature_id)}
                      className="rounded-sd-sm font-prose text-ink-2 hover:text-signal focus-ring"
                    >
                      {item.feature_name}
                    </a>
                  ) : (
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {item.feature_id}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  {item.verification_method ?? (
                    <span className="text-ink-3">Not recorded</span>
                  )}
                </TableCell>
                <TableCell>
                  <Status value={item.status} size="sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Evidence
   --------------------------------------------------------------------------- */

function EvidencePanel({ evidence }: { evidence: EvidenceRecord[] }) {
  return (
    <Panel
      title="Evidence"
      description="Every piece of evidence recorded against the project's tasks, whether it can be re-checked automatically or was written once by hand."
      bodyClassName="p-0"
    >
      {evidence.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No evidence recorded"
          explanation="Nothing has been recorded as proof of work yet. Evidence is written when a task is verified."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Summary</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Freshness</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evidence.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-prose text-ink">
                  <span className="flex flex-col gap-0.5">
                    <span>{item.summary}</span>
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {item.evidence_type}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Status value={item.result} size="sm" />
                </TableCell>
                <TableCell>
                  <TaskLink id={item.task_id} name={item.task_name} />
                </TableCell>
                <TableCell>
                  <span className="flex flex-col gap-1 py-1">
                    <VerificationTag item={item} />
                    {item.check_command ? (
                      <code className="w-fit rounded-sd-sm bg-inset px-1.5 py-0.5 font-chassis text-chassis-sm text-ink">
                        {item.check_command}
                      </code>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <Status value={item.status} size="sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Test plans
   --------------------------------------------------------------------------- */

function TestPlansPanel({ testPlans }: { testPlans: TestPlanRecord[] }) {
  return (
    <Panel
      title="Test plans"
      description="The planned coverage per feature, and the individual cases each one carries."
      bodyClassName="p-0"
    >
      {testPlans.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No test plan recorded"
          explanation="No feature on this project has had a test plan written for it yet, so evidence is only whatever has been recorded case by case."
        />
      ) : (
        <div className="flex flex-col divide-y divide-rule">
          {testPlans.map((plan) => (
            <TestPlanRow key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function TestPlanRow({ plan }: { plan: TestPlanRecord }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <RecordName name={plan.name} id={plan.id} size="sm" />
        <Status value={plan.status} size="sm" />
        <Tag>{plan.strategy}</Tag>
        <Tag>{countPhrase(plan.cases.length, "case")}</Tag>
        {plan.feature_name ? <Tag>{plan.feature_name}</Tag> : null}
      </div>

      {plan.how_to_run ? (
        <p className="font-prose text-small text-ink-2 prose-measure">
          <span className="font-chassis text-label text-ink-3 uppercase">How to run: </span>
          {plan.how_to_run}
        </p>
      ) : null}

      {plan.passing_condition ? (
        <p className="font-prose text-small text-ink-2 prose-measure">
          <span className="font-chassis text-label text-ink-3 uppercase">Passes when: </span>
          {plan.passing_condition}
        </p>
      ) : null}

      {plan.cases.length === 0 ? (
        <p className="font-prose text-small text-ink-3 prose-measure">
          No case has been written under this plan yet.
        </p>
      ) : (
        <CasesTable cases={plan.cases} />
      )}
    </div>
  );
}

function CasesTable({ cases }: { cases: TestPlanCaseRecord[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Expectation</TableHead>
          <TableHead>Command</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((testCase) => (
          <TableRow key={testCase.id}>
            <TableCell className="font-prose text-ink">{testCase.name}</TableCell>
            <TableCell>
              <Tag>{testCase.kind}</Tag>
            </TableCell>
            <TableCell className="font-prose text-ink-2">{testCase.expectation}</TableCell>
            <TableCell>
              {testCase.command ? (
                <code className="rounded-sd-sm bg-inset px-1.5 py-0.5 font-chassis text-chassis-sm text-ink">
                  {testCase.command}
                </code>
              ) : (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  No command, checked by hand
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
