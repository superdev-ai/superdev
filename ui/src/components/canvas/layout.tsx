/**
 * The graph model both canvases share, plus the automatic layout that places it.
 *
 * A canvas view describes what it wants drawn as plain records and relations.
 * Everything else (dagre, filters, highlighting, saved positions, the detail
 * panel, the keyboard path) lives in `graph-canvas.tsx`, so the two canvases
 * cannot drift apart in behaviour.
 *
 * Two placements are supported:
 *
 * - "tiers" for the product blueprint, where the declared reading order is
 *   Goals, Milestones, Modules, Features, Workflows, Tasks. Dagre decides the
 *   order of records inside a tier so lines cross as little as possible, and
 *   the tier decides the column, so the chain always reads left to right.
 * - "network" for the discovery mind map, which has no hierarchy to honour, so
 *   dagre places it outright.
 *
 * A manually moved node always wins over both, and those positions are stored
 * through the `layout.save` mutation.
 */

import { graphlib, layout as runDagre } from "dagre";
import type { LucideIcon } from "lucide-react";

import type { LayoutPosition } from "@/types";

/** Nodes are a fixed size so the layout is deterministic across reloads. */
export const NODE_WIDTH = 248;
/** Tall enough for the header row, two lines of name, and the status row. */
export const NODE_HEIGHT = 120;

/**
 * Spacing. Generous on purpose.
 *
 * This is an infinite canvas with zoom and a fit control, so nothing is gained
 * by packing cards together, and a great deal is lost: edges leaving adjacent
 * cards overlap before they separate, and a label sits on top of the card next
 * to it. Room between the cards is what makes a line followable.
 */
const RANK_GAP = 180;
/** Ceiling on how wide one tier band runs before it wraps to another row. */
const MAX_BAND_COLUMNS = 10;
const NODE_GAP = 72;

/** How a node's type is encoded without using colour. */
export interface NodeShape {
  /** Corner treatment: one of four, so the silhouette differs per type. */
  corner: "square" | "small" | "large" | "round";
  /** Shape of the glyph plate at the top left of the node. */
  badge: "square" | "diamond" | "circle";
  /** A dashed edge marks a record that is a step towards something else. */
  outline: "solid" | "dashed";
}

/** Everything the canvas needs to draw and explain one kind of record. */
export interface TypeStyle {
  /** Plain-language name for the kind of record, e.g. "Feature". */
  label: string;
  icon: LucideIcon;
  shape: NodeShape;
  /** One sentence saying what this kind of record is, for the legend. */
  description: string;
  /**
   * Type colour key, resolving to --sd-type-*. A second channel only: the
   * silhouette and the glyph already say what this is, so a reader who cannot
   * separate these hues loses nothing.
   */
  tone?: "goal" | "milestone" | "module" | "feature" | "workflow" | "task";
}

export interface GraphRecord {
  id: string;
  /** The name a person reads first. */
  name: string;
  /** Key into the type style table. */
  typeKey: string;
  /**
   * What this record is called in the layout table, when that differs from the
   * display type. Discovery draws by item kind, and the service only stores
   * discovery_item.
   */
  layoutType?: string;
  /** Stored status value; the canvas maps it to a glyph and a Title Case word. */
  status: string | null;
  /**
   * One short reading shown under the name. It must always say what it counts,
   * for example "4 of 9 acceptance criteria met" or "Not measurable".
   */
  meta?: string | null;
  /** One line of prose for the detail panel and the record list. */
  summary?: string | null;
  /** Column in the hierarchical placement. Ignored by the network placement. */
  tier?: number;
  /** Owning record, used for collapsing a module or a feature. */
  parentId?: string | null;
  /** Extra words folded into the search index, e.g. a purpose or an owner. */
  searchText?: string | null;
}

export interface GraphRelation {
  id: string;
  from: string;
  to: string;
  /** Key for the relationship filter. */
  kindKey: string;
  /** Title Case name of the relationship, e.g. "Contains", "Depends On". */
  kindLabel: string;
  /**
   * True for the containment spine. False marks a cross-cutting relationship,
   * which is drawn dashed, labelled, and can be switched off on its own.
   */
  hierarchy: boolean;
}

export interface XY {
  x: number;
  y: number;
}

export type LayoutMode = "tiers" | "network";

/**
 * Runs dagre over the whole graph and returns one point per record. Used
 * directly by the network placement, and only for its ordering by the tiered
 * placement.
 */
function dagrePositions(
  records: GraphRecord[],
  relations: GraphRelation[],
  rankdir: "LR" | "TB",
): Map<string, XY> {
  const graph = new graphlib.Graph();
  graph.setGraph({
    rankdir,
    nodesep: NODE_GAP,
    ranksep: RANK_GAP,
    edgesep: 16,
    marginx: 40,
    marginy: 40,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set<string>();
  for (const record of records) {
    graph.setNode(record.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    known.add(record.id);
  }
  for (const relation of relations) {
    if (relation.from === relation.to) continue;
    if (!known.has(relation.from) || !known.has(relation.to)) continue;
    graph.setEdge(relation.from, relation.to);
  }

  runDagre(graph);

  const placed = new Map<string, XY>();
  for (const record of records) {
    const node = graph.hasNode(record.id) ? graph.node(record.id) : null;
    placed.set(
      record.id,
      node
        ? { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 }
        : { x: 0, y: 0 },
    );
  }
  return placed;
}

/**
 * The automatic placement. Returns a point for every record, in canvas
 * coordinates.
 */
export function automaticLayout(
  records: GraphRecord[],
  relations: GraphRelation[],
  mode: LayoutMode,
): Record<string, XY> {
  if (records.length === 0) return {};

  const ordering = dagrePositions(records, relations, "TB");

  // Both arrangements are bands that wrap. They differ only in what decides
  // which band a record belongs to.
  //
  // "tiers" bands by declared kind, so the map reads goals through workflows.
  // "network" bands by the depth dagre gives it, so a record sits next to what
  // it connects to regardless of kind, which is how the entity diagram reads.
  //
  // Neither uses dagre's own coordinates. On this shape of graph, a shallow
  // tree with wide ranks, dagre puts thirty five siblings in one column and
  // returns something 688 pixels wide and 7670 tall. Wrapping is what keeps
  // either arrangement readable.
  // "network" hands placement to dagre outright, which is how the entity
  // diagram reads: a record sits beside what it points at, and the arrangement
  // follows the relationships rather than the kinds. It runs taller than the
  // banded view on a tree shaped graph, which is the honest trade for putting
  // connected records together, and the canvas pans and zooms.
  if (mode === "network") {
    return Object.fromEntries(dagrePositions(records, relations, "LR"));
  }

  const byTier = new Map<number, GraphRecord[]>();
  for (const record of records) {
    const tier = record.tier ?? 0;
    const bucket = byTier.get(tier);
    if (bucket) bucket.push(record);
    else byTier.set(tier, [record]);
  }

  const tiers = [...byTier.keys()].sort((a, b) => a - b);
  const positions: Record<string, XY> = {};

  // Each tier is a horizontal band, and a band wraps.
  //
  // Tiers used to be columns with every member stacked in one, which is fine
  // for four goals and unusable for thirty five features: the graph became a
  // single node wide and thousands of pixels tall, a vertical thread nobody can
  // read and a minimap showing one line. Bands read in the declared order top
  // to bottom, goals then milestones then modules then features, and wrapping
  // means a crowded tier grows sideways into space that is already there rather
  // than downwards into space that is not.
  //
  // The wrap width comes from the widest tier so the bands align with each
  // other, capped so no single row runs off into the distance.
  const widest = Math.max(...tiers.map((t) => byTier.get(t)?.length ?? 0));
  const perRow = Math.max(1, Math.min(MAX_BAND_COLUMNS, Math.ceil(Math.sqrt(widest * 2.2))));

  let y = 0;
  for (const tier of tiers) {
    const bucket = byTier.get(tier) ?? [];
    // Order within the band by what dagre made of the relations, so records
    // that point at each other sit near each other instead of alphabetically.
    bucket.sort((a, b) => {
      const ax = ordering.get(a.id)?.x ?? 0;
      const bx = ordering.get(b.id)?.x ?? 0;
      if (ax !== bx) return ax - bx;
      return a.name.localeCompare(b.name);
    });

    const columns = Math.min(perRow, Math.max(1, bucket.length));
    // Centre a short band under a wide one, so the shape reads as a hierarchy
    // rather than as everything jammed against the left edge.
    const indent = ((perRow - columns) * (NODE_WIDTH + NODE_GAP)) / 2;

    bucket.forEach((record, index) => {
      positions[record.id] = {
        x: indent + (index % columns) * (NODE_WIDTH + NODE_GAP),
        y: y + Math.floor(index / columns) * (NODE_HEIGHT + NODE_GAP),
      };
    });

    const rows = Math.ceil(bucket.length / columns);
    y += rows * (NODE_HEIGHT + NODE_GAP) + RANK_GAP;
  }

  return positions;
}

/**
 * Reads the saved canvas positions out of a payload. The field is optional on
 * several payloads, so this stays defensive rather than assuming it is there:
 * a service that has not stored a layout yet is a normal state, not an error.
 */
export function readSavedLayout(payload: unknown): LayoutPosition[] {
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as { layout?: unknown }).layout;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is LayoutPosition =>
      Boolean(entry) &&
      typeof (entry as LayoutPosition).id === "string" &&
      Number.isFinite((entry as LayoutPosition).x) &&
      Number.isFinite((entry as LayoutPosition).y),
  );
}

/** Saved positions as a lookup, so they can be layered over the automatic ones. */
export function savedPositionMap(saved: LayoutPosition[]): Record<string, XY> {
  const map: Record<string, XY> = {};
  for (const entry of saved) map[entry.id] = { x: entry.x, y: entry.y };
  return map;
}

/** The shape the `layout.save` mutation is given. */
/**
 * Positions in the shape layout.save accepts.
 *
 * The mutation wants recordType and recordId per entry and validates both
 * against an allowlist. This used to emit a bare id, so every save was refused
 * and the canvas reported it as a failure the reader could do nothing about.
 * The type comes from the record itself, because only the view knows whether a
 * node is a feature or a discovery item.
 */
export function positionsToLayout(
  positions: Record<string, XY>,
  typeOf: (id: string) => string | null,
): { recordType: string; recordId: string; x: number; y: number }[] {
  const out: { recordType: string; recordId: string; x: number; y: number }[] = [];
  for (const [id, point] of Object.entries(positions)) {
    const recordType = typeOf(id);
    // A node whose type the service would refuse is left out rather than
    // failing the whole save and losing every other position with it.
    if (!recordType) continue;
    out.push({ recordType, recordId: id, x: Math.round(point.x), y: Math.round(point.y) });
  }
  return out;
}

/** Every record reachable downwards from `roots` through `parentId`. */
export function descendantsOf(
  records: GraphRecord[],
  roots: Iterable<string>,
): Set<string> {
  const children = new Map<string, string[]>();
  for (const record of records) {
    if (!record.parentId) continue;
    const bucket = children.get(record.parentId);
    if (bucket) bucket.push(record.id);
    else children.set(record.parentId, [record.id]);
  }

  const found = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) break;
    for (const child of children.get(id) ?? []) {
      if (found.has(child)) continue;
      found.add(child);
      queue.push(child);
    }
  }
  return found;
}
