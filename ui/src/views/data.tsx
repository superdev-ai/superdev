/**
 * Data: the entities the product stores, what is in them and how they relate.
 *
 * Read from GET /api/data. Two readings of the same records: an interactive
 * entity relationship diagram, and a plain table. The table is not a fallback,
 * it is the readable form on a phone and the keyboard route on every screen, so
 * the diagram is never the only way to reach a record.
 *
 * Module and feature names come from GET /api/product, because the data payload
 * carries their identifiers only and an identifier is not a name.
 */

import { Database, Filter, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildEntityGraph,
  cardinalityPhrase,
  deletePhrase,
  entityNodeTypes,
  isSensitive,
} from "@/components/diagrams/entity-diagram";
import { GraphCanvas } from "@/components/diagrams/graph-canvas";
import {
  CountStrip,
  Facts,
  FreshnessLine,
  Panel,
  RecordName,
  Tag,
  Value,
  byId,
  isTrue,
  useNarrow,
  useResource,
} from "@/components/diagrams/view-kit";
import { DataGrid, RecordLink, type Column } from "@/components/product/panel";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getData, getProduct } from "@/lib/api";
import { absoluteTime, countPhrase, relativeTime, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";
import { hrefFor, useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type {
  DataEntity,
  DataField,
  DataRelationship,
  SchemaMigration,
} from "@/types";

const ANY = "all";

export function DataView() {
  const { route, go } = useRoute();
  const { revision } = useLive();
  const data = useResource(getData, revision);
  const product = useResource(getProduct, revision);
  const narrow = useNarrow();

  const [moduleFilter, setModuleFilter] = useState(ANY);
  const [featureFilter, setFeatureFilter] = useState(ANY);
  const [tab, setTab] = useState<string>("table");

  // A diagram is not readable on a phone, so a narrow screen opens on the
  // table and a wide one opens on the diagram. Either is one choice away.
  useEffect(() => setTab(narrow ? "table" : "diagram"), [narrow]);

  const payload = data.data;
  const entities = useMemo(() => payload?.entities ?? [], [payload]);
  const fields = useMemo(() => payload?.fields ?? [], [payload]);
  const relationships = useMemo(() => payload?.relationships ?? [], [payload]);
  const migrations = useMemo(() => payload?.migrations ?? [], [payload]);

  const moduleNames = useMemo(
    () => new Map((product.data?.modules ?? []).map((item) => [item.id, item.name])),
    [product.data],
  );
  const featureNames = useMemo(
    () => new Map((product.data?.features ?? []).map((item) => [item.id, item.name])),
    [product.data],
  );

  const nameOfModule = useCallback(
    (id: string | null) => (id ? (moduleNames.get(id) ?? id) : "No module recorded"),
    [moduleNames],
  );
  const nameOfFeature = useCallback(
    (id: string | null) => (id ? (featureNames.get(id) ?? id) : "No feature recorded"),
    [featureNames],
  );

  const moduleOptions = useMemo(() => {
    const ids = Array.from(
      new Set(entities.map((entity) => entity.module_id).filter(Boolean)),
    ) as string[];
    return ids
      .map((id) => ({ id, name: nameOfModule(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities, nameOfModule]);

  const featureOptions = useMemo(() => {
    const ids = Array.from(
      new Set(entities.map((entity) => entity.feature_id).filter(Boolean)),
    ) as string[];
    return ids
      .map((id) => ({ id, name: nameOfFeature(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities, nameOfFeature]);

  const shown = useMemo(
    () =>
      entities.filter(
        (entity) =>
          (moduleFilter === ANY || entity.module_id === moduleFilter) &&
          (featureFilter === ANY || entity.feature_id === featureFilter),
      ),
    [entities, moduleFilter, featureFilter],
  );

  /**
   * Migrations name the feature they belong to, not the entity. An entity is
   * therefore affected by the migrations recorded against its own feature, and
   * the interface says so rather than implying a direct link that is not stored.
   */
  const migrationsForEntity = useCallback(
    (entityId: string) => {
      const entity = entities.find((item) => item.id === entityId);
      if (!entity?.feature_id) return [];
      return migrations.filter(
        (migration) => migration.feature_id === entity.feature_id,
      );
    },
    [entities, migrations],
  );

  const migrationCountFor = useCallback(
    (entityId: string) => migrationsForEntity(entityId).length,
    [migrationsForEntity],
  );

  const graph = useMemo(
    () =>
      buildEntityGraph({
        entities: shown,
        fields,
        relationships,
        migrationCountFor,
      }),
    [shown, fields, relationships, migrationCountFor],
  );

  const selected = useMemo(
    () => entities.find((entity) => entity.id === route.record) ?? null,
    [entities, route.record],
  );

  const filtered = moduleFilter !== ANY || featureFilter !== ANY;
  const clearFilters = () => {
    setModuleFilter(ANY);
    setFeatureFilter(ANY);
  };

  /* --- states the panel must answer with --------------------------------- */

  if (data.pending && data.loading) {
    return (
      <>
        <ViewHeader view="data" />
        <ViewBody>
          <Loading
            title="Loading the data model"
            explanation="Reading every entity, field, relationship and migration from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="data" />
        <ViewBody>
          {data.offline ? (
            <Offline onReconnect={data.reload} state="offline" />
          ) : (
            <ErrorState
              title="The data model did not load"
              error={data.error}
              onRetry={data.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const sensitiveCount = entities.filter((entity) =>
    isSensitive(entity.sensitivity_class),
  ).length;

  return (
    <>
      <ViewHeader view="data">
        <CountStrip
          className="-mx-1"
          items={[
            { label: "Entities", value: entities.length, unit: "recorded" },
            { label: "Fields", value: fields.length, unit: "across them" },
            {
              label: "Relationships",
              value: relationships.length,
              unit: "recorded",
            },
            { label: "Migrations", value: migrations.length, unit: "recorded" },
          ]}
        />
        <FreshnessLine
          meta={data.meta}
          loading={data.loading}
          onRefresh={data.reload}
        />
      </ViewHeader>

      <ViewBody>
        {data.meta?.stale ? (
          <Stale
            meta={data.meta}
            onRefresh={data.reload}
            showing={countPhrase(entities.length, "entity", "entities")}
          />
        ) : null}

        {data.error && data.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${data.error.message} Everything below is the last reading that arrived.`}
            onRetry={data.reload}
          />
        ) : null}

        {product.error && !product.data ? (
          <ErrorState
            density="inline"
            title="Module and feature names could not be read"
            explanation="The data model below is complete, but modules and features are shown by identifier because the product record did not load. Choose Retry to try again."
            onRetry={product.reload}
          />
        ) : null}

        {entities.length === 0 ? (
          <Empty
            title="No entities have been recorded yet"
            explanation="An entity is something the product stores: an account, an order, a document. Record one with superdev entity record, naming it and the feature it belongs to, then give it fields with superdev field add. An entity with no fields does not describe data."
            actions={[
              { label: "Open Features", href: hrefFor("features") },
              { label: "Open Product", href: hrefFor("product") },
            ]}
          />
        ) : (
          <>
            <Panel
              title="Filter the model"
              description={
                filtered
                  ? `Showing ${countPhrase(shown.length, "entity", "entities")} of ${entities.length}.`
                  : `Showing all ${countPhrase(entities.length, "entity", "entities")}.`
              }
              actions={
                filtered ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                  >
                    Clear the filters
                  </Button>
                ) : null
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <Filter aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                <FilterSelect
                  id="data-module-filter"
                  label="Module"
                  value={moduleFilter}
                  onChange={setModuleFilter}
                  anyLabel="Every module"
                  options={moduleOptions}
                />
                <FilterSelect
                  id="data-feature-filter"
                  label="Feature"
                  value={featureFilter}
                  onChange={setFeatureFilter}
                  anyLabel="Every feature"
                  options={featureOptions}
                />
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {sensitiveCount === 0
                    ? "No entity is classed as sensitive"
                    : `${countPhrase(sensitiveCount, "entity", "entities")} classed as sensitive`}
                </span>
              </div>
            </Panel>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="diagram">
                  <Database aria-hidden="true" />
                  Diagram
                </TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>

              <TabsContent value="diagram">
                {shown.length === 0 ? (
                  <FilteredOut onClear={clearFilters} />
                ) : (
                  <div className="flex flex-col gap-2">
                    <GraphCanvas
                      nodes={graph.nodes}
                      edges={graph.edges}
                      nodeTypes={entityNodeTypes}
                      saved={payload.layout}
                      direction="LR"
                      rankSeparation={210}
                      selectedId={selected?.id ?? null}
                      onSelect={(id) => go("data", id)}
                      label={`Entity relationship diagram of ${countPhrase(shown.length, "entity", "entities")} and ${countPhrase(graph.edges.length, "relationship")}. The same records are listed in the table tab.`}
                      emptyTitle="There is nothing to draw"
                      emptyExplanation="No entity matches the current filters, so the diagram would be empty."
                    />
                    <p className="font-prose text-small text-ink-3 prose-measure">
                      Drag a node to rearrange the picture while this page is
                      open. Choose a node to open its specification below. The
                      table tab lists every entity in a form that reads on a
                      phone and works from the keyboard.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="table">
                {shown.length === 0 ? (
                  <FilteredOut onClear={clearFilters} />
                ) : (
                  <EntityTable
                    entities={shown}
                    fields={fields}
                    relationships={relationships}
                    selectedId={selected?.id ?? null}
                    onSelect={(id) => go("data", id)}
                    nameOfModule={nameOfModule}
                    nameOfFeature={nameOfFeature}
                    migrationCountFor={migrationCountFor}
                    narrow={narrow}
                  />
                )}
              </TabsContent>
            </Tabs>

            {selected ? (
              <EntitySpecification
                entity={selected}
                fields={fields.filter((field) => field.entity_id === selected.id)}
                relationships={relationships.filter(
                  (relationship) =>
                    relationship.from_entity_id === selected.id ||
                    relationship.to_entity_id === selected.id,
                )}
                entityNames={byId(entities)}
                migrations={migrationsForEntity(selected.id)}
                moduleName={nameOfModule(selected.module_id)}
                featureName={nameOfFeature(selected.feature_id)}
                onClose={() => go("data")}
              />
            ) : (
              <Panel
                title="Entity specification"
                description="Choose an entity, in the diagram or the table, to read its full specification here."
              >
                <p className="font-prose text-body text-ink-2 prose-measure">
                  Nothing is selected yet. An entity specification names what the
                  entity is for, where it is stored, how sensitive it is, how long
                  it is kept, what happens when it is deleted, every field it
                  carries, and every migration recorded against its feature.
                </p>
              </Panel>
            )}

            <MigrationsPanel
              migrations={migrations}
              affecting={
                new Set(
                  selected
                    ? migrationsForEntity(selected.id).map((item) => item.id)
                    : [],
                )
              }
              selectedName={selected?.name ?? null}
              nameOfFeature={nameOfFeature}
            />
          </>
        )}
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Filters
   --------------------------------------------------------------------------- */

function FilterSelect({
  id,
  label,
  value,
  onChange,
  anyLabel,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  anyLabel: string;
  options: { id: string; name: string }[];
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className="font-chassis text-label text-ink-3 uppercase">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className="min-w-44">
          <SelectValue placeholder={anyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}

function FilteredOut({ onClear }: { onClear: () => void }) {
  return (
    <Empty
      title="No entity matches these filters"
      explanation="Every entity has been filtered out by the module and feature currently selected. Widen the filters to bring them back."
      actions={[{ label: "Clear the filters", onClick: onClear }]}
    />
  );
}

/* ---------------------------------------------------------------------------
   The table reading
   --------------------------------------------------------------------------- */

function EntityTable({
  entities,
  fields,
  relationships,
  selectedId,
  onSelect,
  nameOfModule,
  nameOfFeature,
  migrationCountFor,
  narrow,
}: {
  entities: DataEntity[];
  fields: DataField[];
  relationships: DataRelationship[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  nameOfModule: (id: string | null) => string;
  nameOfFeature: (id: string | null) => string;
  migrationCountFor: (id: string) => number;
  narrow: boolean;
}) {
  const fieldCount = (id: string) =>
    fields.filter((field) => field.entity_id === id).length;
  const linkCount = (id: string) =>
    relationships.filter(
      (relationship) =>
        relationship.from_entity_id === id || relationship.to_entity_id === id,
    ).length;

  if (narrow) {
    return (
      <Panel
        title="Entities"
        description="The same records the diagram draws. Choose one to read its specification."
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-rule">
          {entities.map((entity) => (
            <li
              key={entity.id}
              className={cn(
                "flex flex-col",
                entity.id === selectedId && "bg-signal-wash",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(entity.id)}
                className="flex w-full flex-col gap-1.5 px-3 pt-2 text-left focus-ring row-edge-focus"
              >
                <RecordName name={entity.name} id={entity.id} size="sm" />
                <span className="flex flex-wrap items-center gap-1.5">
                  <Status value={entity.status} size="sm" />
                  <Tag>{countPhrase(fieldCount(entity.id), "field")}</Tag>
                  <Tag>{countPhrase(linkCount(entity.id), "relationship")}</Tag>
                  {isSensitive(entity.sensitivity_class) ? (
                    <Tag title="Classed as sensitive by the project">
                      <ShieldAlert aria-hidden="true" className="size-3" />
                      {titleCase(entity.sensitivity_class)}
                    </Tag>
                  ) : null}
                </span>
              </button>
              {/* The module this entity belongs to, opened on the Product view.
                  It sits outside the row button because an anchor cannot nest
                  inside one. */}
              <span className="px-3 pt-1.5 pb-2 font-prose text-small text-ink-2">
                {entity.module_id ? (
                  <RecordLink
                    name={nameOfModule(entity.module_id)}
                    id={entity.module_id}
                    href={hrefFor("product", entity.module_id)}
                  />
                ) : (
                  <Value missing="No module recorded">{null}</Value>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <Panel
      title="Entities"
      description="The same records the diagram draws, in a form that reads without a canvas. Choose a row to open its specification."
      bodyClassName="p-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Feature</TableHead>
            <TableHead>Stored in</TableHead>
            <TableHead>Sensitivity</TableHead>
            <TableHead className="text-right">Fields</TableHead>
            <TableHead className="text-right">Relationships</TableHead>
            <TableHead className="text-right">Migrations</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entities.map((entity) => (
            <TableRow
              key={entity.id}
              role="button"
              tabIndex={0}
              aria-pressed={entity.id === selectedId}
              aria-label={`Entity ${entity.name}. Open its specification.`}
              onClick={() => onSelect(entity.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(entity.id);
                }
              }}
              className={cn(
                "cursor-pointer focus-ring row-edge-focus",
                entity.id === selectedId &&
                  "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
              )}
            >
              <TableCell>
                <RecordName name={entity.name} id={entity.id} size="sm" />
              </TableCell>
              {/* The module and the feature open on their own views. The row
                  itself opens the entity, so the click stops here. */}
              <TableCell
                className="font-prose text-ink-2"
                onClick={(event) => event.stopPropagation()}
              >
                {entity.module_id ? (
                  <RecordLink
                    name={nameOfModule(entity.module_id)}
                    id={entity.module_id}
                    href={hrefFor("product", entity.module_id)}
                  />
                ) : (
                  <Value missing="No module recorded">{null}</Value>
                )}
              </TableCell>
              <TableCell
                className="font-prose text-ink-2"
                onClick={(event) => event.stopPropagation()}
              >
                {entity.feature_id ? (
                  <RecordLink
                    name={nameOfFeature(entity.feature_id)}
                    id={entity.feature_id}
                    href={hrefFor("features", entity.feature_id)}
                  />
                ) : (
                  <Value missing="No feature recorded">{null}</Value>
                )}
              </TableCell>
              <TableCell>
                <Value missing="Not recorded">{entity.store}</Value>
              </TableCell>
              <TableCell>
                {isSensitive(entity.sensitivity_class) ? (
                  <span className="inline-flex items-center gap-1 text-state-attention">
                    <ShieldAlert aria-hidden="true" className="size-3" />
                    {titleCase(entity.sensitivity_class)}
                  </span>
                ) : (
                  <Value missing="Not classed">
                    {entity.sensitivity_class
                      ? titleCase(entity.sensitivity_class)
                      : null}
                  </Value>
                )}
              </TableCell>
              <TableCell className="text-right">{fieldCount(entity.id)}</TableCell>
              <TableCell className="text-right">{linkCount(entity.id)}</TableCell>
              <TableCell className="text-right">
                {migrationCountFor(entity.id)}
              </TableCell>
              <TableCell>
                <Status value={entity.status} size="sm" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   One entity, in full
   --------------------------------------------------------------------------- */

function EntitySpecification({
  entity,
  fields,
  relationships,
  entityNames,
  migrations,
  moduleName,
  featureName,
  onClose,
}: {
  entity: DataEntity;
  fields: DataField[];
  relationships: DataRelationship[];
  entityNames: Map<string, DataEntity>;
  migrations: SchemaMigration[];
  moduleName: string;
  featureName: string;
  onClose: () => void;
}) {
  const ordered = fields.slice().sort((a, b) => a.sequence - b.sequence);
  const nameOf = (id: string) => entityNames.get(id)?.name ?? id;

  return (
    <Panel
      title={entity.name}
      description={
        entity.purpose ??
        "No purpose has been written for this entity yet, so what it is for has to be inferred from its fields."
      }
      actions={
        <>
          <Status value={entity.status} />
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Facts
          columns={3}
          items={[
            {
              label: "Identifier",
              value: (
                <span className="font-chassis text-chassis-sm text-ink-3">
                  {entity.id}
                </span>
              ),
            },
            {
              label: "Module",
              value: entity.module_id ? (
                <RecordLink
                  name={moduleName}
                  id={entity.module_id}
                  href={hrefFor("product", entity.module_id)}
                />
              ) : (
                <Value missing="No module recorded">{null}</Value>
              ),
            },
            {
              label: "Feature",
              value: entity.feature_id ? (
                <RecordLink
                  name={featureName}
                  id={entity.feature_id}
                  href={hrefFor("features", entity.feature_id)}
                />
              ) : (
                <Value missing="No feature recorded">{null}</Value>
              ),
            },
            {
              label: "Where it is stored",
              value: <Value missing="Not recorded">{entity.store}</Value>,
            },
            {
              label: "Where the schema comes from",
              value: <Value missing="Not recorded">{entity.schema_source}</Value>,
            },
            {
              label: "Sensitivity",
              value: (
                <Value missing="Not classed">
                  {entity.sensitivity_class
                    ? titleCase(entity.sensitivity_class)
                    : null}
                </Value>
              ),
            },
            {
              label: "How long it is kept",
              value: <Value missing="Not recorded">{entity.retention_rule}</Value>,
            },
            {
              label: "What deleting it means",
              value: (
                <Value missing="Not recorded">{entity.deletion_semantics}</Value>
              ),
            },
          ]}
        />

        <div className="flex flex-col gap-2">
          <h4 className="font-chassis text-label text-ink-3 uppercase">
            Fields ({ordered.length} recorded)
          </h4>
          {ordered.length === 0 ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              No field has been recorded for this entity yet, so what it actually
              stores is still unspecified.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value required</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Constraints</TableHead>
                  <TableHead>Sensitivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-prose text-ink">
                      {field.name}
                    </TableCell>
                    <TableCell>
                      <Value missing="Not recorded">{field.type}</Value>
                    </TableCell>
                    <TableCell>
                      {isTrue(field.nullable) ? "May be empty" : "Always required"}
                    </TableCell>
                    <TableCell>
                      <Value missing="No default">{field.default_value}</Value>
                    </TableCell>
                    <TableCell className="font-prose text-ink-2">
                      <Value missing="None recorded">
                        {(field.constraints_json ?? []).join(", ") || null}
                      </Value>
                    </TableCell>
                    <TableCell>
                      {isSensitive(field.sensitivity_class) ? (
                        <span className="inline-flex items-center gap-1 text-state-attention">
                          <ShieldAlert aria-hidden="true" className="size-3" />
                          {titleCase(field.sensitivity_class)}
                        </span>
                      ) : (
                        <Value missing="Not classed">
                          {field.sensitivity_class
                            ? titleCase(field.sensitivity_class)
                            : null}
                        </Value>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-chassis text-label text-ink-3 uppercase">
            Relationships ({relationships.length} recorded)
          </h4>
          {relationships.length === 0 ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              Nothing else in the model is recorded as related to this entity. It
              either stands alone or its relationships have not been specified.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {relationships.map((relationship) => (
                <li key={relationship.id} className="font-prose text-small text-ink-2">
                  <span className="text-ink">{relationship.name}</span>
                  {": "}
                  <RecordLink
                    name={nameOf(relationship.from_entity_id)}
                    id={relationship.from_entity_id}
                    href={hrefFor("data", relationship.from_entity_id)}
                  />{" "}
                  to{" "}
                  <RecordLink
                    name={nameOf(relationship.to_entity_id)}
                    id={relationship.to_entity_id}
                    href={hrefFor("data", relationship.to_entity_id)}
                  />
                  .{" "}
                  {cardinalityPhrase(relationship.cardinality)}. When the parent is
                  deleted, {deletePhrase(relationship.on_delete)}.
                  {relationship.ownership_note
                    ? ` ${relationship.ownership_note}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-chassis text-label text-ink-3 uppercase">
            Migrations affecting this entity ({migrations.length})
          </h4>
          {/* The feature opens on the Features view, which lists these same
              migrations against it. */}
          <p className="font-prose text-small text-ink-3 prose-measure">
            A migration is recorded against a feature rather than a single entity,
            so these are the migrations belonging to{" "}
            {entity.feature_id ? (
              <RecordLink
                name={featureName}
                id={entity.feature_id}
                href={hrefFor("features", entity.feature_id)}
              />
            ) : (
              featureName
            )}
            , the feature this entity is part of.
          </p>
          {migrations.length === 0 ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              No migration has been recorded for this feature, so nothing planned
              changes the shape of this entity.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {migrations.map((migration) => (
                <li key={migration.id} className="flex flex-wrap items-center gap-2">
                  <RecordName name={migration.name} id={migration.id} size="sm" />
                  <Status value={migration.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Migrations
   --------------------------------------------------------------------------- */

/**
 * Migration columns. This panel was the last raw table in the application, so
 * at 375px it was the one thing that still scrolled sideways while every other
 * record set stacked. DataGrid gives it the same two shapes as the rest.
 */
function migrationColumns(
  affecting: Set<string>,
  nameOfFeature: (id: string | null) => string,
): Column<SchemaMigration>[] {
  return [
    {
      key: "sequence",
      label: "Order",
      numeric: true,
      className: "w-14 text-ink-3",
      cell: (migration) => migration.sequence,
    },
    {
      key: "name",
      label: "Migration",
      lead: true,
      cell: (migration) => (
        <span className="flex flex-col gap-1">
          <RecordName name={migration.name} id={migration.id} size="sm" />
          {affecting.has(migration.id) ? (
            <span className="font-chassis text-chassis-sm text-signal">
              Affects the selected entity
            </span>
          ) : null}
        </span>
      ),
    },
    {
      // A migration belongs to a feature, and the Features view is the only
      // place the migration itself is listed as a record.
      key: "feature",
      label: "Feature",
      cell: (migration) =>
        migration.feature_id ? (
          <RecordLink
            name={nameOfFeature(migration.feature_id)}
            id={migration.feature_id}
            href={hrefFor("features", migration.feature_id)}
          />
        ) : (
          <Value missing="No feature recorded">{null}</Value>
        ),
    },
    {
      key: "forward",
      label: "Forward plan",
      className: "font-prose text-ink-2",
      cell: (migration) => <Value missing="Not recorded">{migration.forward_plan}</Value>,
    },
    {
      key: "rollback",
      label: "Rollback plan",
      className: "font-prose text-ink-2",
      cell: (migration) => <Value missing="Not recorded">{migration.rollback_plan}</Value>,
    },
    {
      key: "applied",
      label: "Applied",
      cell: (migration) =>
        migration.applied_at ? (
          <span title={absoluteTime(migration.applied_at)}>
            {relativeTime(migration.applied_at)}
          </span>
        ) : (
          "Not applied yet"
        ),
    },
    {
      key: "status",
      label: "Status",
      cell: (migration) => <Status value={migration.status} size="sm" />,
    },
  ];
}

function MigrationsPanel({
  migrations,
  affecting,
  selectedName,
  nameOfFeature,
}: {
  migrations: SchemaMigration[];
  affecting: Set<string>;
  selectedName: string | null;
  nameOfFeature: (id: string | null) => string;
}) {
  const ordered = migrations.slice().sort((a, b) => a.sequence - b.sequence);

  return (
    <Panel
      title="Migrations"
      description={
        selectedName
          ? `Every recorded schema change, in order. The ones affecting ${selectedName} are marked.`
          : "Every recorded schema change, in order. Choose an entity to see which of these affect it."
      }
      bodyClassName="p-0"
    >
      <DataGrid
        caption="Every recorded schema change, in order, with its forward and rollback plans."
        rows={ordered}
        rowKey={(migration) => migration.id}
        columns={migrationColumns(affecting, nameOfFeature)}
        blocked={(migration) => affecting.has(migration.id)}
        empty={
          <Empty
            density="inline"
            className="rounded-none border-0"
            title="No migrations recorded"
            explanation="No schema change has been planned or applied yet. Record one with superdev migration record, saying what it does and how it is rolled back. The rollback is required, because a migration with no way back is what turns a bad deploy into an outage."
          />
        }
      />
    </Panel>
  );
}
