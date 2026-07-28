/**
 * UI Surfaces: every screen, panel or modal the product has, and the actions
 * on each. Section 16.1 of docs/prd.md required this area; before this view
 * the twenty surfaces and twenty eight actions already in the database were
 * reachable from nowhere.
 *
 * A surface with no action recorded says so in plain language rather than
 * showing an empty list: a screen where nothing can be done is either read
 * only or unfinished, and the record does not yet say which.
 */

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  CountStrip,
  Facts,
  FreshnessLine,
  Panel,
  RecordName,
  Tag,
  Value,
  ValueList,
  useResource,
} from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Empty, ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSurfaces } from "@/lib/api";
import { countPhrase, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type { SurfaceRecord, UiActionRecord } from "@/types";

export function SurfacesView() {
  const { route, go } = useRoute();
  const { revision } = useLive();
  const surfaces = useResource(getSurfaces, revision);
  const [query, setQuery] = useState("");

  const payload = surfaces.data;
  const all = useMemo(() => payload?.surfaces ?? [], [payload]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((surface) =>
      `${surface.name} ${surface.id} ${surface.route ?? ""} ${surface.module_name ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [all, query]);

  const withoutActions = useMemo(
    () => all.filter((surface) => surface.actions.length === 0),
    [all],
  );

  const selected = useMemo(() => {
    if (all.length === 0) return null;
    return all.find((surface) => surface.id === route.record) ?? filtered[0] ?? all[0];
  }, [all, filtered, route.record]);

  if (surfaces.pending && surfaces.loading) {
    return (
      <>
        <ViewHeader view="surfaces" />
        <ViewBody>
          <Loading
            title="Loading the UI surfaces"
            explanation="Reading every screen, panel and modal the product has, and the actions recorded on each, from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="surfaces" />
        <ViewBody>
          {surfaces.offline ? (
            <Offline onReconnect={surfaces.reload} state="offline" />
          ) : (
            <ErrorState
              title="The UI surfaces did not load"
              error={surfaces.error}
              onRetry={surfaces.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const counts = [
    { label: "Surfaces", value: payload.counts.surfaces, unit: "recorded" },
    { label: "Actions", value: payload.counts.actions, unit: "recorded" },
    {
      label: "No action recorded",
      value: withoutActions.length,
      unit: withoutActions.length === 1 ? "surface" : "surfaces",
    },
  ];

  return (
    <>
      <ViewHeader view="surfaces">
        <CountStrip items={counts} className="-mx-1" />
        <FreshnessLine
          meta={surfaces.meta}
          loading={surfaces.loading}
          onRefresh={surfaces.reload}
        />
      </ViewHeader>

      <ViewBody>
        {surfaces.meta?.stale ? (
          <Stale
            meta={surfaces.meta}
            onRefresh={surfaces.reload}
            showing={countPhrase(all.length, "surface")}
          />
        ) : null}

        {surfaces.error && surfaces.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${surfaces.error.message} Everything below is the last reading that arrived.`}
            onRetry={surfaces.reload}
          />
        ) : null}

        {all.length === 0 ? (
          <Empty
            title="No UI surfaces have been recorded yet"
            explanation="A surface is a screen, panel or modal the product shows to someone. Record one with superdev surface record, naming it, the feature it belongs to and each action a person can take on it. Its empty, loading and error states go in with superdev surface state."
            actions={[{ label: "Open Features", href: hrefFor("features") }]}
          />
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <SurfaceList
              surfaces={filtered}
              total={all.length}
              query={query}
              onQuery={setQuery}
              selectedId={selected?.id ?? null}
              onSelect={(id) => go("surfaces", id)}
            />

            {selected ? (
              <SurfaceDetail surface={selected} />
            ) : (
              <Empty
                title="Nothing matches that search"
                explanation="No surface name, identifier, route or module contains that text. Clear the search to see all of them again."
                details={<span>Searched for "{query}".</span>}
                actions={[{ label: "Clear the search", onClick: () => setQuery("") }]}
              />
            )}
          </div>
        )}
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   The surface list
   --------------------------------------------------------------------------- */

function SurfaceList({
  surfaces,
  total,
  query,
  onQuery,
  selectedId,
  onSelect,
}: {
  surfaces: SurfaceRecord[];
  total: number;
  query: string;
  onQuery: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel
      title="Surfaces"
      description={
        query
          ? `Showing ${surfaces.length} of ${countPhrase(total, "surface")} matching "${query}".`
          : `${countPhrase(total, "surface")} recorded on this project.`
      }
      bodyClassName="p-0"
      className="h-fit lg:sticky lg:top-16"
    >
      <div className="border-b border-rule p-2">
        <label className="sr-only" htmlFor="surface-search">
          Search surfaces by name, identifier, route or module
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-3"
          />
          <Input
            id="surface-search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search surfaces"
            className="pl-7"
          />
        </div>
      </div>

      {surfaces.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="Nothing matches that search"
          explanation="Clear the search to bring every surface back."
          details={<span>Searched for "{query}".</span>}
          actions={[{ label: "Clear the search", onClick: () => onQuery("") }]}
        />
      ) : (
        <ul className="max-h-[28rem] overflow-y-auto lg:max-h-[calc(100vh-16rem)]">
          {surfaces.map((surface) => {
            const active = surface.id === selectedId;
            return (
              <li key={surface.id}>
                <button
                  type="button"
                  onClick={() => onSelect(surface.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-rule px-3 py-2 text-left transition-colors duration-[120ms] ease-sd focus-ring row-edge-focus",
                    active
                      ? "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]"
                      : "hover:bg-inset",
                  )}
                >
                  <RecordName name={surface.name} id={surface.id} size="sm" />
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Status value={surface.status} size="sm" />
                    <Tag>{countPhrase(surface.actions.length, "action")}</Tag>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   One surface
   --------------------------------------------------------------------------- */

function SurfaceDetail({ surface }: { surface: SurfaceRecord }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel
        title={surface.name}
        description={
          <Value missing="No purpose has been written for this surface yet, so what it is for has to be inferred from what it shows.">
            {surface.purpose}
          </Value>
        }
        actions={<Status value={surface.status} />}
      >
        <Facts
          columns={2}
          items={[
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {surface.id}
                </span>
              ),
            },
            {
              label: "Route",
              value: surface.route ? (
                <span className="font-chassis text-chassis-sm text-ink-2">
                  {surface.route}
                </span>
              ) : (
                <Value missing="No route recorded">{surface.route}</Value>
              ),
            },
            {
              label: "Kind",
              value: <Value missing="Not recorded">{titleCase(surface.surface_type)}</Value>,
            },
            {
              label: "Module",
              value: <Value missing="No module recorded">{surface.module_name}</Value>,
            },
            {
              label: "Feature",
              value: <Value missing="No feature recorded">{surface.feature_name}</Value>,
            },
            {
              label: "Primary role",
              value: <Value missing="No primary role recorded">{surface.primary_role}</Value>,
            },
          ]}
        />

        {/* Wide fields, on their own row: Facts has no per-item column span,
            and forcing these two into the two column grid squeezed the entity
            list and the accessibility prose into a half-width column. */}
        <Facts
          columns={1}
          className="mt-3"
          items={[
            {
              label: "What it shows",
              value: <ValueList items={surface.entities_shown_json} missing="No entity recorded" />,
            },
            {
              label: "Accessibility notes",
              value: (
                <Value missing="No accessibility notes recorded for this surface.">
                  {surface.accessibility_notes}
                </Value>
              ),
            },
          ]}
        />
      </Panel>

      <ActionsPanel surface={surface} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Actions on the surface
   --------------------------------------------------------------------------- */

function ActionsPanel({ surface }: { surface: SurfaceRecord }) {
  const actions = surface.actions;

  return (
    <Panel
      title="Actions on this surface"
      description="What a person can do here, its trigger and what it does when it fires."
      bodyClassName="p-0"
    >
      {actions.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No action is recorded on this surface"
          explanation="A screen with no recorded action is either read only by design, or its interactions have not been specified yet. The record does not yet say which, so treat this as an open question rather than assuming it is finished."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Effect</TableHead>
              <TableHead>Confirmation</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action: UiActionRecord) => (
              <TableRow key={action.id}>
                <TableCell className="font-prose text-ink">
                  <span className="flex flex-col">
                    <span>{action.label || action.name}</span>
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {action.id}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="No trigger recorded">{action.trigger}</Value>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="No effect recorded">{action.effect}</Value>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="None required">{action.confirmation}</Value>
                </TableCell>
                <TableCell>
                  <Status value={action.status} size="sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
