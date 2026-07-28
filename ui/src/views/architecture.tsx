/**
 * Architecture: what runs, what it talks to, and what depends on what.
 *
 * Read from GET /api/architecture. Two maps of the same system: the runtime
 * topology built from the runtime pieces and their recorded connections, and
 * the logical module map built from module dependencies with the critical path
 * marked.
 *
 * The honesty rule: a runtime piece is only drawn as fact when the project
 * actually records something about it. A piece with no module, no owned data
 * and no recorded connection is labelled Inferred, with the reason attached, so
 * a guess is never read as a finding.
 *
 * Module and entity names come from GET /api/product and GET /api/data, because
 * the architecture payload carries identifiers only.
 */

import { HelpCircle, Network, Plug } from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  architectureNodeTypes,
  buildModuleGraph,
  buildRuntimeGraph,
  kindStyle,
} from "@/components/diagrams/architecture-graph";
import { GraphCanvas } from "@/components/diagrams/graph-canvas";
import {
  CountStrip,
  Facts,
  FreshnessLine,
  Panel,
  RecordName,
  Tag,
  Value,
  useNarrow,
  useResource,
} from "@/components/diagrams/view-kit";
import { RecordLink, RecordLinks } from "@/components/product/panel";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
  Unavailable,
} from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getArchitecture, getData, getProduct } from "@/lib/api";
import { countPhrase, listPhrase, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type {
  Integration,
  ModuleDependency,
  RuntimeEdge,
  RuntimePiece,
} from "@/types";

export function ArchitectureView() {
  const { route, go } = useRoute();
  const { revision } = useLive();
  const architecture = useResource(getArchitecture, revision);
  const product = useResource(getProduct, revision);
  const data = useResource(getData, revision);
  const narrow = useNarrow();

  const payload = architecture.data;
  const pieces = useMemo(() => payload?.pieces ?? [], [payload]);
  const edges = useMemo(() => payload?.edges ?? [], [payload]);
  const dependencies = useMemo(() => payload?.moduleDependencies ?? [], [payload]);
  const criticalPath = useMemo(() => payload?.criticalPath ?? [], [payload]);
  const integrations = useMemo(() => payload?.integrations ?? [], [payload]);

  const modules = useMemo(() => product.data?.modules ?? [], [product.data]);
  const moduleName = useCallback(
    (id: string | null) =>
      id ? (modules.find((item) => item.id === id)?.name ?? id) : "No module recorded",
    [modules],
  );

  // An integration is only readable on the detail of the feature it belongs to,
  // so the integrations table needs feature names to point there.
  const features = useMemo(() => product.data?.features ?? [], [product.data]);
  const featureName = useCallback(
    (id: string) => features.find((item) => item.id === id)?.name ?? id,
    [features],
  );

  const entityName = useCallback(
    (id: string) =>
      data.data?.entities.find((entity) => entity.id === id)?.name ?? id,
    [data.data],
  );

  /** Which pieces the project actually records something about. */
  const connected = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of edges) {
      ids.add(edge.from_id);
      ids.add(edge.to_id);
    }
    return ids;
  }, [edges]);

  const readingFor = useCallback(
    (piece: RuntimePiece) => {
      const owns = piece.ownsEntityIds ?? [];
      const hasModule = Boolean(piece.moduleId);
      const hasEdge = connected.has(piece.id);
      const inferred = !hasModule && owns.length === 0 && !hasEdge;

      const recorded: string[] = [];
      if (hasModule) recorded.push(`it belongs to ${moduleName(piece.moduleId)}`);
      if (owns.length > 0) recorded.push(`it owns ${countPhrase(owns.length, "entity", "entities")}`);
      if (hasEdge) recorded.push("it has at least one recorded connection");

      return {
        inferred,
        evidence: inferred
          ? "Nothing in the project records this piece beyond its name: no module, no owned data and no connection. It is shown as inferred and should be confirmed before it is relied on."
          : `Recorded because ${listPhrase(recorded)}.`,
        ownership:
          owns.length === 0
            ? "Owns no recorded data"
            : `Owns ${countPhrase(owns.length, "entity", "entities")}`,
      };
    },
    [connected, moduleName],
  );

  const runtimeGraph = useMemo(
    () => buildRuntimeGraph({ pieces, edges, readingFor }),
    [pieces, edges, readingFor],
  );

  const moduleGraph = useMemo(
    () =>
      buildModuleGraph({
        modules: modules.map((module) => ({
          id: module.id,
          name: module.name,
          status: module.status,
        })),
        dependencies,
        criticalPath,
      }),
    [modules, dependencies, criticalPath],
  );

  const selectedPiece = useMemo(
    () => pieces.find((piece) => piece.id === route.record) ?? null,
    [pieces, route.record],
  );

  // The deep link carries one record, and a record here is either a runtime
  // piece or a module. Choosing either has to open something.
  const selectedModule = useMemo(
    () => modules.find((module) => module.id === route.record) ?? null,
    [modules, route.record],
  );

  const inferredCount = pieces.filter((piece) => readingFor(piece).inferred).length;

  /* --- states the panel must answer with --------------------------------- */

  if (architecture.pending && architecture.loading) {
    return (
      <>
        <ViewHeader view="architecture" />
        <ViewBody>
          <Loading
            title="Loading the architecture"
            explanation="Reading the runtime pieces, their connections, the module dependencies and the integrations from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="architecture" />
        <ViewBody>
          {architecture.offline ? (
            <Offline onReconnect={architecture.reload} state="offline" />
          ) : (
            <ErrorState
              title="The architecture did not load"
              error={architecture.error}
              onRetry={architecture.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const nothingRecorded =
    pieces.length === 0 && dependencies.length === 0 && integrations.length === 0;

  return (
    <>
      <ViewHeader view="architecture">
        <CountStrip
          className="-mx-1"
          items={[
            { label: "Runtime pieces", value: pieces.length, unit: "recorded" },
            { label: "Connections", value: edges.length, unit: "recorded" },
            {
              label: "Module dependencies",
              value: dependencies.length,
              unit: "recorded",
            },
            { label: "Integrations", value: integrations.length, unit: "recorded" },
          ]}
        />
        <FreshnessLine
          meta={architecture.meta}
          loading={architecture.loading}
          onRefresh={architecture.reload}
        />
      </ViewHeader>

      <ViewBody>
        {architecture.meta?.stale ? (
          <Stale
            meta={architecture.meta}
            onRefresh={architecture.reload}
            showing={countPhrase(pieces.length, "runtime piece")}
          />
        ) : null}

        {architecture.error && architecture.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${architecture.error.message} Everything below is the last reading that arrived.`}
            onRetry={architecture.reload}
          />
        ) : null}

        {nothingRecorded ? (
          <Empty
            title="No architecture has been recorded yet"
            explanation="Runtime pieces, module dependencies and integrations are recorded as the product is specified and built. Nothing here is broken: the project has simply not described how it runs yet."
            actions={[
              { label: "Open Product", href: hrefFor("product") },
              { label: "Open Decisions", href: hrefFor("decisions") },
            ]}
          />
        ) : (
          <>
            <SystemContext pieces={pieces} inferredCount={inferredCount} />

            <Tabs defaultValue="runtime">
              <TabsList>
                <TabsTrigger value="runtime">
                  <Network aria-hidden="true" />
                  Runtime topology
                </TabsTrigger>
                <TabsTrigger value="modules">Module map</TabsTrigger>
                <TabsTrigger value="integrations">
                  <Plug aria-hidden="true" />
                  Integrations and ownership
                </TabsTrigger>
              </TabsList>

              <TabsContent value="runtime" className="flex flex-col gap-4">
                {pieces.length === 0 ? (
                  <Unavailable
                    title="No runtime piece has been recorded"
                    explanation="There is nothing to draw because the project has not recorded what actually runs: no service, store, client or external system. The module map may still be useful."
                  />
                ) : (
                  <>
                    {narrow ? null : (
                      <GraphCanvas
                        nodes={runtimeGraph.nodes}
                        edges={runtimeGraph.edges}
                        nodeTypes={architectureNodeTypes}
                        saved={payload.layout}
                        direction="LR"
                        rankSeparation={200}
                        selectedId={selectedPiece?.id ?? null}
                        onSelect={(id) => go("architecture", id)}
                        label={`Runtime topology of ${countPhrase(pieces.length, "piece")} and ${countPhrase(edges.length, "connection")}. Every piece is also listed in the table below the diagram.`}
                        emptyTitle="There is nothing to draw"
                        emptyExplanation="No runtime piece has been recorded, so the topology would be empty."
                      />
                    )}
                    {narrow ? (
                      <p className="font-prose text-small text-ink-2 prose-measure">
                        The topology diagram is not shown at this width because it
                        would not be readable. The table below carries every piece
                        and every connection.
                      </p>
                    ) : (
                      <p className="font-prose text-small text-ink-3 prose-measure">
                        Shape carries the kind of piece: a rounded stack is a
                        store, a pill is an external system, a square is a
                        worker. A broken outline means the piece is inferred
                        rather than recorded. Drag a node to rearrange the
                        picture while this page is open.
                      </p>
                    )}
                    <PiecesTable
                      pieces={pieces}
                      edges={edges}
                      readingFor={readingFor}
                      moduleName={moduleName}
                      entityName={entityName}
                      selectedId={selectedPiece?.id ?? null}
                      onSelect={(id) => go("architecture", id)}
                    />
                    <ConnectionsTable pieces={pieces} edges={edges} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="modules" className="flex flex-col gap-4">
                <CriticalPath
                  criticalPath={criticalPath}
                  moduleName={moduleName}
                  modulesLoaded={modules.length > 0}
                />
                {modules.length === 0 ? (
                  <Unavailable
                    title="Module names could not be read"
                    explanation="The module map needs the module records from the product view, and those did not load. The dependency table below still shows the identifiers and the reasons."
                    actions={[{ label: "Retry", onClick: product.reload }]}
                  />
                ) : narrow ? (
                  <p className="font-prose text-small text-ink-2 prose-measure">
                    The module map is not shown at this width because it would
                    not be readable. The dependency table below carries the same
                    relationships.
                  </p>
                ) : (
                  <GraphCanvas
                    nodes={moduleGraph.nodes}
                    edges={moduleGraph.edges}
                    nodeTypes={architectureNodeTypes}
                    direction="LR"
                    rankSeparation={200}
                    selectedId={route.record}
                    onSelect={(id) => go("architecture", id)}
                    label={`Module map of ${countPhrase(modules.length, "module")} and ${countPhrase(dependencies.length, "dependency", "dependencies")}. The same relationships are listed in the table below.`}
                    emptyTitle="There is nothing to draw"
                    emptyExplanation="No module has been recorded, so the map would be empty."
                  />
                )}
                <DependencyTable
                  dependencies={dependencies}
                  moduleName={moduleName}
                />
              </TabsContent>

              <TabsContent value="integrations" className="flex flex-col gap-4">
                <IntegrationsTable
                  integrations={integrations}
                  moduleName={moduleName}
                  featureName={featureName}
                />
                <OwnershipTable
                  pieces={pieces}
                  entityName={entityName}
                  entitiesLoaded={Boolean(data.data)}
                  onRetryEntities={data.reload}
                />
              </TabsContent>
            </Tabs>

            {selectedPiece ? (
              <PieceDetail
                piece={selectedPiece}
                reading={readingFor(selectedPiece)}
                moduleName={moduleName(selectedPiece.moduleId)}
                entityName={entityName}
                edges={edges.filter(
                  (edge) =>
                    edge.from_id === selectedPiece.id ||
                    edge.to_id === selectedPiece.id,
                )}
                pieces={pieces}
                onClose={() => go("architecture")}
              />
            ) : null}

            {!selectedPiece && selectedModule ? (
              <ModuleDetail
                module={selectedModule}
                dependencies={dependencies}
                moduleName={moduleName}
                criticalPath={criticalPath}
                onClose={() => go("architecture")}
              />
            ) : null}
          </>
        )}
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   System context
   --------------------------------------------------------------------------- */

function SystemContext({
  pieces,
  inferredCount,
}: {
  pieces: RuntimePiece[];
  inferredCount: number;
}) {
  const byKind = new Map<string, RuntimePiece[]>();
  for (const piece of pieces) {
    const label = kindStyle(piece.kind).label;
    byKind.set(label, [...(byKind.get(label) ?? []), piece]);
  }

  const external = pieces.filter(
    (piece) => kindStyle(piece.kind).label === "External System",
  );

  return (
    <Panel
      title="System context"
      description="What this project is made of, and where it ends. Everything outside the external systems below is somebody else's responsibility."
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-2">
          {Array.from(byKind.entries()).map(([label, items]) => (
            <li key={label}>
              <Tag>
                {countPhrase(items.length, label.toLowerCase())}
              </Tag>
            </li>
          ))}
          {byKind.size === 0 ? (
            <li className="font-prose text-small text-ink-2">
              No runtime piece has been recorded yet.
            </li>
          ) : null}
        </ul>

        <p className="font-prose text-body text-ink-2 prose-measure">
          {external.length === 0
            ? "No external system is recorded, so on this reading the project depends on nothing outside itself. If that is wrong, the missing dependency is a gap in the architecture record, not in this page."
            : `This project depends on ${listPhrase(external.map((piece) => piece.name))} outside its own boundary.`}
        </p>

        <div
          className={cn(
            "flex items-start gap-2 rounded-sd border p-3",
            inferredCount > 0
              ? "border-state-attention/45 bg-state-attention-wash"
              : "border-rule bg-inset",
          )}
        >
          <HelpCircle
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-4 shrink-0",
              inferredCount > 0 ? "text-state-attention" : "text-ink-3",
            )}
          />
          <p className="font-prose text-small text-ink-2 prose-measure">
            {inferredCount === 0 ? (
              <>
                Every runtime piece here is recorded: each one belongs to a
                module, owns data, or has a recorded connection. Nothing on this
                page is a guess.
              </>
            ) : (
              <>
                {countPhrase(inferredCount, "runtime piece")} out of{" "}
                {pieces.length}{" "}
                {inferredCount === 1 ? "is" : "are"} labelled Inferred: the
                project records nothing about{" "}
                {inferredCount === 1 ? "it" : "them"} beyond a name, so{" "}
                {inferredCount === 1 ? "it is" : "they are"} drawn with a broken
                outline rather than presented as fact. Confirm{" "}
                {inferredCount === 1 ? "it" : "them"} by recording the module{" "}
                {inferredCount === 1 ? "it belongs" : "they belong"} to, the data{" "}
                {inferredCount === 1 ? "it owns" : "they own"}, or what{" "}
                {inferredCount === 1 ? "it talks" : "they talk"} to.
              </>
            )}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Critical path
   --------------------------------------------------------------------------- */

function CriticalPath({
  criticalPath,
  moduleName,
  modulesLoaded,
}: {
  criticalPath: string[];
  moduleName: (id: string | null) => string;
  modulesLoaded: boolean;
}) {
  return (
    <Panel
      title="Critical path"
      description="The modules that have to land in order. Anything slipping here moves the whole delivery."
    >
      {criticalPath.length === 0 ? (
        <p className="font-prose text-body text-ink-2 prose-measure">
          No critical path has been recorded. Either the modules are genuinely
          independent, or the ordering has not been decided yet. Until it is,
          nothing here says which module has to land first.
        </p>
      ) : (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {criticalPath.map((id, index) => (
            <li key={id} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-sd border border-rule bg-inset px-2 py-1">
                <span className="font-chassis text-label text-ink-3 uppercase">
                  Step {index + 1}
                </span>
                {modulesLoaded ? (
                  <RecordLink
                    name={moduleName(id)}
                    id={id}
                    href={hrefFor("architecture", id)}
                  />
                ) : (
                  // Without the module list the link would land on nothing.
                  <span className="font-prose text-small text-ink">{id}</span>
                )}
              </span>
              {index < criticalPath.length - 1 ? (
                <span aria-hidden="true" className="font-chassis text-ink-3">
                  then
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Runtime pieces
   --------------------------------------------------------------------------- */

function PiecesTable({
  pieces,
  edges,
  readingFor,
  moduleName,
  entityName,
  selectedId,
  onSelect,
}: {
  pieces: RuntimePiece[];
  edges: RuntimeEdge[];
  readingFor: (piece: RuntimePiece) => { inferred: boolean; evidence: string };
  moduleName: (id: string | null) => string;
  entityName: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const talksTo = (id: string) =>
    edges.filter((edge) => edge.from_id === id || edge.to_id === id).length;

  return (
    <Panel
      title="Runtime pieces"
      description="The same pieces the topology draws. Choose a row to read what it is and what it talks to."
      bodyClassName="p-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Piece</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Owns</TableHead>
            <TableHead className="text-right">Connections</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pieces.map((piece) => {
            const reading = readingFor(piece);
            const owns = piece.ownsEntityIds ?? [];
            return (
              <TableRow
                key={piece.id}
                role="button"
                tabIndex={0}
                aria-pressed={piece.id === selectedId}
                aria-label={`Runtime piece ${piece.name}. Open its detail.`}
                onClick={() => onSelect(piece.id)}
                onKeyDown={(event) => {
                  // The row now carries links of its own, so only act when the
                  // row itself has focus, never a link inside it.
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(piece.id);
                  }
                }}
                className={cn(
                  "cursor-pointer focus-ring row-edge-focus",
                  piece.id === selectedId &&
                    "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
                )}
              >
                <TableCell>
                  <RecordName name={piece.name} id={piece.id} size="sm" />
                </TableCell>
                <TableCell>{kindStyle(piece.kind).label}</TableCell>
                <TableCell
                  className="font-prose text-ink-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  {piece.moduleId ? (
                    <RecordLink
                      name={moduleName(piece.moduleId)}
                      id={piece.moduleId}
                      href={hrefFor("architecture", piece.moduleId)}
                    />
                  ) : (
                    <Value missing="No module recorded">{null}</Value>
                  )}
                </TableCell>
                <TableCell
                  className="font-prose text-ink-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <RecordLinks
                    items={owns.map((id) => ({
                      id,
                      name: entityName(id),
                      href: hrefFor("data", id),
                    }))}
                    empty="No data"
                  />
                </TableCell>
                <TableCell className="text-right">{talksTo(piece.id)}</TableCell>
                <TableCell>
                  {reading.inferred ? (
                    <span
                      title={reading.evidence}
                      className="inline-flex items-center gap-1 text-state-attention"
                    >
                      <HelpCircle aria-hidden="true" className="size-3" />
                      Inferred
                    </span>
                  ) : (
                    <span title={reading.evidence} className="text-ink-2">
                      Recorded
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Status value={piece.status} size="sm" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

function ConnectionsTable({
  pieces,
  edges,
}: {
  pieces: RuntimePiece[];
  edges: RuntimeEdge[];
}) {
  const nameOf = (id: string) =>
    pieces.find((piece) => piece.id === id)?.name ?? id;

  return (
    <Panel
      title="What talks to what"
      description="Every recorded connection between two runtime pieces, and how it is carried."
      bodyClassName="p-0"
    >
      {edges.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No connections recorded"
          explanation="Nothing records one piece calling another. Either the pieces genuinely stand alone, or the connections between them have not been written down yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Carried over</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {edges.map((edge) => (
              <TableRow key={edge.id}>
                <TableCell className="font-prose text-ink">
                  <RecordLink
                    name={nameOf(edge.from_id)}
                    id={edge.from_id}
                    href={hrefFor("architecture", edge.from_id)}
                  />
                </TableCell>
                <TableCell>{titleCase(edge.relationship)}</TableCell>
                <TableCell className="font-prose text-ink">
                  <RecordLink
                    name={nameOf(edge.to_id)}
                    id={edge.to_id}
                    href={hrefFor("architecture", edge.to_id)}
                  />
                </TableCell>
                <TableCell>
                  <Value missing="Not recorded">{edge.protocol}</Value>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

function PieceDetail({
  piece,
  reading,
  moduleName,
  entityName,
  edges,
  pieces,
  onClose,
}: {
  piece: RuntimePiece;
  reading: { inferred: boolean; evidence: string; ownership: string };
  moduleName: string;
  entityName: (id: string) => string;
  edges: RuntimeEdge[];
  pieces: RuntimePiece[];
  onClose: () => void;
}) {
  const style = kindStyle(piece.kind);
  const nameOf = (id: string) =>
    pieces.find((item) => item.id === id)?.name ?? id;

  return (
    <Panel
      title={piece.name}
      description={
        piece.purpose ??
        "No purpose has been written for this piece yet, so what it is for has to be inferred from what it talks to."
      }
      actions={
        <>
          <Status value={piece.status} />
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          columns={3}
          items={[
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {piece.id}
                </span>
              ),
            },
            { label: "Kind", value: `${style.label}. ${style.meaning}.` },
            {
              label: "Module",
              value: piece.moduleId ? (
                <RecordLink
                  name={moduleName}
                  id={piece.moduleId}
                  href={hrefFor("architecture", piece.moduleId)}
                />
              ) : (
                <Value missing="No module recorded">{null}</Value>
              ),
            },
            { label: "Data it owns", value: reading.ownership },
            {
              label: "How well it is recorded",
              value: reading.inferred ? "Inferred" : "Recorded",
            },
          ]}
        />

        <p
          className={cn(
            "rounded-sd border p-3 font-prose text-small prose-measure",
            reading.inferred
              ? "border-state-attention/45 bg-state-attention-wash text-state-attention"
              : "border-rule bg-inset text-ink-2",
          )}
        >
          {reading.evidence}
        </p>

        <div className="flex flex-col gap-2">
          <h4 className="font-chassis text-label text-ink-3 uppercase">
            Owned data
          </h4>
          <RecordLinks
            items={(piece.ownsEntityIds ?? []).map((id) => ({
              id,
              name: entityName(id),
              href: hrefFor("data", id),
            }))}
            empty="This piece is not recorded as owning any data."
          />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-chassis text-label text-ink-3 uppercase">
            Connections
          </h4>
          {edges.length === 0 ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              Nothing records this piece talking to anything else.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {edges.map((edge) => {
                // The piece on the other end of the connection, so the sentence
                // opens the piece it names.
                const other =
                  edge.from_id === piece.id ? edge.to_id : edge.from_id;
                const link = (
                  <RecordLink
                    name={nameOf(other)}
                    id={other}
                    href={hrefFor("architecture", other)}
                  />
                );
                return (
                  <li key={edge.id} className="font-prose text-small text-ink-2">
                    {edge.from_id === piece.id ? (
                      <>
                        {titleCase(edge.relationship)} {link}
                      </>
                    ) : (
                      <>
                        {link} {titleCase(edge.relationship).toLowerCase()} this
                        piece
                      </>
                    )}
                    {edge.protocol ? `, over ${edge.protocol}` : ""}.
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Module dependencies
   --------------------------------------------------------------------------- */

function ModuleDetail({
  module,
  dependencies,
  moduleName,
  criticalPath,
  onClose,
}: {
  module: { id: string; name: string; status: string; purpose: string | null };
  dependencies: ModuleDependency[];
  moduleName: (id: string | null) => string;
  criticalPath: string[];
  onClose: () => void;
}) {
  const needs = dependencies.filter(
    (dependency) => dependency.from_module_id === module.id,
  );
  const neededBy = dependencies.filter(
    (dependency) => dependency.to_module_id === module.id,
  );
  const step = criticalPath.indexOf(module.id);

  return (
    <Panel
      title={module.name}
      description={
        module.purpose ??
        "No purpose has been written for this module yet, so what it is for has to be inferred from what depends on it."
      }
      actions={
        <>
          <Status value={module.status} />
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          columns={3}
          items={[
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {module.id}
                </span>
              ),
            },
            {
              label: "Critical path",
              value:
                step === -1
                  ? "Not on the critical path"
                  : `Step ${step + 1} of ${criticalPath.length}`,
            },
            {
              label: "Full record",
              value: (
                <a
                  href={hrefFor("product", module.id)}
                  className="font-chassis text-chassis text-signal underline-offset-2 hover:underline focus-ring"
                >
                  Open this module in Product
                </a>
              ),
            },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h4 className="font-chassis text-label text-ink-3 uppercase">
              It needs ({needs.length})
            </h4>
            <DependencyLinks
              items={needs.map((dependency) => ({
                id: dependency.to_module_id,
                reason: dependency.reason,
              }))}
              moduleName={moduleName}
              missing="This module is not recorded as needing any other module."
            />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-chassis text-label text-ink-3 uppercase">
              Needed by ({neededBy.length})
            </h4>
            <DependencyLinks
              items={neededBy.map((dependency) => ({
                id: dependency.from_module_id,
                reason: dependency.reason,
              }))}
              moduleName={moduleName}
              missing="No other module is recorded as needing this one."
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Module cross-references with the recorded reason beside each one. */
function DependencyLinks({
  items,
  moduleName,
  missing,
}: {
  items: { id: string; reason: string | null }[];
  moduleName: (id: string | null) => string;
  missing: string;
}) {
  if (items.length === 0) {
    return (
      <span className="font-chassis text-chassis-sm text-ink-3">{missing}</span>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.id} className="font-prose text-small text-ink-2">
          <RecordLink
            name={moduleName(item.id)}
            id={item.id}
            href={hrefFor("architecture", item.id)}
          />
          {`: ${item.reason ?? "no reason recorded"}`}
        </li>
      ))}
    </ul>
  );
}

function DependencyTable({
  dependencies,
  moduleName,
}: {
  dependencies: ModuleDependency[];
  moduleName: (id: string | null) => string;
}) {
  return (
    <Panel
      title="Module dependencies"
      description="What each module needs before it can work, and which of those sit on the critical path."
      bodyClassName="p-0"
    >
      {dependencies.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No module dependencies recorded"
          explanation="No module is recorded as needing another. Either the modules are genuinely independent, or the dependencies have not been written down yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Depends on</TableHead>
              <TableHead>Why</TableHead>
              <TableHead>Critical path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dependencies.map((dependency) => (
              <TableRow
                key={`${dependency.from_module_id}-${dependency.to_module_id}`}
              >
                <TableCell className="font-prose text-ink">
                  <RecordLink
                    name={moduleName(dependency.from_module_id)}
                    id={dependency.from_module_id}
                    href={hrefFor("architecture", dependency.from_module_id)}
                  />
                </TableCell>
                <TableCell className="font-prose text-ink">
                  <RecordLink
                    name={moduleName(dependency.to_module_id)}
                    id={dependency.to_module_id}
                    href={hrefFor("architecture", dependency.to_module_id)}
                  />
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="No reason recorded">{dependency.reason}</Value>
                </TableCell>
                <TableCell>
                  {dependency.critical ? "On the critical path" : "Not on it"}
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
   Integrations and ownership
   --------------------------------------------------------------------------- */

function IntegrationsTable({
  integrations,
  moduleName,
  featureName,
}: {
  integrations: Integration[];
  moduleName: (id: string | null) => string;
  featureName: (id: string) => string;
}) {
  return (
    <Panel
      title="Integrations"
      description="Everything this project talks to that it does not own, and what happens when one of them fails."
      bodyClassName="p-0"
    >
      {integrations.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No integrations recorded"
          explanation="Nothing outside this project is recorded as part of how it runs. If the product does call an outside service, that integration has not been written down yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Integration</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>What it is for</TableHead>
              <TableHead>Environments</TableHead>
              <TableHead>How it authenticates</TableHead>
              <TableHead>When it fails</TableHead>
              <TableHead>Configured</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrations.map((integration) => (
              <TableRow key={integration.id}>
                <TableCell>
                  <span className="flex flex-col gap-0.5">
                    <RecordName
                      name={integration.name}
                      id={integration.id}
                      size="sm"
                    />
                    {/* The integration record itself is only readable on the
                        detail of the feature it belongs to. */}
                    {integration.feature_id ? (
                      <RecordLink
                        name={featureName(integration.feature_id)}
                        id={integration.feature_id}
                        href={hrefFor("features", integration.feature_id)}
                      />
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <Value missing="Not recorded">{integration.provider}</Value>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  {integration.module_id ? (
                    <RecordLink
                      name={moduleName(integration.module_id)}
                      id={integration.module_id}
                      href={hrefFor("architecture", integration.module_id)}
                    />
                  ) : (
                    <Value missing="No module recorded">{null}</Value>
                  )}
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="Not recorded">{integration.purpose}</Value>
                </TableCell>
                <TableCell>
                  <Value missing="Not recorded">
                    {(integration.environments_json ?? []).join(", ") || null}
                  </Value>
                </TableCell>
                <TableCell>
                  <Value missing="Not recorded">{integration.auth_approach}</Value>
                </TableCell>
                <TableCell className="font-prose text-ink-2">
                  <Value missing="Not recorded">
                    {integration.failure_behavior}
                  </Value>
                </TableCell>
                <TableCell>
                  {integration.configuration_status ? (
                    <Status value={integration.configuration_status} size="sm" />
                  ) : (
                    <Value missing="Not recorded">{null}</Value>
                  )}
                </TableCell>
                <TableCell>
                  {integration.verification_status ? (
                    <Status value={integration.verification_status} size="sm" />
                  ) : (
                    <Value missing="Not verified">{null}</Value>
                  )}
                </TableCell>
                <TableCell>
                  <Status value={integration.status} size="sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

function OwnershipTable({
  pieces,
  entityName,
  entitiesLoaded,
  onRetryEntities,
}: {
  pieces: RuntimePiece[];
  entityName: (id: string) => string;
  entitiesLoaded: boolean;
  onRetryEntities: () => void;
}) {
  const owners = pieces.filter((piece) => (piece.ownsEntityIds ?? []).length > 0);

  return (
    <Panel
      title="Data ownership"
      description="Which runtime piece is responsible for which data. One owner per entity is what keeps two services from disagreeing about the truth."
      bodyClassName="p-0"
      actions={
        entitiesLoaded ? null : (
          <Button type="button" variant="outline" size="sm" onClick={onRetryEntities}>
            Load entity names
          </Button>
        )
      }
    >
      {owners.length === 0 ? (
        <Empty
          density="inline"
          className="rounded-none border-0"
          title="No ownership recorded"
          explanation="No runtime piece is recorded as owning any entity, so nothing here says which part of the system is responsible for which data. That is a gap worth closing before two pieces start writing the same records."
          actions={[{ label: "Open Data", href: hrefFor("data") }]}
        />
      ) : (
        <>
          {entitiesLoaded ? null : (
            <p className="border-b border-rule px-3 py-2 font-prose text-small text-state-attention">
              Entity names could not be read, so the data below is shown by
              identifier.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Data it owns</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((piece) => (
                <TableRow key={piece.id}>
                  <TableCell>
                    <a
                      href={hrefFor("architecture", piece.id)}
                      className="min-w-0 focus-ring"
                    >
                      <RecordName name={piece.name} id={piece.id} size="sm" />
                    </a>
                  </TableCell>
                  <TableCell>{kindStyle(piece.kind).label}</TableCell>
                  <TableCell className="font-prose text-ink-2">
                    <RecordLinks
                      items={(piece.ownsEntityIds ?? []).map((id) => ({
                        id,
                        name: entityName(id),
                        href: hrefFor("data", id),
                      }))}
                      empty="No data"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Panel>
  );
}
