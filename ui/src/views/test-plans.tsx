/**
 * Test plans: the agreed verification strategy per feature, section 6.1.
 *
 * Section 9.3 gates task completion on "product tests defined by the accepted
 * test plan" passing, so this view answers two questions at once: what is
 * each feature judged against, and can anyone actually run that judgement
 * themselves. A case that carries a command is something `superdev verify`,
 * or a person at a terminal, can replay on demand. A case without one is a
 * check a person performs by hand: section 20.2 says the product's own
 * testing strategy governs, so a manual case is a legitimate plan entry, not
 * a gap. What must never happen is the two looking alike, so every case
 * states which kind it is instead of leaving the reader to notice a missing
 * code block.
 */

import { CountStrip, FreshnessLine, Panel, Tag, useResource } from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Empty, ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Markdown } from "@/components/ui/markdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTestPlans } from "@/lib/api";
import { countPhrase } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { TestPlanCaseRecord, TestPlansPayload } from "@/types";

type PlanWithContext = TestPlansPayload["testPlans"][number];

/** The one thing the plan is written against, whichever the service joined in. */
function CoverageTag({ plan }: { plan: PlanWithContext }) {
  if (plan.feature_name) return <Tag>{plan.feature_name}</Tag>;
  if (plan.workflow_name) return <Tag>{plan.workflow_name}</Tag>;
  if (plan.module_name) return <Tag>{plan.module_name}</Tag>;
  return (
    <Tag title="No feature, workflow or module is recorded against this plan.">
      No coverage recorded
    </Tag>
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

function PlanPanel({ plan }: { plan: PlanWithContext }) {
  const runnableCount = plan.cases.filter((item) => Boolean(item.command?.trim())).length;

  return (
    <Panel
      title={plan.name}
      description={
        <span className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <CoverageTag plan={plan} />
            <Tag>{countPhrase(plan.cases.length, "case")}</Tag>
            {plan.cases.length > 0 ? (
              <Tag title="Cases that carry a command, and so can be run again by anyone.">
                {countPhrase(runnableCount, "runnable case")}
              </Tag>
            ) : null}
          </span>
          <Markdown measure={false}>{plan.strategy}</Markdown>
        </span>
      }
      actions={
        <span className="flex items-center gap-2">
          {/*
            The run state is not a record status, so it is a tag rather than a
            Status pill: Status describes the vocabulary the database stores,
            and feeding it a word it has never heard produces a pill that says
            it has no description for the state.
          */}
          {plan.status === "accepted" ? (
            <Tag
              title={
                plan.satisfied
                  ? "A passing run is recorded, so tasks this plan covers can complete."
                  : "No passing run is recorded, so tasks this plan covers are refused at completion."
              }
            >
              {plan.satisfied ? "Run and passing" : "Not run"}
            </Tag>
          ) : null}
          <Status value={plan.status} />
        </span>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-col gap-2 border-b border-rule px-3 py-3">
        {plan.how_to_run ? (
          <p className="font-prose text-small text-ink-2 prose-measure">
            <span className="font-chassis text-label text-ink-3 uppercase">How to run: </span>
            {plan.how_to_run}
          </p>
        ) : (
          <p className="font-prose text-small text-ink-3 prose-measure">
            No instructions for how to run this plan have been recorded yet.
          </p>
        )}
        {plan.passing_condition ? (
          <p className="font-prose text-small text-ink-2 prose-measure">
            <span className="font-chassis text-label text-ink-3 uppercase">Passes when: </span>
            {plan.passing_condition}
          </p>
        ) : (
          <p className="font-prose text-small text-ink-3 prose-measure">
            No passing condition has been recorded yet, so nothing states what this plan must
            show to count as satisfied.
          </p>
        )}
        {/*
          Whether it has actually been run. A plan states what would prove the
          work; only the last run says whether anyone proved it, and section 9.3
          makes that difference the reason a task can or cannot complete.
        */}
        <p className="font-prose text-small text-ink-2 prose-measure">
          <span className="font-chassis text-label text-ink-3 uppercase">Last run: </span>
          {plan.last_run_at ? (
            <>
              {plan.last_run_summary}
              {plan.satisfied
                ? " Every task this plan covers can complete."
                : " This does not satisfy the plan, so tasks it covers stay blocked at completion."}
            </>
          ) : (
            "Never. Until it is run, no task this plan covers can complete."
          )}
        </p>
      </div>

      {plan.cases.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No case has been written under this plan yet"
          explanation="This strategy has not been broken down into individual cases yet, so nothing here can be run or checked against it."
        />
      ) : (
        <CasesTable cases={plan.cases} />
      )}
    </Panel>
  );
}

export function TestPlansView() {
  const { revision } = useLive();
  const resource = useResource(getTestPlans, revision);
  const payload = resource.data;

  if (resource.pending && resource.loading) {
    return (
      <>
        <ViewHeader view="test-plans" />
        <ViewBody>
          <Loading
            title="Loading the test plans"
            explanation="Reading every test plan and its cases from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="test-plans" />
        <ViewBody>
          {resource.offline ? (
            <Offline onReconnect={resource.reload} state="offline" />
          ) : (
            <ErrorState
              title="The test plans did not load"
              error={resource.error}
              onRetry={resource.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const { testPlans, counts } = payload;

  const counters = [
    { label: "Plans", value: counts.plans, unit: "recorded" },
    { label: "Accepted", value: counts.accepted, unit: "" },
    { label: "Cases", value: counts.cases, unit: "across every plan" },
    { label: "Runnable", value: counts.runnable, unit: "carry a command" },
    { label: "Never run", value: counts.unrun, unit: "accepted, no passing run" },
  ];

  return (
    <>
      <ViewHeader view="test-plans">
        <CountStrip items={counters} className="-mx-1" />
        <p className="font-prose text-small text-ink-2 prose-measure">
          Section 9.3 gates a task&apos;s completion on the product tests defined by its
          accepted test plan passing. A case with a command can be replayed by anyone; a case
          without one is a check a person performs, which section 20.2 treats as an equally
          legitimate part of the product&apos;s own testing strategy.
        </p>
        <FreshnessLine meta={resource.meta} loading={resource.loading} onRefresh={resource.reload} />
      </ViewHeader>

      <ViewBody>
        {resource.meta?.stale ? (
          <Stale
            meta={resource.meta}
            onRefresh={resource.reload}
            showing={countPhrase(testPlans.length, "test plan")}
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

        {testPlans.length === 0 ? (
          <Empty
            title="No test plan has been written yet"
            explanation="A test plan is the agreed verification strategy for a feature or workflow: what is checked, how to run it, and what counts as passing. None has been written for this project yet, so no task on it can be gated by one."
          />
        ) : (
          testPlans.map((plan) => <PlanPanel key={plan.id} plan={plan} />)
        )}
      </ViewBody>
    </>
  );
}
