/**
 * One feature and every contract hanging off it, as returned by
 * GET /api/features/:id.
 *
 * The order is deliberate: what a person needs first is the plain-language
 * state of the feature, then how deeply it is meant to be specified, then the
 * contract itself. A section that is empty says whether that is finished work
 * or missing work, which is decided by the depth, not by the reader.
 */

import { ChevronRight, ExternalLink } from "lucide-react";

import {
  Bullets,
  DataGrid,
  Fact,
  Facts,
  Panel,
  PanelRows,
  Prose,
  RecordLink,
  RecordLinks,
  RecordName,
  StatusCell,
  type Column,
} from "@/components/product/panel";
import {
  Section,
  resolveDepth,
  DepthPanel,
  type SectionCounts,
} from "@/components/product/depth";
import { FreshnessNote } from "@/components/product/resource";
import { Markdown } from "@/components/ui/markdown";
import { ProgressMeter } from "@/components/ui/progress";
import { Status } from "@/components/shell/status";
import {
  absoluteTime,
  countPhrase,
  listPhrase,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { hrefFor } from "@/lib/route";
import type {
  AcceptanceCriterion,
  ApiOperation,
  DataEntity,
  Decision,
  EdgeCase,
  FeatureDetailPayload,
  Integration,
  Job,
  Meta,
  NonFunctionalRequirement,
  SchemaMigration,
  Surface,
  SurfaceState,
  Task,
  UiAction,
  VerificationEvidence,
  Webhook,
  Workflow,
} from "@/types";

/** A stored value, or the words that say there is not one. */
function value(text: string | null | undefined, fallback: string) {
  const missing = !text || text.trim().length === 0;
  return (
    <span className={missing ? "font-prose text-small text-ink-3" : undefined}>
      {missing ? fallback : text}
    </span>
  );
}

function list(items: string[] | null | undefined, fallback: string) {
  const clean = (items ?? []).filter(Boolean);
  if (clean.length === 0) {
    return <span className="font-prose text-small text-ink-3">{fallback}</span>;
  }
  return <span>{listPhrase(clean)}</span>;
}

export function FeatureDetail({
  payload,
  meta,
}: {
  payload: FeatureDetailPayload;
  meta: Meta | null;
}) {
  const {
    feature,
    acceptanceCriteria,
    edgeCases,
    workflows,
    surfaces,
    surfaceStates,
    uiActions,
    apiOperations,
    dataEntities,
    migrations,
    integrations,
    jobs,
    webhooks,
    nfrs,
    decisions,
    tasks,
    evidence,
    progress,
  } = payload;

  const depth = resolveDepth(feature.spec_depth);
  const scopeIn = feature.scope_in_json ?? [];
  const scopeOut = feature.scope_out_json ?? [];

  const counts: SectionCounts = {
    purpose: [feature.purpose, feature.user_statement, feature.user_value].filter(
      (item) => Boolean(item && item.trim()),
    ).length,
    scope: scopeIn.length + scopeOut.length,
    acceptanceCriteria: acceptanceCriteria.length,
    edgeCases: edgeCases.length,
    workflows: workflows.length,
    surfaces: surfaces.length,
    apiOperations: apiOperations.length,
    data: dataEntities.length + migrations.length,
    integrations: integrations.length + jobs.length + webhooks.length,
    nfrs: nfrs.length,
    decisions: decisions.length,
    tasks: tasks.length,
    evidence: evidence.length,
  };

  const shared = {
    depthLabel: depth.label,
    featureName: feature.name,
  };
  const required = (key: keyof SectionCounts) => depth.required.includes(key);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FeatureHeader payload={payload} meta={meta} />

      <Panel
        id="feature-state"
        title="Where this feature stands"
        description="The plain-language answer, written by whoever last worked on it."
      >
        {/*
          Stacked, not three columns. These three answers are wildly uneven in
          length: what works now can run to a paragraph of evidence while the
          other two are a sentence, and side by side that left one column
          scrolling past a thousand pixels with two nearly empty beside it.
          Stacking gives each the full width and puts them in the order a person
          reads them, which is also the order they are asked in.

          Each opens by default when it has something to say, so nothing is
          hidden behind a click that a reader needed. An answer that is only a
          fallback starts closed, because collapsing "nothing recorded" is what
          keeps the useful ones near the top.
        */}
        <div className="flex flex-col gap-2">
          <StandingAnswer
            label="What Works Now"
            value={feature.what_works_now}
            fallback="Nothing has been recorded as working yet. This is filled in when a task on this feature completes with evidence."
          />
          <StandingAnswer
            label="What Remains"
            value={feature.what_remains}
            fallback="Nothing has been recorded as remaining. Check the acceptance criteria and tasks below before treating this feature as finished."
          />
          <StandingAnswer
            label="Next Action"
            value={feature.next_action}
            fallback="No next action has been recorded. Open Tasks to see whether any work on this feature is ready to be claimed."
          />
        </div>
      </Panel>

      <Panel
        id="feature-progress"
        title="Progress"
        description="Derived from the accepted contract for this feature, not from an estimate."
      >
        <div className="flex flex-col gap-3">
          <ProgressMeter
            progress={progress}
            qualifier="complete"
            subject="This feature"
          />
          <p className="font-prose text-small text-ink-3 prose-measure">
            Counted from {progress?.counts ?? "the accepted contract"}.{" "}
            <FreshnessNote meta={meta} />
          </p>
        </div>
      </Panel>

      <DepthPanel
        depth={depth}
        counts={counts}
        rawDepth={feature.spec_depth}
        sourceRevision={meta?.revision}
      />

      <Section
        {...shared}
        sectionKey="purpose"
        required={required("purpose")}
        count={counts.purpose}
        unit="statement"
        fills="It says why the feature exists and what a person gets out of it."
      >
        <div className="flex flex-col gap-4">
          <Fact label="Purpose">
            <Prose
              value={feature.purpose}
              fallback="No purpose has been recorded."
            />
          </Fact>
          <Fact label="User Statement">
            <Prose
              value={feature.user_statement}
              fallback="No user statement has been recorded, so it is not written down who asks for this or why."
            />
          </Fact>
          <Fact label="User Value">
            <Prose
              value={feature.user_value}
              fallback="No user value has been recorded, so the benefit of building this is not yet stated."
            />
          </Fact>
          {feature.primary_flow_json && feature.primary_flow_json.length > 0 ? (
            <Fact label="Primary Flow">
              <Bullets
                items={feature.primary_flow_json}
                empty="No primary flow has been recorded."
              />
            </Fact>
          ) : null}
        </div>
      </Section>

      <Section
        {...shared}
        sectionKey="scope"
        required={required("scope")}
        count={counts.scope}
        unit="statement"
        fills="It draws the line between what this feature covers and what it deliberately does not."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Fact label={`In Scope, ${countPhrase(scopeIn.length, "statement")}`}>
            <Bullets
              items={scopeIn}
              empty="Nothing is listed as in scope, so what this feature covers is decided by its acceptance criteria alone."
            />
          </Fact>
          <Fact
            label={`Out Of Scope, ${countPhrase(scopeOut.length, "statement")}`}
          >
            <Bullets
              items={scopeOut}
              empty="Nothing is listed as out of scope. Anything excluded on purpose should be written here so it is not rediscovered as a gap later."
            />
          </Fact>
        </div>
      </Section>

      <Section
        {...shared}
        sectionKey="acceptanceCriteria"
        required={required("acceptanceCriteria")}
        count={counts.acceptanceCriteria}
        unit="criterion"
        bodyClassName=""
        description="Each criterion carries the method used to verify it and the evidence recorded against it."
        fills="Each one states a condition that has to hold before the feature is accepted."
      >
        <AcceptanceTable rows={acceptanceCriteria} evidence={evidence} />
      </Section>

      <Section
        {...shared}
        sectionKey="edgeCases"
        required={required("edgeCases")}
        count={counts.edgeCases}
        unit="edge case"
        bodyClassName=""
        description="Categories marked not applicable carry the reason, so a gap and a decision look different."
        fills="Each one names a category of awkward input or timing and says what happens."
      >
        <EdgeCaseTable rows={edgeCases} />
      </Section>

      <Section
        {...shared}
        sectionKey="workflows"
        required={required("workflows")}
        count={counts.workflows}
        unit="workflow"
        bodyClassName=""
        description="Open a workflow to see its ordered steps, actors, failure branches and live execution state."
        fills="Each one is an ordered run of steps that delivers part of this feature."
      >
        <WorkflowTable rows={workflows} />
      </Section>

      <Section
        {...shared}
        sectionKey="surfaces"
        required={required("surfaces")}
        count={counts.surfaces}
        unit="surface"
        description="Every place a person meets this feature, with the states it can be in and the actions it offers."
        fills="Each one is a screen, page or panel this feature appears on."
      >
        <PanelRows>
          {surfaces.map((surface) => (
            <SurfaceBlock
              key={surface.id}
              surface={surface}
              states={surfaceStates.filter(
                (state) => state.surface_id === surface.id,
              )}
              actions={uiActions.filter(
                (action) => action.surface_id === surface.id,
              )}
            />
          ))}
        </PanelRows>
      </Section>

      <Section
        {...shared}
        sectionKey="apiOperations"
        required={required("apiOperations")}
        count={counts.apiOperations}
        unit="operation"
        bodyClassName=""
        fills="Each one is a call this feature exposes or depends on."
      >
        <ApiTable rows={apiOperations} />
      </Section>

      <Section
        {...shared}
        sectionKey="data"
        required={required("data")}
        count={counts.data}
        unit="record"
        description="The entities this feature reads or writes, and the migrations that change them."
        fills="It names the data this feature owns or touches, and how the schema gets there."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h4 className="font-prose text-subtitle text-ink">
              Entities, {countPhrase(dataEntities.length, "entity")}
            </h4>
            <EntityTable rows={dataEntities} />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-prose text-subtitle text-ink">
              Migrations, {countPhrase(migrations.length, "migration")}
            </h4>
            <MigrationTable rows={migrations} />
          </div>
        </div>
      </Section>

      <Section
        {...shared}
        sectionKey="integrations"
        required={required("integrations")}
        count={counts.integrations}
        unit="record"
        description="Outside systems this feature depends on, plus the background jobs and webhooks that carry the traffic."
        fills="It names every system outside this project that the feature relies on."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h4 className="font-prose text-subtitle text-ink">
              Integrations, {countPhrase(integrations.length, "integration")}
            </h4>
            <IntegrationTable rows={integrations} />
          </div>
          {jobs.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h4 className="font-prose text-subtitle text-ink">
                Background jobs, {countPhrase(jobs.length, "job")}
              </h4>
              <JobTable rows={jobs} />
            </div>
          ) : null}
          {webhooks.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h4 className="font-prose text-subtitle text-ink">
                Webhooks, {countPhrase(webhooks.length, "webhook")}
              </h4>
              <WebhookTable rows={webhooks} />
            </div>
          ) : null}
        </div>
      </Section>

      <Section
        {...shared}
        sectionKey="nfrs"
        required={required("nfrs")}
        count={counts.nfrs}
        unit="requirement"
        bodyClassName=""
        title="Non-functional requirements"
        description="Each requirement carries the target it has to hit and the method that measures it."
        fills="Each one states how well the feature has to behave, not what it does."
      >
        <NfrTable rows={nfrs} />
      </Section>

      <Section
        {...shared}
        sectionKey="decisions"
        required={required("decisions")}
        count={counts.decisions}
        unit="decision"
        description="Decisions that bind this feature. A superseded decision stays visible so the history is not lost."
        fills="Each one is a choice already made that this feature has to respect."
      >
        <PanelRows>
          {decisions.map((decision) => (
            <DecisionBlock key={decision.id} decision={decision} />
          ))}
        </PanelRows>
      </Section>

      <Section
        {...shared}
        sectionKey="tasks"
        required={required("tasks")}
        count={counts.tasks}
        unit="task"
        description="The work itself. Open a task to claim, block, complete or reopen it."
        fills="Each one is a unit of work that moves this feature forward."
      >
        <TaskTree tasks={tasks} />
      </Section>

      <Section
        {...shared}
        sectionKey="evidence"
        required={required("evidence")}
        count={counts.evidence}
        unit="piece of evidence"
        bodyClassName=""
        description="What was actually observed, and when. Evidence past its stale date is marked, because an old observation is not a current one."
        fills="Each piece records something that was verified rather than assumed."
      >
        <EvidenceTable rows={evidence} />
      </Section>

      <p className="px-1 pb-2 font-prose text-small text-ink-3">
        <FreshnessNote meta={meta} prefix="This page was read" />
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Header
   --------------------------------------------------------------------------- */

/**
 * One of the three standing answers, openable on its own.
 *
 * A native details element rather than a controlled panel: it keeps keyboard
 * and screen reader behaviour for free, survives a re-render without state, and
 * is findable by the browser's own in-page search even while closed.
 */
function StandingAnswer({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
}) {
  const recorded = Boolean(value && value.trim());
  return (
    <details
      open={recorded}
      className="group rounded-sd border border-rule bg-inset/40 open:bg-inset"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sd px-3 py-2 focus-ring hover:bg-inset">
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 text-ink-3 transition-transform duration-[120ms] ease-sd group-open:rotate-90"
        />
        <span className="font-chassis text-label text-ink-2 uppercase">{label}</span>
        {!recorded ? (
          <span className="font-prose text-small text-ink-3">Nothing recorded</span>
        ) : null}
      </summary>
      <div className="px-3 pt-1 pb-3 pl-[1.9rem]">
        <Prose value={value} fallback={fallback} />
      </div>
    </details>
  );
}

function FeatureHeader({
  payload,
  meta,
}: {
  payload: FeatureDetailPayload;
  meta: Meta | null;
}) {
  const { feature, module, milestone, goals } = payload;
  const depth = resolveDepth(feature.spec_depth);

  return (
    <Panel
      id="feature-summary"
      title={
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span>{feature.name}</span>
          <span
            className={
              feature.status === "superseded"
                ? "font-chassis text-chassis text-ink-3 line-through"
                : "font-chassis text-chassis text-ink-3"
            }
          >
            {feature.id}
          </span>
        </span>
      }
      description={
        module || milestone
          ? `Part of ${module ? `the ${module.name} module` : "no module"}${
              milestone ? `, delivered in the ${milestone.name} milestone` : ""
            }.`
          : "This feature is not attached to a module or a milestone yet, so it does not roll up into any stage of delivery."
      }
      actions={<Status value={feature.status} />}
    >
      <div className="flex flex-col gap-4">
        <Facts
          items={[
            {
              label: "Specification Depth",
              value: (
                <span title={depth.meaning}>
                  {depth.label}
                  {feature.spec_depth &&
                  depth.key !== "unrecorded" &&
                  titleCase(feature.spec_depth) !== depth.label
                    ? ` (stored as ${feature.spec_depth})`
                    : ""}
                </span>
              ),
            },
            {
              label: "Priority",
              value: value(
                feature.priority ? titleCase(feature.priority) : null,
                "No priority set",
              ),
            },
            {
              label: "Risk Level",
              value: value(
                feature.risk_level ? titleCase(feature.risk_level) : null,
                "No risk level set",
              ),
            },
            {
              label: "Module",
              value: module ? (
                <RecordLink
                  name={module.name}
                  id={module.id}
                  href={hrefFor("product", module.id)}
                />
              ) : (
                value(null, "Not in a module")
              ),
            },
            {
              label: "Milestone",
              value: milestone ? (
                <RecordLink
                  name={milestone.name}
                  id={milestone.id}
                  href={hrefFor("product", milestone.id)}
                />
              ) : (
                value(null, "Not in a milestone")
              ),
            },
            {
              label: "Read At",
              value: meta ? (
                <span title={absoluteTime(meta.generatedAt)}>
                  Revision {meta.revision},{" "}
                  {relativeTime(meta.generatedAt).toLowerCase()}
                </span>
              ) : (
                value(null, "Not read yet")
              ),
            },
          ]}
        />

        <Fact label={`Goals Supported, ${countPhrase(goals.length, "goal")}`}>
          <RecordLinks
            items={goals.map((goal) => ({
              id: goal.id,
              name: goal.name,
              href: hrefFor("product", goal.id),
            }))}
            empty="This feature is not linked to any goal, so finishing it will not move a stated outcome. Link it to a goal on the Product view."
          />
        </Fact>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Tables
   --------------------------------------------------------------------------- */

function emptyNote(title: string, explanation: string) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-prose text-subtitle text-ink">{title}</span>
      <span className="font-prose text-body text-ink-2 prose-measure">
        {explanation}
      </span>
    </div>
  );
}

function AcceptanceTable({
  rows,
  evidence,
}: {
  rows: AcceptanceCriterion[];
  evidence: VerificationEvidence[];
}) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const columns: Column<AcceptanceCriterion>[] = [
    {
      key: "criterion",
      label: "Criterion",
      lead: true,
      className: "min-w-[18rem]",
      cell: (row) => (
        <Markdown measure={false}>{row.criterion}</Markdown>
      ),
    },
    {
      key: "method",
      label: "Verification Method",
      className: "min-w-[12rem]",
      cell: (row) =>
        value(
          row.verification_method,
          "No method recorded, so nobody knows how this would be checked",
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
    {
      key: "evidence",
      label: "Evidence",
      className: "min-w-[14rem]",
      cell: (row) => {
        const item = row.evidence_id ? byId.get(row.evidence_id) : undefined;
        if (!item) {
          return value(
            null,
            row.evidence_id
              ? `Evidence ${row.evidence_id} is referenced but was not returned with this feature`
              : "No evidence attached yet",
          );
        }
        return <EvidenceSummary item={item} />;
      },
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Acceptance criteria for this feature, with their verification method, status and evidence."
      empty={emptyNote(
        "No acceptance criteria",
        "Nothing here can be verified until at least one criterion is written down.",
      )}
    />
  );
}

function EvidenceSummary({ item }: { item: VerificationEvidence }) {
  const stale = item.stale_at ? new Date(item.stale_at).getTime() < Date.now() : false;
  return (
    <span className="flex flex-col gap-1">
      <Markdown measure={false}>{item.summary}</Markdown>
      <span
        className="font-chassis text-chassis-sm text-ink-3"
        title={absoluteTime(item.recorded_at)}
      >
        {titleCase(item.evidence_type)}, recorded{" "}
        {relativeTime(item.recorded_at).toLowerCase()}
      </span>
      {stale ? (
        <Status
          value="stale"
          size="sm"
          label="Stale"
          detail="past its recheck date"
        />
      ) : null}
    </span>
  );
}

function EdgeCaseTable({ rows }: { rows: EdgeCase[] }) {
  const columns: Column<EdgeCase>[] = [
    {
      key: "category",
      label: "Category",
      lead: true,
      cell: (row) => (
        <span className="font-prose text-subtitle text-ink">
          {titleCase(row.category)}
        </span>
      ),
    },
    {
      key: "applicability",
      label: "Applicability",
      cell: (row) => <StatusCell value={row.applicability} />,
    },
    {
      key: "behavior",
      label: "Behaviour Or Reason",
      className: "min-w-[20rem]",
      cell: (row) =>
        value(
          row.behavior ?? row.reason_not_applicable,
          "Neither a behaviour nor a reason for skipping it has been recorded",
        ),
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Edge cases considered for this feature."
      empty={emptyNote(
        "No edge cases recorded",
        "Awkward input, timing and failure cases have not been considered here yet.",
      )}
    />
  );
}

function WorkflowTable({ rows }: { rows: Workflow[] }) {
  const columns: Column<Workflow>[] = [
    {
      key: "name",
      label: "Workflow",
      lead: true,
      className: "min-w-[16rem]",
      cell: (row) => (
        <span className="flex flex-col gap-1">
          <RecordName
            name={row.name}
            id={row.id}
            href={hrefFor("workflows", row.id)}
          />
          <span className="font-prose text-small text-ink-2 prose-measure">
            {row.purpose ?? "No purpose recorded for this workflow."}
          </span>
        </span>
      ),
    },
    {
      key: "trigger",
      label: "Trigger",
      cell: (row) => value(row.trigger, "No trigger recorded"),
    },
    {
      key: "actors",
      label: "Actors",
      cell: (row) => list(row.actors_json, "No actors recorded"),
    },
    {
      key: "completion",
      label: "Completion Criteria",
      className: "min-w-[14rem]",
      cell: (row) =>
        value(
          row.completion_criteria,
          "No completion criteria, so this workflow cannot be called finished",
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Workflows that deliver this feature."
      empty={emptyNote(
        "No workflows",
        "No ordered run of steps has been written for this feature.",
      )}
    />
  );
}

function SurfaceBlock({
  surface,
  states,
  actions,
}: {
  surface: Surface;
  states: SurfaceState[];
  actions: UiAction[];
}) {
  return (
    <div className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RecordName name={surface.name} id={surface.id} />
        <Status value={surface.status} size="sm" />
      </div>

      <Facts
        items={[
          { label: "Type", value: titleCase(surface.surface_type) },
          { label: "Route", value: value(surface.route, "No route recorded") },
          {
            label: "Primary Role",
            value: value(surface.primary_role, "No role recorded"),
          },
          {
            label: "Responsive Behaviour",
            value: value(
              surface.responsive_behavior,
              "Not recorded, so how this behaves on a narrow screen is undefined",
            ),
          },
          {
            label: "Accessibility Notes",
            value: value(
              surface.accessibility_notes,
              "Not recorded, so the keyboard and screen reader behaviour is undefined",
            ),
          },
          {
            label: "Entities Shown",
            value: list(surface.entities_shown_json, "No entities recorded"),
          },
        ]}
      />

      <Prose
        value={surface.purpose}
        fallback="No purpose has been recorded for this surface."
      />

      <div className="flex flex-col gap-2">
        <h5 className="font-chassis text-label text-ink-3 uppercase">
          States, {countPhrase(states.length, "state")}
        </h5>
        {states.length === 0 ? (
          <p className="font-prose text-small text-ink-3 prose-measure">
            No empty, loading, error or offline behaviour has been recorded for
            this surface. Every one of those has to be designed before the
            surface can be accepted.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {states.map((state) => (
              <li key={state.id} className="flex flex-col gap-0.5">
                <span className="font-chassis text-chassis text-ink">
                  {titleCase(state.state_type)}
                </span>
                <span className="font-prose text-small text-ink-2 prose-measure">
                  {state.behavior ?? "No behaviour recorded."}
                  {state.copy ? ` Copy: "${state.copy}"` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h5 className="font-chassis text-label text-ink-3 uppercase">
          UI actions, {countPhrase(actions.length, "action")}
        </h5>
        {actions.length === 0 ? (
          <p className="font-prose text-small text-ink-3 prose-measure">
            No actions have been recorded, so this surface is read only as far as
            the specification is concerned.
          </p>
        ) : (
          <UiActionTable rows={actions} />
        )}
      </div>
    </div>
  );
}

function UiActionTable({ rows }: { rows: UiAction[] }) {
  const columns: Column<UiAction>[] = [
    {
      key: "label",
      label: "Action",
      lead: true,
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-prose text-subtitle text-ink">{row.label}</span>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {row.name}
          </span>
        </span>
      ),
    },
    {
      key: "effect",
      label: "Effect",
      className: "min-w-[14rem]",
      cell: (row) => value(row.effect, "No effect recorded"),
    },
    {
      key: "permission",
      label: "Permission",
      cell: (row) =>
        value(
          row.permission
            ? `${row.permission}${row.enforcement_point ? `, enforced at ${row.enforcement_point}` : ""}`
            : null,
          "No permission recorded",
        ),
    },
    {
      key: "keyboard",
      label: "Keyboard",
      cell: (row) =>
        value(row.keyboard, "No keyboard behaviour recorded for this action"),
    },
    {
      key: "states",
      label: "Loading, Error, Success",
      className: "min-w-[16rem]",
      cell: (row) =>
        value(
          [row.loading_behavior, row.error_behavior, row.success_behavior]
            .filter(Boolean)
            .join(" | ") || null,
          "None of the loading, error or success behaviours are recorded",
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Actions offered by this surface."
      empty={emptyNote(
        "No actions",
        "This surface has no recorded actions.",
      )}
    />
  );
}

function ApiTable({ rows }: { rows: ApiOperation[] }) {
  const columns: Column<ApiOperation>[] = [
    {
      key: "name",
      label: "Operation",
      lead: true,
      className: "min-w-[16rem]",
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <RecordName name={row.name} id={row.id} />
          <span className="font-chassis text-chassis-sm text-ink-2">
            {[row.method_or_procedure, row.path_or_topic]
              .filter(Boolean)
              .join(" ") || "No method or path recorded"}
          </span>
        </span>
      ),
    },
    {
      key: "style",
      label: "Style",
      cell: (row) => titleCase(row.style),
    },
    {
      key: "purpose",
      label: "Purpose",
      className: "min-w-[16rem]",
      cell: (row) => value(row.purpose, "No purpose recorded"),
    },
    {
      key: "auth",
      label: "Authorisation",
      className: "min-w-[12rem]",
      cell: (row) =>
        value(
          [row.auth_requirement, row.permission].filter(Boolean).join(", ") ||
            null,
          "No authorisation requirement recorded",
        ),
    },
    {
      key: "idempotency",
      label: "Idempotency",
      cell: (row) => value(row.idempotency, "Not recorded"),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="API operations belonging to this feature."
      empty={emptyNote(
        "No API operations",
        "This feature exposes and consumes nothing over an interface, as far as the specification says.",
      )}
    />
  );
}

function EntityTable({ rows }: { rows: DataEntity[] }) {
  const columns: Column<DataEntity>[] = [
    {
      key: "name",
      label: "Entity",
      lead: true,
      cell: (row) => (
        <RecordName name={row.name} id={row.id} href={hrefFor("data", row.id)} />
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      className: "min-w-[16rem]",
      cell: (row) => value(row.purpose, "No purpose recorded"),
    },
    {
      key: "store",
      label: "Store",
      cell: (row) => value(row.store, "No store recorded"),
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      cell: (row) =>
        value(
          row.sensitivity_class ? titleCase(row.sensitivity_class) : null,
          "Not classified",
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Data entities this feature reads or writes."
      empty={emptyNote(
        "No entities",
        "This feature does not own or touch any recorded data entity.",
      )}
    />
  );
}

function MigrationTable({ rows }: { rows: SchemaMigration[] }) {
  const columns: Column<SchemaMigration>[] = [
    {
      key: "name",
      label: "Migration",
      lead: true,
      cell: (row) => <RecordName name={row.name} id={row.id} />,
    },
    {
      key: "forward",
      label: "Forward Plan",
      className: "min-w-[16rem]",
      cell: (row) => value(row.forward_plan, "No forward plan recorded"),
    },
    {
      key: "rollback",
      label: "Rollback Plan",
      className: "min-w-[16rem]",
      cell: (row) =>
        value(
          row.rollback_plan,
          "No rollback plan recorded, so this change cannot be safely reversed",
        ),
    },
    {
      key: "applied",
      label: "Applied",
      cell: (row) =>
        row.applied_at ? (
          <span title={absoluteTime(row.applied_at)}>
            {relativeTime(row.applied_at)}
          </span>
        ) : (
          value(null, "Not applied yet")
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Schema migrations belonging to this feature."
      empty={emptyNote(
        "No migrations",
        "This feature does not change the schema.",
      )}
    />
  );
}

function IntegrationTable({ rows }: { rows: Integration[] }) {
  const columns: Column<Integration>[] = [
    {
      key: "name",
      label: "Integration",
      lead: true,
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <RecordName name={row.name} id={row.id} />
          <span className="font-chassis text-chassis-sm text-ink-3">
            {row.provider ?? "No provider recorded"}
          </span>
        </span>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      className: "min-w-[16rem]",
      cell: (row) => value(row.purpose, "No purpose recorded"),
    },
    {
      key: "auth",
      label: "Authentication",
      cell: (row) => value(row.auth_approach, "No approach recorded"),
    },
    {
      key: "failure",
      label: "Failure Behaviour",
      className: "min-w-[14rem]",
      cell: (row) =>
        value(
          row.failure_behavior,
          "Not recorded, so what happens when this is down is undefined",
        ),
    },
    {
      key: "verification",
      label: "Verification",
      cell: (row) => <StatusCell value={row.verification_status ?? row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Outside systems this feature depends on."
      empty={emptyNote(
        "No integrations",
        "This feature depends on no system outside the project.",
      )}
    />
  );
}

function JobTable({ rows }: { rows: Job[] }) {
  const columns: Column<Job>[] = [
    {
      key: "name",
      label: "Job",
      lead: true,
      cell: (row) => <RecordName name={row.name} id={row.id} />,
    },
    {
      key: "trigger",
      label: "Trigger",
      cell: (row) => value(row.trigger, "No trigger recorded"),
    },
    {
      key: "retry",
      label: "Retry Policy",
      cell: (row) => value(row.retry_policy, "No retry policy recorded"),
    },
    {
      key: "failure",
      label: "Failure Destination",
      cell: (row) =>
        value(
          row.failure_destination,
          "Not recorded, so a failed run goes nowhere anyone can see",
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Background jobs belonging to this feature."
      empty={emptyNote("No jobs", "This feature runs nothing in the background.")}
    />
  );
}

function WebhookTable({ rows }: { rows: Webhook[] }) {
  const columns: Column<Webhook>[] = [
    {
      key: "endpoint",
      label: "Webhook",
      lead: true,
      cell: (row) => (
        <RecordName
          name={row.endpoint_or_registration ?? "Unnamed webhook"}
          id={row.id}
        />
      ),
    },
    {
      key: "direction",
      label: "Direction",
      cell: (row) => titleCase(row.direction),
    },
    {
      key: "identity",
      label: "Identity Verification",
      cell: (row) =>
        value(
          row.identity_verification,
          "Not recorded, so the sender is not proven",
        ),
    },
    {
      key: "replay",
      label: "Replay Protection",
      cell: (row) => value(row.replay_protection, "Not recorded"),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Webhooks belonging to this feature."
      empty={emptyNote("No webhooks", "This feature sends and receives none.")}
    />
  );
}

function NfrTable({ rows }: { rows: NonFunctionalRequirement[] }) {
  const columns: Column<NonFunctionalRequirement>[] = [
    {
      key: "requirement",
      label: "Requirement",
      lead: true,
      className: "min-w-[18rem]",
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <Markdown measure={false}>{row.requirement}</Markdown>
          <span className="font-chassis text-chassis-sm text-ink-3">
            {titleCase(row.category)}
          </span>
        </span>
      ),
    },
    {
      key: "target",
      label: "Target",
      cell: (row) =>
        value(
          row.target
            ? `${row.target}${row.target_source ? ` (from ${row.target_source})` : ""}`
            : null,
          "No target set, so this cannot be passed or failed",
        ),
    },
    {
      key: "measurement",
      label: "Measurement Method",
      className: "min-w-[14rem]",
      cell: (row) => value(row.measurement_method, "No method recorded"),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => <StatusCell value={row.status} />,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Non-functional requirements for this feature."
      empty={emptyNote(
        "No non-functional requirements",
        "Nothing has been written about how fast, reliable or secure this has to be.",
      )}
    />
  );
}

function DecisionBlock({ decision }: { decision: Decision }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RecordName
          name={decision.title}
          id={decision.id}
          href={hrefFor("decisions", decision.id)}
          superseded={decision.status === "superseded"}
        />
        <Status value={decision.status} size="sm" />
      </div>
      <Prose
        value={decision.decision}
        fallback="No decision text has been recorded, only the record itself."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Fact label="Why">
          <Prose
            value={decision.observable_rationale}
            fallback="No observable rationale recorded."
          />
        </Fact>
        <Fact label="What It Binds">
          <Bullets
            items={decision.enforcement_json}
            empty="Nothing is recorded as enforcing this decision, so it relies on people remembering it."
          />
        </Fact>
        <Fact label="What Would Reopen It">
          <Bullets
            items={decision.revisit_triggers_json}
            empty="No revisit trigger recorded, so this decision stands until someone challenges it."
          />
        </Fact>
      </div>
    </div>
  );
}

function TaskTree({ tasks }: { tasks: Task[] }) {
  const children = new Map<string, Task[]>();
  const roots: Task[] = [];
  for (const task of tasks) {
    if (task.parent_task_id) {
      const bucket = children.get(task.parent_task_id);
      if (bucket) bucket.push(task);
      else children.set(task.parent_task_id, [task]);
    } else {
      roots.push(task);
    }
  }
  // A subtask whose parent is not in this payload would otherwise vanish.
  const known = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    if (task.parent_task_id && !known.has(task.parent_task_id)) roots.push(task);
  }

  return (
    <ul className="flex flex-col divide-y divide-rule">
      {roots.map((task) => (
        <li key={task.id} className="py-3 first:pt-0 last:pb-0">
          <TaskRow task={task} />
          {(children.get(task.id) ?? []).length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3 border-l border-rule pl-4">
              {(children.get(task.id) ?? []).map((subtask) => (
                <li key={subtask.id}>
                  <TaskRow task={subtask} subtask />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TaskRow({ task, subtask }: { task: Task; subtask?: boolean }) {
  const criteria = task.completion_criteria_json ?? [];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <RecordName
            name={task.name}
            id={task.id}
            href={hrefFor("tasks", task.id)}
          />
          <span className="font-chassis text-chassis-sm text-ink-3">
            {subtask ? "Subtask" : "Task"}
            {task.categoryName ? `, ${task.categoryName}` : ""}
            {task.assignment?.active
              ? ", claimed"
              : ", not claimed by anyone yet"}
          </span>
        </span>
        <Status value={task.status} size="sm" />
      </div>
      {task.expected_outcome ? (
        <p className="font-prose text-small text-ink-2 prose-measure">
          Expected outcome: {task.expected_outcome}
        </p>
      ) : null}
      <p className="font-chassis text-chassis-sm text-ink-3">
        {criteria.length > 0
          ? `${countPhrase(criteria.length, "completion criterion", "completion criteria")} recorded`
          : "No completion criteria recorded, so this task cannot be verified as done"}
      </p>
    </div>
  );
}

function EvidenceTable({ rows }: { rows: VerificationEvidence[] }) {
  const columns: Column<VerificationEvidence>[] = [
    {
      key: "summary",
      label: "Evidence",
      lead: true,
      className: "min-w-[18rem]",
      cell: (row) => (
        <Markdown measure={false}>{row.summary}</Markdown>
      ),
    },
    {
      key: "type",
      label: "Type",
      cell: (row) => titleCase(row.evidence_type),
    },
    {
      key: "reference",
      label: "Reference",
      className: "min-w-[12rem]",
      cell: (row) =>
        row.reference ? (
          <span className="inline-flex items-center gap-1.5 break-all">
            <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
            {row.reference}
          </span>
        ) : (
          value(null, "No reference recorded")
        ),
    },
    {
      key: "recorded",
      label: "Recorded",
      cell: (row) => (
        <span title={absoluteTime(row.recorded_at)}>
          {relativeTime(row.recorded_at)}
          {row.recorded_by ? ` by ${row.recorded_by}` : ""}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      cell: (row) => {
        const stale = row.stale_at
          ? new Date(row.stale_at).getTime() < Date.now()
          : false;
        return (
          <StatusCell
            value={stale ? "stale" : row.status}
            detail={
              stale
                ? `Past its recheck date of ${absoluteTime(row.stale_at)}`
                : null
            }
          />
        );
      },
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Verification evidence recorded against this feature."
      empty={emptyNote(
        "No evidence",
        "Nothing about this feature has been verified by observation yet.",
      )}
    />
  );
}
