/**
 * APIs: every operation the product exposes, and the service that owns it.
 *
 * Reads GET /api/apis. A service is the boundary that owns operations (PRD
 * section 6.1), so an operation with no `api_service_id` is not a formatting
 * quirk: it means that boundary was never recorded for it. Those operations
 * get their own clearly labelled group instead of being silently folded into
 * whichever service happens to be first, which would hide the gap.
 *
 * The one distinction this surface exists to make readable is whether an
 * operation changes state, because that is what separates a read from
 * something that writes, so it is the one filter offered.
 */

import { Eye, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import {
  CountStrip,
  Facts,
  FreshnessLine,
  Panel,
  RecordName,
  Tag,
  Value,
  useResource,
} from "@/components/diagrams/view-kit";
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
import { getApis } from "@/lib/api";
import { countPhrase, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { cn } from "@/lib/utils";
import type { ApiOperationRecord, ApiServiceRecord } from "@/types";

/* ---------------------------------------------------------------------------
   The one filter this surface offers
   --------------------------------------------------------------------------- */

type Filter = "all" | "changes" | "read_only";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All operations",
  changes: "Changes state",
  read_only: "Read only",
};

const FILTER_EXPLANATIONS: Record<Filter, string> = {
  all: "Every recorded operation, whether it changes stored state or only reads it.",
  changes:
    "Operations that write, mutate or otherwise change stored state when they run.",
  read_only: "Operations that only read state and change nothing when they run.",
};

function matchesFilter(operation: ApiOperationRecord, filter: Filter): boolean {
  if (filter === "all") return true;
  return filter === "changes" ? operation.changesState : !operation.changesState;
}

/* ---------------------------------------------------------------------------
   Small pieces shared by every group
   --------------------------------------------------------------------------- */

/** Changes state is a fact about the operation, not a lifecycle status, so it
 * gets its own tag rather than being forced through the Status vocabulary. */
function ChangesStateTag({ changesState }: { changesState: boolean }) {
  return (
    <Tag>
      {changesState ? (
        <Pencil aria-hidden="true" className="size-3" />
      ) : (
        <Eye aria-hidden="true" className="size-3" />
      )}
      {changesState ? "Changes state" : "Read only"}
    </Tag>
  );
}

function OperationsTable({
  operations,
  totalBeforeFilter,
  filter,
  onClearFilter,
}: {
  operations: ApiOperationRecord[];
  totalBeforeFilter: number;
  filter: Filter;
  onClearFilter: () => void;
}) {
  if (totalBeforeFilter === 0) {
    return (
      <Empty
        density="inline"
        className="rounded-none border-0"
        title="No operation recorded here"
        explanation="Nothing has been recorded against this group yet."
      />
    );
  }

  if (operations.length === 0) {
    return (
      <Empty
        density="inline"
        className="rounded-none border-0"
        title={`No operation is ${FILTER_LABELS[filter].toLowerCase()}`}
        explanation={`${FILTER_EXPLANATIONS[filter]} None of the ${countPhrase(
          totalBeforeFilter,
          "operation",
        )} recorded here matches that.`}
        actions={[{ label: "Clear the filter", onClick: onClearFilter }]}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Operation</TableHead>
          <TableHead>Style</TableHead>
          <TableHead>Changes state</TableHead>
          <TableHead>Module</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {operations.map((operation) => (
          <TableRow key={operation.id}>
            <TableCell>
              <RecordName name={operation.name} id={operation.id} size="sm" />
            </TableCell>
            <TableCell>
              <Tag>{titleCase(operation.style) || "Not recorded"}</Tag>
            </TableCell>
            <TableCell>
              <ChangesStateTag changesState={operation.changesState} />
            </TableCell>
            <TableCell className="font-prose text-ink-2">
              <Value missing="No module recorded">{operation.module_name}</Value>
            </TableCell>
            <TableCell>
              <Status value={operation.status} size="sm" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ---------------------------------------------------------------------------
   One service, and its operations
   --------------------------------------------------------------------------- */

function ServiceGroup({
  service,
  operations,
  filter,
  onClearFilter,
}: {
  service: ApiServiceRecord;
  operations: ApiOperationRecord[];
  filter: Filter;
  onClearFilter: () => void;
}) {
  const shown = useMemo(
    () => operations.filter((operation) => matchesFilter(operation, filter)),
    [operations, filter],
  );

  return (
    <Panel
      title={service.name}
      description={
        service.purpose ? (
          <Markdown measure={false}>{service.purpose}</Markdown>
        ) : (
          "No purpose has been written for this service yet."
        )
      }
      actions={<Status value={service.status} />}
      bodyClassName="p-0"
    >
      <div className="border-b border-rule px-3 py-3">
        <Facts
          columns={3}
          items={[
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {service.id}
                </span>
              ),
            },
            { label: "Style", value: titleCase(service.style) || "Not recorded" },
            {
              label: "Operations",
              value: countPhrase(operations.length, "operation"),
            },
          ]}
        />
      </div>
      <OperationsTable
        operations={shown}
        totalBeforeFilter={operations.length}
        filter={filter}
        onClearFilter={onClearFilter}
      />
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

export function ApisView() {
  const { revision } = useLive();
  const apis = useResource(getApis, revision);
  const [filter, setFilter] = useState<Filter>("all");

  const payload = apis.data;
  const services = useMemo(() => payload?.services ?? [], [payload]);
  const operations = useMemo(() => payload?.operations ?? [], [payload]);

  const servicesById = useMemo(() => {
    const map = new Map<string, ApiServiceRecord>();
    for (const service of services) map.set(service.id, service);
    return map;
  }, [services]);

  const operationsByService = useMemo(() => {
    const map = new Map<string, ApiOperationRecord[]>();
    const ungrouped: ApiOperationRecord[] = [];
    for (const operation of operations) {
      const service = operation.api_service_id
        ? servicesById.get(operation.api_service_id)
        : undefined;
      if (!service) {
        ungrouped.push(operation);
        continue;
      }
      const list = map.get(service.id) ?? [];
      list.push(operation);
      map.set(service.id, list);
    }
    return { map, ungrouped };
  }, [operations, servicesById]);

  const sortedServices = useMemo(
    () => services.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const changesCount = operations.filter((op) => op.changesState).length;

  /* --- states the panel must answer with --------------------------------- */

  if (apis.pending && apis.loading) {
    return (
      <>
        <ViewHeader view="apis" />
        <ViewBody>
          <Loading
            title="Loading the APIs"
            explanation="Reading every recorded service and operation from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="apis" />
        <ViewBody>
          {apis.offline ? (
            <Offline onReconnect={apis.reload} state="offline" />
          ) : (
            <ErrorState
              title="The APIs did not load"
              error={apis.error}
              onRetry={apis.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const counts = [
    { label: "Operations", value: payload.counts.operations, unit: "recorded" },
    { label: "Services", value: payload.counts.services, unit: "recorded" },
    { label: "Changing state", value: changesCount, unit: "operations" },
    { label: "No service", value: payload.counts.ungrouped, unit: "ungrouped" },
  ];

  return (
    <>
      <ViewHeader view="apis">
        <CountStrip items={counts} className="-mx-1" />
        <div
          role="group"
          aria-label="Show which operations"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(Object.keys(FILTER_LABELS) as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              title={FILTER_EXPLANATIONS[option]}
              onClick={() => setFilter(option)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sd border px-2 py-1 font-chassis text-chassis-sm transition-colors duration-[120ms] ease-sd focus-ring",
                filter === option
                  ? "border-signal-edge bg-signal-wash text-ink"
                  : "border-rule bg-panel text-ink-2 hover:bg-inset hover:text-ink",
              )}
            >
              {FILTER_LABELS[option]}
            </button>
          ))}
        </div>
        <FreshnessLine meta={apis.meta} loading={apis.loading} onRefresh={apis.reload} />
      </ViewHeader>

      <ViewBody>
        {apis.meta?.stale ? (
          <Stale
            meta={apis.meta}
            onRefresh={apis.reload}
            showing={countPhrase(operations.length, "operation")}
          />
        ) : null}

        {apis.error && apis.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${apis.error.message} Everything below is the last reading that arrived.`}
            onRetry={apis.reload}
          />
        ) : null}

        {operations.length === 0 ? (
          <Empty
            title="No operations have been recorded yet"
            explanation="An operation is one thing the API surface can do: a REST endpoint, an RPC method, a queued job. Record one with superdev operation record, naming it and the feature it serves, and group them under a service with superdev service record."
          />
        ) : (
          <>
            {sortedServices.map((service) => (
              <ServiceGroup
                key={service.id}
                service={service}
                operations={operationsByService.map.get(service.id) ?? []}
                filter={filter}
                onClearFilter={() => setFilter("all")}
              />
            ))}

            <Panel
              title="Not owned by any service"
              description="Section 6.1 of the PRD defines a service as the boundary that owns operations. Every operation below has no service recorded against it, which means that boundary was never written down, not that the operation is unimportant."
              bodyClassName="p-0"
            >
              {operationsByService.ungrouped.length === 0 ? (
                <Empty
                  density="inline"
                  className="rounded-none border-0"
                  title="Every operation belongs to a service"
                  explanation="No operation is missing its owning service. This is the state you want, and it needs no action."
                />
              ) : (
                <OperationsTable
                  operations={operationsByService.ungrouped.filter((operation) =>
                    matchesFilter(operation, filter),
                  )}
                  totalBeforeFilter={operationsByService.ungrouped.length}
                  filter={filter}
                  onClearFilter={() => setFilter("all")}
                />
              )}
            </Panel>
          </>
        )}
      </ViewBody>
    </>
  );
}
