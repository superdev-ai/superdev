/**
 * The shared canvas shell for the entity diagram and the architecture maps.
 *
 * It owns everything the two have in common: dagre layout, saved positions,
 * pan and zoom, fit to view, the minimap, hover and selection network
 * highlighting, click-empty-space to deselect, and the rule that a canvas with
 * nothing to draw shows an explanation rather than an empty grey rectangle.
 *
 * It deliberately does not own node appearance. Each view passes its own node
 * components, because an entity node lists fields and a runtime node does not.
 *
 * Keyboard: every canvas here is paired in its view with a list of the same
 * records, which is the keyboard and screen reader route to the same detail.
 * Canvas nodes are focusable too, so a keyboard user who lands in the canvas is
 * not trapped in a region they cannot operate.
 */

import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import dagre from "dagre";
import { useCallback, useEffect, useMemo } from "react";
import type * as React from "react";

import { Empty } from "@/components/shell/states";
import type { LayoutPosition } from "@/types";
import { cn } from "@/lib/utils";

import "@xyflow/react/dist/style.css";

/** Everything outside the focused network drops to this, per section 8. */
const DIMMED = 0.35;

/**
 * Position nodes with dagre, then let any saved position win.
 *
 * Each node must carry `width` and `height`, because dagre cannot measure a
 * React component and a graph laid out from guessed sizes overlaps.
 */
function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: {
    direction?: "LR" | "TB";
    nodeSeparation?: number;
    rankSeparation?: number;
    saved?: LayoutPosition[];
  } = {},
): Node[] {
  const {
    direction = "LR",
    nodeSeparation = 40,
    rankSeparation = 96,
    saved,
  } = options;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: nodeSeparation,
    ranksep: rankSeparation,
    marginx: 24,
    marginy: 24,
  });

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.width ?? 220,
      height: node.height ?? 80,
    });
  }
  for (const edge of edges) {
    // An edge pointing at something the current filter removed would make dagre
    // invent a phantom node, so only keep edges whose ends are both on screen.
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  const savedById = new Map((saved ?? []).map((item) => [item.id, item]));

  return nodes.map((node) => {
    const placed = graph.node(node.id);
    const manual = savedById.get(node.id);
    const width = node.width ?? 220;
    const height = node.height ?? 80;
    const position = manual
      ? { x: manual.x, y: manual.y }
      : {
          x: (placed?.x ?? 0) - width / 2,
          y: (placed?.y ?? 0) - height / 2,
        };
    return { ...node, position };
  });
}

export interface GraphCanvasProps {
  /** Nodes without positions. Memoize this: it drives the layout. */
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  direction?: "LR" | "TB";
  /**
   * Distance between ranks. Wide nodes with labelled edges need more than the
   * default, or the label lands under the node it points at.
   */
  rankSeparation?: number;
  /** Positions recorded for this project, which win over the automatic layout. */
  saved?: LayoutPosition[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Double click. Falls back to selecting when a view has nothing to open. */
  onOpen?: (id: string) => void;
  /** Describes the picture for anyone who cannot see it. */
  label: string;
  /** Shown in place of the canvas when there is nothing to draw. */
  emptyTitle: string;
  emptyExplanation: React.ReactNode;
  className?: string;
}

export function GraphCanvas({
  nodes,
  edges,
  nodeTypes,
  direction = "LR",
  rankSeparation = 96,
  saved,
  selectedId = null,
  onSelect,
  onOpen,
  label,
  emptyTitle,
  emptyExplanation,
  className,
}: GraphCanvasProps) {
  const positioned = useMemo(
    () => layoutGraph(nodes, edges, { direction, rankSeparation, saved }),
    [nodes, edges, direction, rankSeparation, saved],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(positioned);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => setFlowNodes(positioned), [positioned, setFlowNodes]);
  useEffect(() => setFlowEdges(edges), [edges, setFlowEdges]);

  /** The node whose network is emphasised: hover wins over selection. */
  /**
   * Selection, not the pointer, drives the highlighted network. Hover drove it
   * before, and dimming the whole diagram on hover made the graph library
   * rebuild its nodes mid pointer-interaction, so a card kept dropping and
   * recatching the cursor. Clicking is deliberate and stable.
   */
  const focusId = selectedId;

  const network = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    for (const edge of edges) {
      if (edge.source === focusId) ids.add(edge.target);
      if (edge.target === focusId) ids.add(edge.source);
    }
    return ids;
  }, [focusId, edges]);

  const shownNodes = useMemo(
    () =>
      flowNodes.map((node) => ({
        ...node,
        selected: node.id === selectedId,
        style: {
          ...node.style,
          opacity: network && !network.has(node.id) ? DIMMED : 1,
        },
      })),
    [flowNodes, network, selectedId],
  );

  const shownEdges = useMemo(
    () =>
      flowEdges.map((edge) => {
        const inNetwork =
          !network || (network.has(edge.source) && network.has(edge.target));
        return {
          ...edge,
          style: { ...edge.style, opacity: inNetwork ? 1 : DIMMED },
        };
      }),
    [flowEdges, network],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => onSelect?.(node.id),
    [onSelect],
  );
  /** Double click opens the record, matching every other canvas. */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => (onOpen ?? onSelect)?.(node.id),
    [onOpen, onSelect],
  );
  const onPaneClick = useCallback(() => onSelect?.(null), [onSelect]);

  if (nodes.length === 0) {
    return (
      <Empty
        title={emptyTitle}
        explanation={emptyExplanation}
        className={className}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "h-[clamp(360px,58vh,720px)] w-full overflow-hidden rounded-sd-lg border border-rule bg-inset",
        // The xyflow chrome is repainted in the project palette; its own light
        // grey would read as a foreign control on a warm carbon panel.
        "[&_.react-flow__controls]:overflow-hidden [&_.react-flow__controls]:rounded-sd [&_.react-flow__controls]:border [&_.react-flow__controls]:border-rule [&_.react-flow__controls]:shadow-none",
        "[&_.react-flow__controls-button]:size-8 [&_.react-flow__controls-button]:border-b [&_.react-flow__controls-button]:border-rule [&_.react-flow__controls-button]:bg-panel-raised [&_.react-flow__controls-button]:fill-current [&_.react-flow__controls-button]:text-ink-2 [&_.react-flow__controls-button:hover]:bg-inset [&_.react-flow__controls-button:hover]:text-ink",
        "[&_.react-flow__attribution]:bg-transparent [&_.react-flow__attribution_a]:font-chassis [&_.react-flow__attribution_a]:text-[10px] [&_.react-flow__attribution_a]:text-ink-3",
        "[&_.react-flow__node]:cursor-pointer [&_.react-flow__node:focus-visible]:outline-2 [&_.react-flow__node:focus-visible]:outline-offset-2 [&_.react-flow__node:focus-visible]:outline-signal",
        "[&_.react-flow__edge-text]:font-chassis [&_.react-flow__edge-text]:text-[10px]",
        className,
      )}
    >
      <ReactFlow
        nodes={shownNodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodesConnectable={false}
        edgesFocusable={false}
        elevateNodesOnSelect
        fitView
        // Never zoom past natural size on the first fit: a three node graph
        // blown up to 175 percent reads as a mistake, not as emphasis.
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.75}
        // The canvas is full width in the content column, so a reader scrolling the

        // page has nowhere to aim past it: wheeling over it used to swallow the

        // scroll and zoom instead. Zoom stays on the controls, which are visible.

        zoomOnScroll={false}

        preventScrolling={false}

        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--sd-rule-strong)"
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
          aria-label="Zoom and fit the diagram"
        />
        <MiniMap
          pannable
          zoomable
          className="hidden rounded-sd border border-rule md:block"
          style={{ width: 148, height: 104 }}
          ariaLabel="Small map of the whole diagram"
          bgColor="var(--sd-panel-raised)"
          maskColor="oklch(0 0 0 / 0.22)"
          nodeColor="var(--sd-rule-strong)"
          nodeStrokeColor="var(--sd-ink-3)"
        />
      </ReactFlow>
    </div>
  );
}

/**
 * Past this an edge label is wider than the gap between two ranks, and the
 * nodes draw over it. Keep labels short at the source; this is the backstop.
 */
const MAX_EDGE_LABEL = 32;

/**
 * The one edge style used by both canvases, so an unlabelled line never
 * appears: a relationship the reader cannot name is not documentation.
 *
 * A long label is cut here rather than allowed to run under the nodes. The
 * full text is always in the table the view renders beside the canvas, which is
 * the authoritative reading.
 */
export function labelledEdge(edge: {
  id: string;
  source: string;
  target: string;
  label: string;
  emphasis?: boolean;
  dashed?: boolean;
  colorVar?: string;
}): Edge {
  const color = edge.colorVar ?? "var(--sd-rule-strong)";
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label:
      edge.label.length > MAX_EDGE_LABEL
        ? `${edge.label.slice(0, MAX_EDGE_LABEL - 3).trimEnd()}...`
        : edge.label,
    labelShowBg: true,
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 3,
    labelStyle: {
      fill: "var(--sd-ink-2)",
      fontFamily: "var(--font-chassis)",
      fontSize: 10,
    },
    labelBgStyle: {
      fill: "var(--sd-panel)",
      stroke: "var(--sd-rule)",
      strokeWidth: 1,
    },
    style: {
      stroke: color,
      strokeWidth: edge.emphasis ? 2 : 1.5,
      strokeDasharray: edge.dashed ? "5 4" : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color,
    },
  };
}
