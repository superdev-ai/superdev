/**
 * Product: goals, milestones, modules, features and scope, from
 * GET /api/product.
 *
 * Goals and milestones are not a hierarchy. A goal is a lasting outcome and a
 * milestone is a bounded delivery stage, so one goal usually spans several
 * milestones and one milestone usually advances several goals. They are drawn
 * as two parallel lanes with the features that join them named on both sides,
 * rather than one nested inside the other.
 *
 * Focus travels in the address bar: #/product/GOAL-0001 is a shareable link to
 * this page with that goal in focus and the feature list narrowed to it.
 */

// Aliased: the bare name would shadow the global Map constructor this file uses
// for its relationship indexes. Removing the alias breaks buildRelations.
import { Filter, Map as MapIcon, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Markdown } from "@/components/ui/markdown";
import { Empty, Unavailable } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import {
  Bullets,
  DataGrid,
  Fact,
  JumpLink,
  Panel,
  PanelRows,
  Prose,
  RecordLink,
  RecordName,
  StatusCell,
  type Column,
} from "@/components/product/panel";
import {
  FreshnessNote,
  ResourceBanner,
  ResourceFallback,
  useResource,
} from "@/components/product/resource";
import { resolveDepth } from "@/components/product/depth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressMeter } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProduct } from "@/lib/api";
import {
  absoluteTime,
  countPhrase,
  exitConditions,
  listPhrase,
  progressPhrase,
  titleCase,
  truncate,
} from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute } from "@/lib/route";
import type {
  FeatureSummary,
  Goal,
  Milestone,
  Module,
  ProductPayload,
} from "@/types";

type FocusKind = "goal" | "milestone" | "module" | "unknown";

interface Focus {
  kind: FocusKind;
  id: string;
  name: string;
}

type ProductTab = "features" | "plan" | "modules";

const ALL_STATUSES = "all";

export function ProductView() {
  const { revision } = useLive();
  const { route, go } = useRoute();
  const resource = useResource<ProductPayload>(getProduct, "product", revision);
  const { data, meta } = resource;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL_STATUSES);

  const { goals, milestones, modules, features } = useMemo(
    () => ({
      goals: data?.goals ?? [],
      milestones: data?.milestones ?? [],
      modules: data?.modules ?? [],
      features: data?.features ?? [],
    }),
    [data],
  );

  const focus: Focus | null = useMemo(() => {
    const id = route.record;
    if (!id) return null;
    const goal = goals.find((item) => item.id === id);
    if (goal) return { kind: "goal", id, name: goal.name };
    const milestone = milestones.find((item) => item.id === id);
    if (milestone) return { kind: "milestone", id, name: milestone.name };
    const module = modules.find((item) => item.id === id);
    if (module) return { kind: "module", id, name: module.name };
    return { kind: "unknown", id, name: id };
  }, [route.record, goals, milestones, modules]);

  const [tab, setTab] = useState<ProductTab>("features");

  /** A deep link opens the tab that actually holds the record it names. */
  const jumped = useRef<string | null>(null);

  useEffect(() => {
    if (!focus || focus.kind === "unknown" || jumped.current === focus.id) {
      return;
    }
    jumped.current = focus.id;
    setTab(focus.kind === "module" ? "modules" : "plan");
  }, [focus]);

  /**
   * Focusing a goal, milestone or module filters the feature table. That table
   * used to sit directly below, so the effect was visible. Behind a tab it
   * would not be, and a control whose only result is on a page you cannot see
   * reads as broken. So focusing moves you to where the result is.
   */
  const setFocus = (id: string | null) => {
    const clearing = focus?.id === id;
    go("product", clearing ? null : id);
    if (!clearing) {
      // This button promises the features, so claim the jump above before it
      // pulls the tab back to the record's own block.
      jumped.current = id;
      setTab("features");
    }
  };

  const relations = useMemo(
    () => buildRelations(features, goals, milestones),
    [features, goals, milestones],
  );

  const statuses = useMemo(
    () => Array.from(new Set(features.map((item) => item.status))).sort(),
    [features],
  );

  const visibleFeatures = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return features.filter((feature) => {
      if (status !== ALL_STATUSES && feature.status !== status) return false;
      if (focus && focus.kind !== "unknown" && !inFocus(feature, focus)) {
        return false;
      }
      if (!needle) return true;
      return [feature.name, feature.id, feature.purpose, feature.user_value]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [features, query, status, focus]);

  const filtered =
    query.trim().length > 0 ||
    status !== ALL_STATUSES ||
    (focus !== null && focus.kind !== "unknown");

  const clearFilters = () => {
    setQuery("");
    setStatus(ALL_STATUSES);
    go("product", null);
  };

  return (
    <>
      <ViewHeader
        view="product"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* The blueprint used to be a tab here. It is its own page now, so
                the route people already knew has to lead somewhere. */}
            <Button variant="outline" size="sm" asChild>
              <a href={hrefFor("blueprint")}>
                <MapIcon aria-hidden="true" />
                Open the blueprint
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={resource.reload}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
      >
        {data ? (
          <div className="flex flex-col gap-2">
            <div className="max-w-md">
              <ProgressMeter
                progress={data.progress}
                qualifier="complete"
                subject="This project"
              />
            </div>
            <p className="font-chassis text-chassis-sm text-ink-3">
              {`${countPhrase(goals.length, "goal")}, ${countPhrase(
                milestones.length,
                "milestone",
              )}, ${countPhrase(modules.length, "module")}, ${countPhrase(
                features.length,
                "feature",
              )}. `}
              <FreshnessNote meta={meta} />
            </p>
          </div>
        ) : (
          <p className="font-chassis text-chassis-sm text-ink-3">
            The counts and the project progress appear here once the plan has
            been read from the project database.
          </p>
        )}
      </ViewHeader>

      <ViewBody>
        <ResourceBanner
          resource={resource}
          showing={countPhrase(features.length, "feature")}
        />
        <ResourceFallback
          resource={resource}
          subject="the product plan"
          appears="Goals, milestones, modules and features will appear here with their counted progress."
        />

        {data ? (
          <>
            {focus?.kind === "unknown" ? (
              <Unavailable
                title="Nothing in this project matches that link"
                explanation={`This page was opened with ${focus.id} in focus, but no goal, milestone or module with that identifier is in the current plan. It may have been cancelled, superseded or renamed.`}
                actions={[
                  { label: "Clear the focus", onClick: () => go("product", null) },
                ]}
              />
            ) : null}

            {focus && focus.kind !== "unknown" ? (
              <div className="flex flex-wrap items-center gap-2 rounded-sd-md border border-signal-edge bg-signal-wash px-3 py-2">
                <span className="font-chassis text-chassis-sm text-ink-2">
                  Showing only what belongs to
                </span>
                <RecordLink
                  name={focus.name}
                  id={focus.id}
                  href={hrefFor("product", focus.id)}
                />
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {countPhrase(visibleFeatures.length, "feature")} of{" "}
                  {features.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => go("product", null)}
                >
                  <X aria-hidden="true" />
                  Clear the focus
                </Button>
              </div>
            ) : null}

            <Tabs value={tab} onValueChange={(value) => setTab(value as ProductTab)}>
              <TabsList>
                <TabsTrigger value="features">
                  Features
                  <span className="ml-1.5 text-ink-3 tabular-nums">{features.length}</span>
                </TabsTrigger>
                <TabsTrigger value="plan">
                  Goals and milestones
                  <span className="ml-1.5 text-ink-3 tabular-nums">
                    {goals.length + milestones.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="modules">
                  Modules
                  <span className="ml-1.5 text-ink-3 tabular-nums">{modules.length}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="flex flex-col gap-4">
              <Panel
                id="product-features"
                title="Features"
                count={
                  filtered
                    ? `${visibleFeatures.length} of ${countPhrase(features.length, "feature")} shown`
                    : countPhrase(features.length, "feature")
                }
                description="Open a feature to see its full contract: acceptance criteria, workflows, surfaces, interfaces, data, decisions, tasks and evidence."
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="product-feature-search">
                      Search features by name, identifier, purpose or user value
                    </label>
                    <Input
                      id="product-feature-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search features"
                      className="w-44"
                    />
                    <label className="sr-only" htmlFor="product-feature-status">
                      Filter features by status
                    </label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger
                        id="product-feature-status"
                        className="w-40"
                        aria-label="Filter features by status"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_STATUSES}>Any status</SelectItem>
                        {statuses.map((value) => (
                          <SelectItem key={value} value={value}>
                            {titleCase(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filtered ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        <X aria-hidden="true" />
                        Clear the filters
                      </Button>
                    ) : null}
                  </div>
                }
                bodyClassName=""
              >
                {focus && focus.kind !== "unknown" ? (
                  <p
                    role="status"
                    className="border-b border-rule bg-signal-wash px-4 py-2 font-prose text-small text-ink"
                  >
                    Showing only the features that{" "}
                    {focus.kind === "goal"
                      ? "support the goal"
                      : focus.kind === "milestone"
                        ? "are delivered in the milestone"
                        : "belong to the module"}{" "}
                    {focus.name} ({focus.id}).{" "}
                    <button
                      type="button"
                      onClick={() => go("product", null)}
                      className="rounded-sd underline underline-offset-4 hover:text-signal focus-ring"
                    >
                      Show every feature
                    </button>
                  </p>
                ) : null}

                <FeatureTable
                  features={visibleFeatures}
                  modules={modules}
                  milestones={milestones}
                  empty={
                    <Empty
                      density="inline"
                      title={
                        features.length === 0
                          ? "No features yet"
                          : "No features match these filters"
                      }
                      explanation={
                        features.length === 0
                          ? "No feature has been added to this project. Features are created from Discovery when a candidate is accepted, or added directly to a module."
                          : "Every feature was filtered out. Widen the search, choose any status, or clear the focus to see the whole list again."
                      }
                      details={
                        features.length === 0 ? undefined : (
                          <span>
                            Searched{" "}
                            {query.trim() ? `for "${query.trim()}"` : "for anything"}
                            , status{" "}
                            {status === ALL_STATUSES ? "any" : titleCase(status)}
                            {focus && focus.kind !== "unknown"
                              ? `, focused on ${focus.name} (${focus.id})`
                              : ""}
                            .
                          </span>
                        )
                      }
                      actions={
                        features.length === 0
                          ? [{ label: "Open Discovery", href: hrefFor("discovery") }]
                          : [{ label: "Clear the filters", onClick: clearFilters }]
                      }
                    />
                  }
                />
              </Panel>
              <ScopePanel features={visibleFeatures} narrowed={filtered} />
              </TabsContent>

              <TabsContent value="plan">
              <Panel
                id="product-relationship"
                title="Goals and milestones"
                description="A goal is a lasting outcome. A milestone is a bounded delivery stage. They are independent: one goal usually spans several milestones, and one milestone usually advances several goals. Features are what join them, so each side below names the features that connect it to the other."
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <h4 className="font-chassis text-label text-ink-3 uppercase">
                      Goals, lasting outcomes, {countPhrase(goals.length, "goal")}
                    </h4>
                    {goals.length === 0 ? (
                      <Empty
                        density="inline"
                        title="No goals yet"
                        explanation="No lasting outcome has been agreed for this project, so nothing here can say whether the work is worth doing. Goals are created from Discovery when a candidate is accepted."
                        actions={[
                          { label: "Open Discovery", href: hrefFor("discovery") },
                        ]}
                      />
                    ) : (
                      <PanelRows>
                        {goals.map((goal) => (
                          <GoalBlock
                            key={goal.id}
                            goal={goal}
                            milestones={relations.milestonesByGoal.get(goal.id) ?? []}
                            featureCount={
                              relations.featuresByGoal.get(goal.id)?.length ?? 0
                            }
                            focused={focus?.id === goal.id}
                            onToggle={() => setFocus(goal.id)}
                          />
                        ))}
                      </PanelRows>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 xl:border-l xl:border-rule xl:pl-4">
                    <h4 className="font-chassis text-label text-ink-3 uppercase">
                      Milestones, delivery stages,{" "}
                      {countPhrase(milestones.length, "milestone")}
                    </h4>
                    {milestones.length === 0 ? (
                      <Empty
                        density="inline"
                        title="No milestones yet"
                        explanation="No delivery stage has been defined, so features are not grouped into anything that can be finished and shipped. Milestones are added as the plan is broken into stages."
                        actions={[
                          { label: "Open the overview", href: hrefFor("overview") },
                        ]}
                      />
                    ) : (
                      <PanelRows>
                        {milestones.map((milestone) => (
                          <MilestoneBlock
                            key={milestone.id}
                            milestone={milestone}
                            goals={relations.goalsByMilestone.get(milestone.id) ?? []}
                            featureCount={
                              relations.featuresByMilestone.get(milestone.id)
                                ?.length ?? 0
                            }
                            focused={focus?.id === milestone.id}
                            onToggle={() => setFocus(milestone.id)}
                          />
                        ))}
                      </PanelRows>
                    )}
                  </div>
                </div>
              </Panel>
              </TabsContent>

              <TabsContent value="modules">
              <Panel
                id="product-modules"
                title="Modules"
                count={countPhrase(modules.length, "module")}
                description="A module owns a slice of the product. Its progress is derived from the features inside it, never estimated."
                bodyClassName=""
              >
                <ModuleTable
                  modules={modules}
                  featureCounts={relations.featuresByModule}
                  focusId={focus?.kind === "module" ? focus.id : null}
                  onToggle={setFocus}
                />
              </Panel>
              </TabsContent>

            </Tabs>

            <p className="px-1 font-prose text-small text-ink-3">
              <FreshnessNote meta={meta} prefix="Every figure on this page was read" />{" "}
              Progress is derived from the accepted contract of each record, so a
              record with no completion criteria reads Not measurable rather than
              zero.
            </p>
          </>
        ) : null}
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Relationships
   --------------------------------------------------------------------------- */

interface Relations {
  featuresByGoal: Map<string, FeatureSummary[]>;
  featuresByMilestone: Map<string, FeatureSummary[]>;
  featuresByModule: Map<string, FeatureSummary[]>;
  milestonesByGoal: Map<string, Milestone[]>;
  goalsByMilestone: Map<string, Goal[]>;
}

function push<T>(map: Map<string, T[]>, key: string, item: T) {
  const bucket = map.get(key);
  if (bucket) bucket.push(item);
  else map.set(key, [item]);
}

function buildRelations(
  features: FeatureSummary[],
  goals: Goal[],
  milestones: Milestone[],
): Relations {
  const featuresByGoal = new Map<string, FeatureSummary[]>();
  const featuresByMilestone = new Map<string, FeatureSummary[]>();
  const featuresByModule = new Map<string, FeatureSummary[]>();
  const milestoneIdsByGoal = new Map<string, Set<string>>();
  const goalIdsByMilestone = new Map<string, Set<string>>();

  for (const feature of features) {
    if (feature.module_id) push(featuresByModule, feature.module_id, feature);
    if (feature.milestone_id) {
      push(featuresByMilestone, feature.milestone_id, feature);
    }
    for (const goalId of feature.goalIds ?? []) {
      push(featuresByGoal, goalId, feature);
      if (feature.milestone_id) {
        const forGoal = milestoneIdsByGoal.get(goalId) ?? new Set<string>();
        forGoal.add(feature.milestone_id);
        milestoneIdsByGoal.set(goalId, forGoal);

        const forMilestone =
          goalIdsByMilestone.get(feature.milestone_id) ?? new Set<string>();
        forMilestone.add(goalId);
        goalIdsByMilestone.set(feature.milestone_id, forMilestone);
      }
    }
  }

  const milestoneById = new Map(milestones.map((item) => [item.id, item]));
  const goalById = new Map(goals.map((item) => [item.id, item]));

  const milestonesByGoal = new Map<string, Milestone[]>();
  for (const [goalId, ids] of milestoneIdsByGoal) {
    milestonesByGoal.set(
      goalId,
      [...ids].map((id) => milestoneById.get(id)).filter(Boolean) as Milestone[],
    );
  }

  const goalsByMilestone = new Map<string, Goal[]>();
  for (const [milestoneId, ids] of goalIdsByMilestone) {
    goalsByMilestone.set(
      milestoneId,
      [...ids].map((id) => goalById.get(id)).filter(Boolean) as Goal[],
    );
  }

  return {
    featuresByGoal,
    featuresByMilestone,
    featuresByModule,
    milestonesByGoal,
    goalsByMilestone,
  };
}

function inFocus(feature: FeatureSummary, focus: Focus): boolean {
  if (focus.kind === "goal") return (feature.goalIds ?? []).includes(focus.id);
  if (focus.kind === "milestone") return feature.milestone_id === focus.id;
  if (focus.kind === "module") return feature.module_id === focus.id;
  return true;
}

/* ---------------------------------------------------------------------------
   Goal and milestone blocks
   --------------------------------------------------------------------------- */

function FocusToggle({
  focused,
  onToggle,
  what,
}: {
  focused: boolean;
  onToggle: () => void;
  /** Named in the accessible label, e.g. "the goal Reliable delivery". */
  what: string;
}) {
  return (
    <Button
      variant={focused ? "default" : "outline"}
      size="sm"
      aria-pressed={focused}
      onClick={onToggle}
    >
      {focused ? <X aria-hidden="true" /> : <Filter aria-hidden="true" />}
      {focused ? "Clear focus" : "Show its features"}
      <span className="sr-only">
        {focused
          ? `. Stop narrowing the feature list to ${what}.`
          : `. Narrow the feature list to ${what}.`}
      </span>
    </Button>
  );
}

function GoalBlock({
  goal,
  milestones,
  featureCount,
  focused,
  onToggle,
}: {
  goal: Goal;
  milestones: Milestone[];
  featureCount: number;
  focused: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      id={`goal-${goal.id}`}
      tabIndex={-1}
      className={
        focused
          ? "flex flex-col gap-3 rounded-sd bg-signal-wash py-3 pl-3 shadow-[inset_2px_0_0_var(--sd-signal)] focus-ring"
          : "flex flex-col gap-3 py-3 focus-ring"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <RecordName
          name={goal.name}
          id={goal.id}
          href={hrefFor("product", goal.id)}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Status value={goal.status} size="sm" />
          <FocusToggle
            focused={focused}
            onToggle={onToggle}
            what={`the goal ${goal.name}`}
          />
        </div>
      </div>

      <Prose
        value={goal.why_it_matters ?? goal.description}
        fallback="No reason has been recorded for this goal, so it is not written down why the project should care about it."
      />

      <ProgressMeter
        progress={goal.progress}
        qualifier="met"
        subject="This goal"
      />

      <Fact
        label={`Success Criteria, ${countPhrase(goal.successCriteria?.length ?? 0, "criterion", "criteria")}`}
      >
        {goal.successCriteria && goal.successCriteria.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {goal.successCriteria.map((criterion) => (
              <li key={criterion.id} className="flex flex-col gap-1">
                <Markdown measure={false}>{criterion.criterion}</Markdown>
                <span className="flex flex-wrap items-center gap-2">
                  <Status value={criterion.status} size="sm" />
                  <span className="font-chassis text-chassis-sm text-ink-3">
                    {criterion.target
                      ? `Target ${criterion.target}`
                      : "No target set"}
                    {criterion.measurement_method
                      ? `, measured by ${criterion.measurement_method}`
                      : ", no measurement method recorded"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="font-prose text-small text-ink-3 prose-measure">
            No success criteria have been written, so this goal cannot be
            measured and its progress reads Not measurable.
          </span>
        )}
      </Fact>

      <p className="font-prose text-small text-ink-2 prose-measure">
        {milestones.length === 0
          ? `Supported by ${countPhrase(featureCount, "feature")}, none of which is scheduled into a milestone yet, so this goal is not attached to any delivery stage.`
          : `Spans ${countPhrase(milestones.length, "milestone")}, through ${countPhrase(featureCount, "feature")}: `}
        {milestones.map((milestone, index) => (
          <span key={milestone.id}>
            {index > 0 ? ", " : ""}
            <JumpLink
              targetId={`milestone-${milestone.id}`}
              className="font-prose text-small text-ink"
            >
              {milestone.name}
            </JumpLink>
          </span>
        ))}
        {milestones.length > 0 ? "." : ""}
      </p>
    </div>
  );
}

function MilestoneBlock({
  milestone,
  goals,
  featureCount,
  focused,
  onToggle,
}: {
  milestone: Milestone;
  goals: Goal[];
  featureCount: number;
  focused: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      id={`milestone-${milestone.id}`}
      tabIndex={-1}
      className={
        focused
          ? "flex flex-col gap-3 rounded-sd bg-signal-wash py-3 pl-3 shadow-[inset_2px_0_0_var(--sd-signal)] focus-ring"
          : "flex flex-col gap-3 py-3 focus-ring"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <RecordName
          name={milestone.name}
          id={milestone.id}
          href={hrefFor("product", milestone.id)}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Status value={milestone.status} size="sm" />
          <FocusToggle
            focused={focused}
            onToggle={onToggle}
            what={`the milestone ${milestone.name}`}
          />
        </div>
      </div>

      <Prose
        value={milestone.outcome}
        fallback="No outcome has been recorded for this milestone, so there is nothing written down that says when it is finished."
      />

      <ProgressMeter
        progress={milestone.progress}
        qualifier="delivered"
        subject="This milestone"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact label="Entry Conditions">
          <Bullets
            items={milestone.entry_conditions_json}
            empty="No entry conditions recorded, so this stage can be started at any time."
          />
        </Fact>
        <Fact label="Exit Conditions">
          {/*
            Each condition with its own verdict and the reading that decided it.
            The unmet ones matter most and were the ones losing their reading:
            "not met" with no reason is the shape of a stage nobody can act on.
          */}
          {exitConditions(milestone.exit_conditions_json).length === 0 ? (
            <span className="font-prose text-small text-ink-3">
              No exit conditions recorded, so there is no agreed test for calling this stage
              finished.
            </span>
          ) : (
            <ul className="flex flex-col gap-2">
              {exitConditions(milestone.exit_conditions_json).map((condition) => (
                <li key={condition.condition} className="flex flex-col gap-0.5">
                  <span className="font-prose text-small text-ink-1 prose-measure">
                    {condition.met === null
                      ? condition.condition
                      : `${condition.met ? "Met" : "Not met"}: ${condition.condition}`}
                  </span>
                  {condition.reading ? (
                    <span className="font-prose text-small text-ink-2 prose-measure">
                      {condition.reading}
                    </span>
                  ) : null}
                  {condition.check ? (
                    <span className="font-chassis text-chassis-sm text-ink-3">{condition.check}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Fact>
      </div>

      <Fact label="Target Date">
        {milestone.target_date ? (
          <span title={absoluteTime(milestone.target_date)}>
            {absoluteTime(milestone.target_date)}
          </span>
        ) : (
          <span className="font-prose text-small text-ink-3">
            No target date set
          </span>
        )}
      </Fact>

      <p className="font-prose text-small text-ink-2 prose-measure">
        {goals.length === 0
          ? `Delivers ${countPhrase(featureCount, "feature")}, none of which is linked to a goal, so finishing this stage will not visibly move a stated outcome.`
          : `Advances ${countPhrase(goals.length, "goal")}, through ${countPhrase(featureCount, "feature")}: `}
        {goals.map((goal, index) => (
          <span key={goal.id}>
            {index > 0 ? ", " : ""}
            <JumpLink
              targetId={`goal-${goal.id}`}
              className="font-prose text-small text-ink"
            >
              {goal.name}
            </JumpLink>
          </span>
        ))}
        {goals.length > 0 ? "." : ""}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Tables
   --------------------------------------------------------------------------- */

function ModuleTable({
  modules,
  featureCounts,
  focusId,
  onToggle,
}: {
  modules: Module[];
  featureCounts: Map<string, FeatureSummary[]>;
  focusId: string | null;
  onToggle: (id: string) => void;
}) {
  const columns: Column<Module>[] = [
    {
      key: "name",
      label: "Module",
      lead: true,
      className: "min-w-[14rem]",
      cell: (row) => (
        <button
          type="button"
          aria-pressed={focusId === row.id}
          onClick={() => onToggle(row.id)}
          className="flex min-w-0 items-baseline gap-2 rounded-sd text-left hover:text-signal focus-ring"
        >
          <span className="truncate font-prose text-subtitle text-ink">
            {row.name}
          </span>
          <span className="shrink-0 font-chassis text-chassis-sm text-ink-3">
            {row.id}
          </span>
          <span className="sr-only">
            {focusId === row.id
              ? ". Focused. Activate to show every feature again."
              : ". Activate to narrow the feature list to this module."}
          </span>
        </button>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      className: "min-w-[18rem]",
      cell: (row) =>
        row.purpose ? (
          <span title={row.purpose} className="font-prose text-body text-ink-2">
            {truncate(row.purpose, 160)}
          </span>
        ) : (
          <span className="font-prose text-small text-ink-3">
            No purpose recorded
          </span>
        ),
    },
    {
      // A module is defined as much by where it stops as by what it does, and
      // the interview asks for both. Showing only the purpose lets two modules
      // look like they overlap when the record says they do not.
      key: "outOfScope",
      label: "Outside its scope",
      className: "min-w-[16rem]",
      cell: (row) =>
        row.out_of_scope ? (
          <span title={row.out_of_scope} className="font-prose text-body text-ink-2">
            {truncate(row.out_of_scope, 140)}
          </span>
        ) : (
          <span className="font-prose text-small text-ink-3">
            No boundary recorded
          </span>
        ),
    },
    {
      key: "owns",
      label: "Owns",
      className: "min-w-[12rem]",
      cell: (row) => {
        const owns = (row.owns_json ?? []).filter(Boolean);
        return owns.length > 0 ? (
          <span title={listPhrase(owns)}>{truncate(listPhrase(owns), 70)}</span>
        ) : (
          <span className="font-prose text-small text-ink-3">
            Nothing recorded as owned
          </span>
        );
      },
    },
    {
      key: "features",
      label: "Features",
      numeric: true,
      cell: (row) =>
        countPhrase(featureCounts.get(row.id)?.length ?? 0, "feature"),
    },
    {
      key: "progress",
      label: "Progress",
      className: "min-w-[14rem]",
      cell: (row) => (
        <span className="font-chassis text-chassis-sm text-ink-2">
          {progressPhrase(row.progress, "complete")}
        </span>
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
      rows={modules}
      rowKey={(row) => row.id}
      selectedKey={focusId}
      blocked={(row) => row.status === "blocked"}
      caption="Modules in this project, with the features they hold and their derived progress."
      empty={
        <Empty
          density="inline"
          title="No modules yet"
          explanation="The product has not been divided into modules, so features are not grouped by the part of the system they belong to. Modules are added as the architecture is decided."
          actions={[{ label: "Open Architecture", href: hrefFor("architecture") }]}
        />
      }
    />
  );
}

function FeatureTable({
  features,
  modules,
  milestones,
  empty,
}: {
  features: FeatureSummary[];
  modules: Module[];
  milestones: Milestone[];
  empty: React.ReactNode;
}) {
  const moduleById = new Map(modules.map((item) => [item.id, item.name]));
  const milestoneById = new Map(milestones.map((item) => [item.id, item.name]));

  const columns: Column<FeatureSummary>[] = [
    {
      key: "name",
      label: "Feature",
      lead: true,
      className: "min-w-[16rem]",
      cell: (row) => (
        <RecordName
          name={row.name}
          id={row.id}
          href={hrefFor("features", row.id)}
          superseded={row.status === "superseded"}
        />
      ),
    },
    {
      key: "module",
      label: "Module",
      cell: (row) =>
        row.module_id ? (
          <RecordLink
            name={moduleById.get(row.module_id) ?? "Not in the current plan"}
            id={row.module_id}
            href={hrefFor("product", row.module_id)}
          />
        ) : (
          <span className="font-prose text-small text-ink-3">
            Not in a module
          </span>
        ),
    },
    {
      key: "milestone",
      label: "Milestone",
      cell: (row) =>
        row.milestone_id ? (
          <RecordLink
            name={
              milestoneById.get(row.milestone_id) ?? "Not in the current plan"
            }
            id={row.milestone_id}
            href={hrefFor("product", row.milestone_id)}
          />
        ) : (
          <span className="font-prose text-small text-ink-3">Not scheduled</span>
        ),
    },
    {
      key: "goals",
      label: "Goals",
      numeric: true,
      cell: (row) => countPhrase((row.goalIds ?? []).length, "goal"),
    },
    {
      key: "depth",
      label: "Depth",
      cell: (row) => {
        const depth = resolveDepth(row.spec_depth);
        return <span title={depth.meaning}>{depth.label}</span>;
      },
    },
    {
      key: "progress",
      label: "Progress",
      className: "min-w-[14rem]",
      cell: (row) => (
        <span className="font-chassis text-chassis-sm text-ink-2">
          {progressPhrase(row.progress, "complete")}
        </span>
      ),
    },
    {
      key: "next",
      label: "Next Action",
      className: "min-w-[16rem]",
      cell: (row) =>
        row.next_action ? (
          <span title={row.next_action} className="font-prose text-body text-ink-2">
            {truncate(row.next_action, 120)}
          </span>
        ) : (
          <span className="font-prose text-small text-ink-3">
            No next action recorded
          </span>
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
      rows={features}
      rowKey={(row) => row.id}
      blocked={(row) => row.status === "blocked"}
      caption="Features in this project, with the module and milestone they belong to, their specification depth and their counted progress."
      empty={empty}
    />
  );
}

/* ---------------------------------------------------------------------------
   Product blueprint
   --------------------------------------------------------------------------- */

/**
 * The whole product as one map, per section 15.3.
 *
 * It is closed until asked for. The map needs the workflows and the tasks as
 * well as the plan, and paying for three extra reads before anyone has said
 * they want a picture would make the page slower to its first useful sentence.
 */

/* ---------------------------------------------------------------------------
   Scope
   --------------------------------------------------------------------------- */

function ScopePanel({
  features,
  narrowed,
}: {
  features: FeatureSummary[];
  /** True when the feature list above is filtered, so this list is too. */
  narrowed: boolean;
}) {
  const inScope: { feature: FeatureSummary; text: string }[] = [];
  const outOfScope: { feature: FeatureSummary; text: string }[] = [];
  for (const feature of features) {
    for (const text of feature.scope_in_json ?? []) {
      if (text) inScope.push({ feature, text });
    }
    for (const text of feature.scope_out_json ?? []) {
      if (text) outOfScope.push({ feature, text });
    }
  }

  return (
    <Panel
      id="product-scope"
      title="Scope"
      count={`${countPhrase(inScope.length, "statement")} in scope, ${countPhrase(outOfScope.length, "statement")} out of scope`}
      description={
        narrowed
          ? `Scope is declared feature by feature. These statements come from the ${countPhrase(features.length, "feature")} shown in the list above.`
          : "Scope is declared feature by feature. These are every in-scope and out-of-scope statement across the project, each attributed to the feature that declares it."
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScopeColumn
          title="In scope"
          items={inScope}
          empty="No feature declares anything as in scope. What the project covers is therefore decided only by the acceptance criteria on each feature."
        />
        <ScopeColumn
          title="Out of scope"
          items={outOfScope}
          empty="No feature declares anything as out of scope. Anything deliberately excluded should be written down here, or it will be rediscovered later as a gap."
        />
      </div>
    </Panel>
  );
}

function ScopeColumn({
  title,
  items,
  empty,
}: {
  title: string;
  items: { feature: FeatureSummary; text: string }[];
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-chassis text-label text-ink-3 uppercase">
        {title}, {countPhrase(items.length, "statement")}
      </h4>
      {items.length === 0 ? (
        <p className="font-prose text-small text-ink-3 prose-measure">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule">
          {items.map((item, index) => (
            <li
              key={`${item.feature.id}-${index}`}
              className="flex flex-col gap-1 py-2 first:pt-0"
            >
              <span className="font-prose text-body text-ink-2 prose-measure">
                {item.text}
              </span>
              <a
                href={hrefFor("features", item.feature.id)}
                className="w-fit rounded-sd font-chassis text-chassis-sm text-ink-3 hover:text-signal focus-ring"
              >
                {item.feature.name} {item.feature.id}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
