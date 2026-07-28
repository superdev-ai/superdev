/**
 * The entity relationship diagram.
 *
 * Each node is an entity with its fields listed: name, type, whether a value is
 * required, and whether the field is marked sensitive. Each edge is a recorded
 * relationship, labelled with its cardinality and what happens to the other
 * side on delete, because an unlabelled line between two tables tells a reader
 * nothing they could act on.
 *
 * The diagram is one of two readings of the same data. Its view also renders a
 * table, which is the readable form on a phone and the keyboard route
 * everywhere.
 */

import { Handle, Position, type Edge, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { KeyRound, ShieldAlert } from "lucide-react";

import { labelledEdge } from "@/components/diagrams/graph-canvas";
import { Status } from "@/components/shell/status";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DataEntity, DataField, DataRelationship } from "@/types";

/** Beyond this the node stops being readable, so the rest are counted instead. */
const NODE_WIDTH = 268;
const HEADER_HEIGHT = 52;
const FIELD_ROW_HEIGHT = 20;
const FOOTER_HEIGHT = 22;

export interface EntityFieldReading {
  id: string;
  name: string;
  type: string;
  required: boolean;
  sensitive: boolean;
  key: boolean;
}

export interface EntityNodeReading extends Record<string, unknown> {
  name: string;
  entityId: string;
  status: string;
  store: string | null;
  fields: EntityFieldReading[];
  /** Plain language, e.g. "3 migrations recorded against this entity". */
  migrationNote: string;
  migrationsAffect: boolean;
}

/* ---------------------------------------------------------------------------
   Plain language for the stored vocabulary
   --------------------------------------------------------------------------- */

const CARDINALITY_WORDS: Record<string, string> = {
  one_to_one: "One to one",
  one_to_many: "One to many",
  many_to_one: "Many to one",
  many_to_many: "Many to many",
};

const DELETE_WORDS: Record<string, string> = {
  cascade: "the related rows are deleted too",
  restrict: "the delete is refused",
  set_null: "the link is cleared",
  set_default: "the link falls back to its default",
  no_action: "nothing else happens",
};

export function cardinalityPhrase(value: string | null | undefined): string {
  if (!value) return "Cardinality not recorded";
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CARDINALITY_WORDS[key] ?? titleCase(value);
}

export function deletePhrase(value: string | null | undefined): string {
  if (!value) return "the delete behaviour is not recorded";
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DELETE_WORDS[key] ?? `it is recorded as ${titleCase(value)}`;
}

/** The short form, for an edge label where the long sentence would not fit. */
export function deleteLabel(value: string | null | undefined): string {
  return value ? titleCase(value) : "Not recorded";
}

/** A field is sensitive when the project has classed it as anything but public. */
export function isSensitive(value: string | null | undefined): boolean {
  if (!value) return false;
  return !/^(public|none|not_applicable)$/i.test(value.trim().replace(/\s+/g, "_"));
}

function looksLikeKey(field: DataField): boolean {
  const constraints = (field.constraints_json ?? []).join(" ").toLowerCase();
  return /primary|unique|foreign/.test(constraints) || /^id$/i.test(field.name);
}

/* ---------------------------------------------------------------------------
   The node
   --------------------------------------------------------------------------- */

function EntityNode({ data, selected }: NodeProps) {
  const entity = data as unknown as EntityNodeReading;

  return (
    <div
      className={cn(
        "w-[268px] overflow-hidden rounded-sd-lg border bg-panel",
        selected ? "border-2 border-signal" : "border-rule",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border-0 !bg-rule-strong"
      />
      <div className="flex flex-col gap-1 border-b border-rule bg-panel-raised px-2.5 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-prose text-subtitle text-ink">
            {entity.name}
          </span>
          <Status value={entity.status} size="sm" />
        </div>
        <div className="flex items-center gap-2 font-chassis text-[10px] text-ink-3">
          <span className="truncate">{entity.entityId}</span>
          {entity.store ? (
            <span className="truncate">Stored in {entity.store}</span>
          ) : null}
        </div>
      </div>

      <ul className="flex flex-col">
        {entity.fields.map((field) => (
          <li
            key={field.id}
            className="flex h-5 items-center gap-1.5 px-2.5 font-chassis text-[11px]"
          >
            {field.key ? (
              <KeyRound aria-hidden="true" className="size-2.5 shrink-0 text-ink-3" />
            ) : (
              <span aria-hidden="true" className="size-2.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-ink">{field.name}</span>
            <span className="shrink-0 text-ink-3">{field.type}</span>
            <span
              className={cn(
                "shrink-0",
                field.required ? "text-ink-2" : "text-ink-3",
              )}
              title={
                field.required
                  ? "A value is always required"
                  : "A value may be missing"
              }
            >
              {field.required ? "req" : "opt"}
            </span>
            {field.sensitive ? (
              <ShieldAlert
                aria-hidden="true"
                className="size-2.5 shrink-0 text-state-attention"
              />
            ) : (
              <span aria-hidden="true" className="size-2.5 shrink-0" />
            )}
          </li>
        ))}
        {entity.fields.length === 0 ? (
          <li className="flex h-5 items-center px-2.5 font-chassis text-[11px] text-ink-3">
            {/*
              An entity with no fields is one of two different things, and the
              same sentence for both hid which. A planned entity has no columns
              because nothing creates the table; a stored one that shows none is
              a gap in the record. "Not recorded yet" only fits the second.
            */}
            {entity.status === "planned"
              ? "No table exists for this yet"
              : "No fields recorded yet"}
          </li>
        ) : null}
      </ul>

      {entity.migrationsAffect ? (
        <div className="flex h-[22px] items-center justify-end border-t border-rule px-2.5 font-chassis text-[10px] text-ink-3">
          <span className="shrink-0 rounded-sd-sm border border-state-attention/45 bg-state-attention-wash px-1 text-state-attention">
            Migration
          </span>
        </div>
      ) : null}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-rule-strong"
      />
    </div>
  );
}

/** Module level so the reference is stable across renders, as xyflow requires. */
export const entityNodeTypes: NodeTypes = { entity: EntityNode };

/* ---------------------------------------------------------------------------
   Building the graph
   --------------------------------------------------------------------------- */

export function buildEntityGraph({
  entities,
  fields,
  relationships,
  migrationCountFor,
}: {
  entities: DataEntity[];
  fields: DataField[];
  relationships: DataRelationship[];
  /** How many migrations touch this entity, already counted by the view. */
  migrationCountFor: (entityId: string) => number;
}): { nodes: Node[]; edges: Edge[] } {
  const shown = new Set(entities.map((entity) => entity.id));

  const nodes: Node[] = entities.map((entity) => {
    const own = fields
      .filter((field) => field.entity_id === entity.id)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    // Every field, not the first eight. A diagram of a schema that hides half
    // the columns makes the reader open a panel to answer the question the
    // diagram exists to answer. Node height is derived from the row count just
    // below, so a wide table simply draws a taller box.
    const visible = own;
    const migrations = migrationCountFor(entity.id);

    const data: EntityNodeReading = {
      name: entity.name,
      entityId: entity.id,
      status: entity.status,
      store: entity.store,
      fields: visible.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type || "type not recorded",
        required: !(field.nullable === true || field.nullable === 1),
        sensitive: isSensitive(field.sensitivity_class ?? entity.sensitivity_class),
        key: looksLikeKey(field),
      })),
      migrationNote:
        migrations === 0
          ? "No migration recorded against this entity"
          : `${migrations} migrations recorded against this entity`,
      migrationsAffect: migrations > 0,
    };

    const rows = Math.max(visible.length, 1);
    const footer = data.migrationsAffect ? FOOTER_HEIGHT : 0;

    return {
      id: entity.id,
      type: "entity",
      position: { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: HEADER_HEIGHT + rows * FIELD_ROW_HEIGHT + footer,
      data: data as unknown as Record<string, unknown>,
    };
  });

  const edges: Edge[] = relationships
    .filter(
      (relationship) =>
        shown.has(relationship.from_entity_id) && shown.has(relationship.to_entity_id),
    )
    .map((relationship) =>
      labelledEdge({
        id: relationship.id,
        source: relationship.from_entity_id,
        target: relationship.to_entity_id,
        label: `${cardinalityPhrase(relationship.cardinality)}, on delete: ${deleteLabel(relationship.on_delete)}`,
      }),
    );

  return { nodes, edges };
}
