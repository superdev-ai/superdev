/**
 * Nodes for the two architecture maps: the runtime topology and the logical
 * module map.
 *
 * Two rules shape these.
 *
 * Shape carries type, colour never does. A store, a service, a client and an
 * external system are told apart by their outline and their glyph, so the
 * picture survives greyscale and colour blindness.
 *
 * A piece with no recorded evidence is drawn as inferred, not as fact. It gets
 * a broken outline, a written "Inferred" label and a sentence saying why it is
 * uncertain, because a diagram that presents a guess as a recorded truth is
 * worse than no diagram.
 */

import {
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  Boxes,
  Cpu,
  Database,
  Globe,
  HelpCircle,
  Layers,
  Milestone,
  Monitor,
  Server,
  type LucideIcon,
} from "lucide-react";

import { labelledEdge } from "@/components/diagrams/graph-canvas";
import { Status } from "@/components/shell/status";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ModuleDependency, RuntimeEdge, RuntimePiece } from "@/types";

const PIECE_WIDTH = 224;
const MODULE_WIDTH = 224;

/* ---------------------------------------------------------------------------
   Kinds
   --------------------------------------------------------------------------- */

interface KindStyle {
  icon: LucideIcon;
  /** The outline that carries the type. */
  shape: string;
  label: string;
  meaning: string;
}

const KINDS: Record<string, KindStyle> = {
  service: {
    icon: Server,
    shape: "rounded-sd-lg",
    label: "Service",
    meaning: "Something that runs and answers requests",
  },
  store: {
    icon: Database,
    shape: "rounded-t-[4px] rounded-b-[18px]",
    label: "Store",
    meaning: "Something that holds data",
  },
  client: {
    icon: Monitor,
    // The mirror image of a store: flat where the store is round.
    shape: "rounded-t-[18px] rounded-b-[4px]",
    label: "Client",
    meaning: "Something a person uses directly",
  },
  worker: {
    icon: Cpu,
    shape: "rounded-sd-sm",
    label: "Worker",
    meaning: "Something that runs work in the background",
  },
  external: {
    icon: Globe,
    shape: "rounded-[26px]",
    label: "External System",
    meaning: "Something outside this project that it depends on",
  },
};

const UNKNOWN_KIND: KindStyle = {
  icon: Boxes,
  shape: "rounded-sd",
  label: "Runtime Piece",
  meaning: "A runtime piece whose kind is not one the interface recognises",
};

export function kindStyle(kind: string | null | undefined): KindStyle {
  if (!kind) return UNKNOWN_KIND;
  const key = kind.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (KINDS[key]) return KINDS[key];
  // Common near-misses, so a reasonable stored word still gets its own shape.
  if (/db|database|storage|cache|queue|bucket/.test(key)) return KINDS.store;
  if (/api|server|backend|gateway/.test(key)) return KINDS.service;
  if (/ui|web|app|frontend|cli/.test(key)) return KINDS.client;
  if (/job|cron|batch|consumer/.test(key)) return KINDS.worker;
  if (/third|vendor|saas|provider|integration/.test(key)) return KINDS.external;
  return { ...UNKNOWN_KIND, label: titleCase(kind) };
}

/* ---------------------------------------------------------------------------
   Runtime piece node
   --------------------------------------------------------------------------- */

export interface RuntimeNodeReading extends Record<string, unknown> {
  name: string;
  pieceId: string;
  kind: string;
  status: string;
  /** Plain language, e.g. "Owns 2 entities" or "Owns no data". */
  ownership: string;
  /** True when nothing in the project records this piece beyond its name. */
  inferred: boolean;
  /** Why it counts as inferred, or what records it. */
  evidence: string;
}

function RuntimePieceNode({ data, selected }: NodeProps) {
  const piece = data as unknown as RuntimeNodeReading;
  const style = kindStyle(piece.kind);
  const Icon = style.icon;

  return (
    <div
      title={`${style.label}: ${style.meaning}. ${piece.evidence}`}
      className={cn(
        "flex w-[224px] flex-col gap-1 bg-panel px-2.5 py-2",
        style.shape,
        selected ? "border-2 border-signal" : "border border-rule",
        piece.inferred && "border-dashed",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border-0 !bg-rule-strong"
      />
      <div className="flex items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-prose text-subtitle text-ink">
            {piece.name}
          </span>
          <span className="block truncate font-chassis text-[10px] text-ink-3">
            {style.label}, {piece.pieceId}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Status value={piece.status} size="sm" />
        {piece.inferred ? (
          <span className="inline-flex items-center gap-1 rounded-sd-sm border border-state-attention/45 bg-state-attention-wash px-1.5 py-0.5 font-chassis text-chassis-sm text-state-attention">
            <HelpCircle aria-hidden="true" className="size-3" />
            Inferred
          </span>
        ) : null}
      </div>
      <span className="truncate font-chassis text-[10px] text-ink-3">
        {piece.ownership}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-rule-strong"
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Module node
   --------------------------------------------------------------------------- */

export interface ModuleNodeReading extends Record<string, unknown> {
  name: string;
  moduleId: string;
  status: string;
  /** "Critical path, step 2 of 5", or the reason it is not on it. */
  criticalNote: string;
  onCriticalPath: boolean;
  dependencyNote: string;
}

function ModuleNode({ data, selected }: NodeProps) {
  const module = data as unknown as ModuleNodeReading;

  return (
    <div
      className={cn(
        "flex w-[224px] flex-col gap-1 rounded-sd-lg bg-panel px-2.5 py-2",
        selected ? "border-2 border-signal" : "border border-rule",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border-0 !bg-rule-strong"
      />
      <div className="flex items-start gap-2">
        <Layers aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-prose text-subtitle text-ink">
            {module.name}
          </span>
          <span className="block truncate font-chassis text-[10px] text-ink-3">
            {module.moduleId}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Status value={module.status} size="sm" />
        {module.onCriticalPath ? (
          <span
            title={`On the critical path. ${module.criticalNote}.`}
            className="inline-flex items-center gap-1 rounded-sd-sm border border-rule-strong bg-inset px-1.5 py-0.5 font-chassis text-chassis-sm text-ink-2"
          >
            <Milestone aria-hidden="true" className="size-3" />
            {module.criticalNote}
            <span className="sr-only">. On the critical path.</span>
          </span>
        ) : null}
      </div>
      <span className="truncate font-chassis text-[10px] text-ink-3">
        {module.dependencyNote}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-rule-strong"
      />
    </div>
  );
}

/** Module level so the reference is stable across renders, as xyflow requires. */
export const architectureNodeTypes: NodeTypes = {
  runtimePiece: RuntimePieceNode,
  module: ModuleNode,
};

/* ---------------------------------------------------------------------------
   Building the graphs
   --------------------------------------------------------------------------- */

export function buildRuntimeGraph({
  pieces,
  edges,
  readingFor,
}: {
  pieces: RuntimePiece[];
  edges: RuntimeEdge[];
  /** The view decides what counts as evidence and says so in plain language. */
  readingFor: (piece: RuntimePiece) => {
    inferred: boolean;
    evidence: string;
    ownership: string;
  };
}): { nodes: Node[]; edges: Edge[] } {
  const shown = new Set(pieces.map((piece) => piece.id));

  const nodes: Node[] = pieces.map((piece) => {
    const reading = readingFor(piece);
    const data: RuntimeNodeReading = {
      name: piece.name,
      pieceId: piece.id,
      kind: piece.kind,
      status: piece.status,
      ownership: reading.ownership,
      inferred: reading.inferred,
      evidence: reading.evidence,
    };
    return {
      id: piece.id,
      type: "runtimePiece",
      position: { x: 0, y: 0 },
      width: PIECE_WIDTH,
      height: reading.inferred ? 116 : 104,
      data: data as unknown as Record<string, unknown>,
    };
  });

  const flowEdges: Edge[] = edges
    .filter((edge) => shown.has(edge.from_id) && shown.has(edge.to_id))
    .map((edge) =>
      labelledEdge({
        id: edge.id,
        source: edge.from_id,
        target: edge.to_id,
        // The relationship alone. What carries it is a sentence, and a sentence
        // on an edge is wider than the gap it has to fit in, so the protocol
        // lives in the connections table and the piece detail instead.
        label: titleCase(edge.relationship) || "Talks to",
      }),
    );

  return { nodes, edges: flowEdges };
}

export function buildModuleGraph({
  modules,
  dependencies,
  criticalPath,
}: {
  modules: { id: string; name: string; status: string }[];
  dependencies: ModuleDependency[];
  criticalPath: string[];
}): { nodes: Node[]; edges: Edge[] } {
  const shown = new Set(modules.map((module) => module.id));
  const criticalIndex = new Map(criticalPath.map((id, index) => [id, index]));

  const nodes: Node[] = modules.map((module) => {
    const index = criticalIndex.get(module.id);
    const dependsOn = dependencies.filter(
      (dependency) => dependency.from_module_id === module.id,
    ).length;
    const dependedOnBy = dependencies.filter(
      (dependency) => dependency.to_module_id === module.id,
    ).length;

    const data: ModuleNodeReading = {
      name: module.name,
      moduleId: module.id,
      status: module.status,
      onCriticalPath: index !== undefined,
      criticalNote:
        index === undefined
          ? "Not on the critical path"
          : `Step ${index + 1} of ${criticalPath.length}`,
      dependencyNote: `Depends on ${dependsOn}, needed by ${dependedOnBy}`,
    };

    return {
      id: module.id,
      type: "module",
      position: { x: 0, y: 0 },
      width: MODULE_WIDTH,
      height: index === undefined ? 100 : 116,
      data: data as unknown as Record<string, unknown>,
    };
  });

  const edges: Edge[] = dependencies
    .filter(
      (dependency) =>
        shown.has(dependency.from_module_id) && shown.has(dependency.to_module_id),
    )
    .map((dependency) =>
      labelledEdge({
        id: `${dependency.from_module_id}-${dependency.to_module_id}`,
        source: dependency.from_module_id,
        target: dependency.to_module_id,
        // Why one module needs another is a sentence, and it is printed in
        // full in the dependency table. The edge says which kind of need it is.
        label: dependency.critical ? "Critical path" : "Depends on",
        emphasis: dependency.critical,
        colorVar: dependency.critical ? "var(--sd-ink-3)" : undefined,
      }),
    );

  return { nodes, edges };
}
