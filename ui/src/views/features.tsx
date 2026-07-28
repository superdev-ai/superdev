/**
 * Features: the list on the left, one feature's whole contract on the right.
 *
 * The list is read from GET /api/product, because that is the route that
 * carries every feature. The open feature is read from GET /api/features/:id,
 * which returns the contract hanging off it.
 *
 * Selecting a feature writes it into the address bar as #/features/FEAT-0007,
 * so the page a person is looking at can be copied to someone else and reopened
 * exactly as it was.
 */

import { ArrowLeft, RefreshCw, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Empty } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Panel } from "@/components/product/panel";
import { FeatureDetail } from "@/components/product/feature-detail";
import { resolveDepth } from "@/components/product/depth";
import {
  FreshnessNote,
  ResourceBanner,
  ResourceFallback,
  useResource,
} from "@/components/product/resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFeature, getProduct } from "@/lib/api";
import { countPhrase, progressPhrase, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute } from "@/lib/route";
import type {
  FeatureDetailPayload,
  FeatureSummary,
  ProductPayload,
} from "@/types";
import { cn } from "@/lib/utils";

const ALL_STATUSES = "all";

export function FeaturesView() {
  const { revision } = useLive();
  const { route, go } = useRoute();
  const selectedId = route.record;

  const list = useResource<ProductPayload>(getProduct, "product", revision);
  const features = useMemo(() => list.data?.features ?? [], [list.data]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL_STATUSES);

  const statuses = useMemo(
    () => Array.from(new Set(features.map((item) => item.status))).sort(),
    [features],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return features.filter((feature) => {
      if (status !== ALL_STATUSES && feature.status !== status) return false;
      if (!needle) return true;
      return [feature.name, feature.id, feature.purpose, feature.user_value]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [features, query, status]);

  const filtered = query.trim().length > 0 || status !== ALL_STATUSES;
  const clearFilters = () => {
    setQuery("");
    setStatus(ALL_STATUSES);
  };

  return (
    <>
      <ViewHeader
        view="features"
        actions={
          <Button variant="outline" size="sm" onClick={list.reload}>
            <RefreshCw aria-hidden="true" />
            Refresh the list
          </Button>
        }
      >
        <p className="font-chassis text-chassis-sm text-ink-3">
          {list.data ? `${countPhrase(features.length, "feature")}. ` : ""}
          {selectedId
            ? `Open: ${selectedId}. This address links straight back to it.`
            : "Choose a feature to see its contract. The address bar will carry your choice."}
        </p>
      </ViewHeader>

      <ViewBody>
        <ResourceBanner
          resource={list}
          showing={countPhrase(features.length, "feature")}
        />
        <ResourceFallback
          resource={list}
          subject="the feature list"
          appears="Every feature in this project will appear here with its status, depth and counted progress."
        />

        {list.data ? (
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
            <div
              className={cn(
                // The column is bounded, not just the list inside it. The list
                // had max-h-[70vh] and still added four thousand pixels to the
                // page: a sticky box sized by a viewport unit is measured
                // against the viewport while its flow contribution comes from
                // its content, so the page grew with the number of features
                // even though the list itself scrolled correctly. Capping the
                // column at the screen and clipping there ends that.
                "flex min-w-0 flex-col lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:w-80 lg:shrink-0 lg:overflow-hidden xl:w-96",
                selectedId && "hidden lg:block",
              )}
            >
              <Panel
                id="feature-list"
                title="Features"
                className="min-h-0 flex-1"
                count={
                  filtered
                    ? `${visible.length} of ${countPhrase(features.length, "feature")} shown`
                    : countPhrase(features.length, "feature")
                }
                bodyClassName="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule p-3">
                  <label className="sr-only" htmlFor="feature-search">
                    Search features by name, identifier, purpose or user value
                  </label>
                  <Input
                    id="feature-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search features"
                    className="min-w-0 flex-1"
                  />
                  <label className="sr-only" htmlFor="feature-status">
                    Filter features by status
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger
                      id="feature-status"
                      className="w-36"
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

                {visible.length === 0 ? (
                  <div className="p-4">
                    <Empty
                      density="inline"
                      title={
                        features.length === 0
                          ? "No features yet"
                          : "No features match these filters"
                      }
                      explanation={
                        features.length === 0
                          ? "No feature has been added to this project yet, so there is no contract to open. Features are created from Discovery when a candidate is accepted, or added directly to a module."
                          : "Every feature was filtered out. Widen the search or choose any status to see the whole list again."
                      }
                      details={
                        features.length === 0 ? undefined : (
                          <span>
                            Searched{" "}
                            {query.trim()
                              ? `for "${query.trim()}"`
                              : "for anything"}
                            , status{" "}
                            {status === ALL_STATUSES
                              ? "any"
                              : titleCase(status)}
                            .
                          </span>
                        )
                      }
                      actions={
                        features.length === 0
                          ? [{ label: "Open Product", href: hrefFor("product") }]
                          : [
                              {
                                label: "Clear the filters",
                                onClick: clearFilters,
                              },
                            ]
                      }
                    />
                  </div>
                ) : (
                  <ul
                    aria-label="Features in this project"
                    className="flex max-h-[calc(100dvh-16rem)] min-h-0 flex-1 flex-col divide-y divide-rule overflow-y-auto"
                  >
                    {visible.map((feature) => (
                      <li key={feature.id}>
                        <FeatureListItem
                          feature={feature}
                          selected={feature.id === selectedId}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <p className="px-1 pt-2 font-prose text-small text-ink-3">
                <FreshnessNote meta={list.meta} prefix="This list was read" />
              </p>
            </div>

            <div className={cn("min-w-0 flex-1", !selectedId && "hidden lg:block")}>
              {selectedId ? (
                <div className="flex min-w-0 flex-col gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit lg:hidden"
                    onClick={() => go("features", null)}
                  >
                    <ArrowLeft aria-hidden="true" />
                    Back to all features
                  </Button>
                  <FeaturePane id={selectedId} revision={revision} />
                </div>
              ) : (
                <Empty
                  title="No feature is open"
                  explanation="Choose a feature from the list to see its purpose and user value, scope in and out, acceptance criteria with their verification method and evidence, workflows, surfaces and UI actions, API operations, data entities and migrations, integrations, non-functional requirements, governing decisions, tasks and subtasks, evidence, and the plain-language account of what works now, what remains and what happens next."
                  details={
                    <span>
                      Opening one puts its identifier in the address bar, so the
                      page can be copied and shared.
                    </span>
                  }
                  actions={
                    visible.length > 0
                      ? [
                          {
                            label: `Open ${visible[0].name}`,
                            href: hrefFor("features", visible[0].id),
                          },
                        ]
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        ) : null}
      </ViewBody>
    </>
  );
}

function FeatureListItem({
  feature,
  selected,
}: {
  feature: FeatureSummary;
  selected: boolean;
}) {
  const depth = resolveDepth(feature.spec_depth);
  return (
    <a
      href={hrefFor("features", feature.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2.5 transition-colors duration-[120ms] ease-sd focus-ring",
        selected
          ? "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]"
          : "hover:bg-inset",
      )}
    >
      {selected ? <span className="sr-only">Currently open. </span> : null}
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate font-prose text-subtitle text-ink">
          {feature.name}
        </span>
        <span
          className={cn(
            "shrink-0 font-chassis text-chassis-sm text-ink-3",
            feature.status === "superseded" && "line-through",
          )}
        >
          {feature.id}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Status value={feature.status} size="sm" />
        <span
          className="font-chassis text-chassis-sm text-ink-3"
          title={depth.meaning}
        >
          {depth.label}
        </span>
      </span>
      <span className="font-chassis text-chassis-sm text-ink-2">
        {progressPhrase(feature.progress, "complete")}
      </span>
    </a>
  );
}

/**
 * One feature's contract. It lives in its own component so the read starts when
 * a feature is opened and stops when the feature is closed.
 */
function FeaturePane({ id, revision }: { id: string; revision: number }) {
  const read = useCallback(
    (signal: AbortSignal) => getFeature(id, signal),
    [id],
  );
  const resource = useResource<FeatureDetailPayload>(
    read,
    `feature:${id}`,
    revision,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ResourceBanner resource={resource} showing={`the contract for ${id}`} />
      <ResourceFallback
        resource={resource}
        subject={`the feature ${id}`}
        appears="Its purpose, scope, acceptance criteria, workflows, surfaces, interfaces, data, decisions, tasks and evidence will appear here."
      />
      {resource.data ? (
        <FeatureDetail payload={resource.data} meta={resource.meta} />
      ) : null}
    </div>
  );
}
