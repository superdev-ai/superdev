/**
 * One node on a canvas.
 *
 * It is a real card built from the design tokens rather than a decorative
 * circle, so it can be read at a glance: type glyph and type word, identifier,
 * the record name in prose, a status chip with its own icon and Title Case
 * label, and one reading that always says what it counts.
 *
 * Type is carried by the silhouette (corner treatment plus the shape of the
 * glyph plate) and by the type word. Status is carried by a glyph and a word.
 * Neither is ever carried by colour alone.
 *
 * The name is a real button, so tabbing reaches every node and Enter opens the
 * detail panel without a mouse. Buttons carry `nodrag` and `nopan` so pressing
 * one never turns into a drag of the node underneath.
 */

import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { NODE_HEIGHT, NODE_WIDTH, type NodeShape } from "@/components/canvas/layout";
import { Status, statusLabel } from "@/components/shell/status";
import { cn } from "@/lib/utils";

export type CanvasNodeData = {
  /** The plain-language name, read first. */
  label: string;
  /** The record identifier, read second. */
  identifier: string;
  typeLabel: string;
  icon: LucideIcon;
  shape: NodeShape;
  status: string | null;
  /** One reading that names what it counts, or null when there is none. */
  meta: string | null;
  /** True when this node is outside the highlighted network or the search hits. */
  dimmed: boolean;
  /**
   * Type colour key. A second channel only: the silhouette and the glyph
   * already say what this is, so a reader who cannot separate these hues loses
   * nothing. Drawn as a left edge, which is the one place on a dense card that
   * carries colour without competing with the text.
   */
  tone?: string;
  /** Which way edges leave the node, so the arrows match the placement. */
  orientation: "horizontal" | "vertical";
  collapsible: boolean;
  collapsed: boolean;
  /** How many records are folded away inside this one right now. */
  hiddenCount: number;
  onOpen: (id: string) => void;
  onFocusNode: (id: string) => void;
  onToggleCollapse: (id: string) => void;
};

export type CanvasNode = Node<CanvasNodeData, "record">;

const CORNER: Record<NodeShape["corner"], string> = {
  square: "rounded-none",
  small: "rounded-sd",
  large: "rounded-sd-lg",
  round: "rounded-[16px]",
};

const BADGE: Record<NodeShape["badge"], string> = {
  square: "rounded-none",
  circle: "rounded-full",
  diamond: "rounded-[2px] rotate-45",
};

/** Type colour, drawn as a left edge. Never the only carrier: see CanvasNodeData.tone. */
const TONE_EDGE: Record<string, string> = {
  goal: "var(--sd-type-goal)",
  milestone: "var(--sd-type-milestone)",
  module: "var(--sd-type-module)",
  feature: "var(--sd-type-feature)",
  workflow: "var(--sd-type-workflow)",
  task: "var(--sd-type-task)",
};

/** Plain words for the silhouette, so the shape is explained and not just seen. */
const SHAPE_WORDS: Record<NodeShape["corner"], string> = {
  square: "square cornered",
  small: "slightly rounded",
  large: "rounded",
  round: "fully rounded",
};

function RecordNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const Icon = data.icon;
  const horizontal = data.orientation === "horizontal";
  const state = statusLabel(data.status);

  const description = [
    `${data.typeLabel}, drawn as a ${SHAPE_WORDS[data.shape.corner]} node`,
    data.identifier,
    `Status ${state}`,
    data.meta,
    data.collapsed && data.hiddenCount > 0
      ? `${data.hiddenCount} records folded away inside it`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        // A four pixel edge in the type's hue. The card already says what it is
        // in the glyph, the silhouette and the type word, so this reads as a
        // faster sort rather than as the only signal.
        borderLeft: data.tone ? `4px solid ${TONE_EDGE[data.tone] ?? "transparent"}` : undefined,
      }}
      // A dimmed card is out of the selected network, and at 35 percent its
      // text no longer meets the contrast floor. It kept its button tabbable
      // and clickable, so the interface offered a control it had deliberately
      // made hard to read. The dim is the design; staying operable was not.
      // The full contrast copy of every record is in the list beside the canvas.
      inert={data.dimmed || undefined}
      aria-hidden={data.dimmed || undefined}
      className={cn(
        // No opacity transition. The dim applies to every card outside the hovered
        // network, so animating it means a cursor crossing the canvas restarts a
        // fade on every card it passes, and the overlapping fades read as flicker.
        "relative flex flex-col gap-1.5 bg-panel p-2.5",
        CORNER[data.shape.corner],
        data.shape.outline === "dashed" ? "border-2 border-dashed" : "border",
        selected ? "border-2 border-signal" : "border-rule",
        data.dimmed && "opacity-35",
      )}
    >
      <Handle
        type="target"
        position={horizontal ? Position.Left : Position.Top}
        isConnectable={false}
        style={{ width: 6, height: 6, border: "none", opacity: 0 }}
      />

      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 shrink-0 place-items-center border border-rule-strong bg-inset text-ink-2",
            BADGE[data.shape.badge],
          )}
        >
          <Icon
            className={cn("size-3", data.shape.badge === "diamond" && "-rotate-45")}
          />
        </span>
        <span className="truncate font-chassis text-label text-ink-3 uppercase">
          {data.typeLabel}
        </span>
        <span className="ml-auto shrink-0 truncate font-chassis text-chassis-sm text-ink-3">
          {data.identifier}
        </span>
      </div>

      <button
        type="button"
        onClick={() => data.onOpen(id)}
        onFocus={() => data.onFocusNode(id)}
        title={data.label}
        className="nodrag nopan rounded-sd text-left font-prose text-subtitle text-ink focus-ring hover:text-signal"
      >
        <span className="line-clamp-2">{data.label}</span>
        <span className="sr-only">. {description}. Open the detail panel.</span>
      </button>

      <div className="mt-auto flex min-w-0 items-center gap-1.5">
        <Status value={data.status} size="sm" />
        {data.meta ? (
          <span
            title={data.meta}
            className="truncate font-chassis text-chassis-sm text-ink-3"
          >
            {data.meta}
          </span>
        ) : null}
      </div>

      {data.collapsible ? (
        <button
          type="button"
          onClick={() => data.onToggleCollapse(id)}
          aria-expanded={!data.collapsed}
          aria-label={
            data.collapsed
              ? `Unfold ${data.label}. ${data.hiddenCount} records are folded away inside it.`
              : `Fold ${data.label} away, hiding the records inside it.`
          }
          className="nodrag nopan absolute top-1/2 -right-4 grid size-8 -translate-y-1/2 place-items-center rounded-sd border border-rule bg-panel-raised text-ink-2 transition-colors duration-[120ms] ease-sd focus-ring hover:bg-inset hover:text-ink"
        >
          {data.collapsed ? (
            <ChevronRight className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
      ) : null}

      <Handle
        type="source"
        position={horizontal ? Position.Right : Position.Bottom}
        isConnectable={false}
        style={{ width: 6, height: 6, border: "none", opacity: 0 }}
      />
    </div>
  );
}

/**
 * Every hover rebuilds the canvas node list, because dimming the records
 * outside the hovered network is derived state. That gives each node a new
 * `data` object even when nothing it renders has changed, and re-rendering
 * every card mid transition is what made hovering flicker. The comparison below
 * is by value, so only the cards whose appearance actually changed re-render.
 *
 * The callbacks and the icon are compared by reference on purpose: they are
 * already stable (useCallback in the canvas, module constants for the icons),
 * so a change in identity there is a real change worth re-rendering for.
 */
const MemoRecordNode = memo(RecordNode, (prev, next) => {
  if (prev.selected !== next.selected || prev.id !== next.id) return false;
  const a = prev.data;
  const b = next.data;
  return (
    a.label === b.label &&
    a.identifier === b.identifier &&
    a.typeLabel === b.typeLabel &&
    a.status === b.status &&
    a.meta === b.meta &&
    a.dimmed === b.dimmed &&
    a.orientation === b.orientation &&
    a.collapsible === b.collapsible &&
    a.collapsed === b.collapsed &&
    a.hiddenCount === b.hiddenCount &&
    a.icon === b.icon &&
    a.shape?.corner === b.shape?.corner &&
    a.shape?.badge === b.shape?.badge &&
    a.shape?.outline === b.shape?.outline &&
    a.onOpen === b.onOpen &&
    a.onFocusNode === b.onFocusNode &&
    a.onToggleCollapse === b.onToggleCollapse
  );
});

/** Stable across renders, as React Flow requires. */
export const NODE_TYPES = { record: MemoRecordNode };
