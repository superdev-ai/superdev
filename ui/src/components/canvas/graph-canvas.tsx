/**
 * The canvas both visual views are built from.
 *
 * A view hands over records and relations; everything a person can do to a
 * graph lives here, so the blueprint and the discovery map behave identically:
 * pan from empty space, zoom, fit, fullscreen, minimap, search, filters by
 * type, status and relationship, folding a record away, automatic layout,
 * manual movement with saved positions, selection network highlighting,
 * click empty space to deselect, deep links, keyboard operation
 * and a detail panel for every node.
 *
 * The index panel above the graph is not decoration: it is the keyboard and
 * screen reader equivalent of the canvas, listing the same records and opening
 * the same detail panel, as required by DESIGN_DIRECTION.md section 8. It sits
 * above rather than beside because width is the one dimension a graph cannot
 * spare.
 */

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import {
  ChevronRight,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Minimize2,
  Move3d,
  Scan,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type * as React from "react";

import {
  NODE_HEIGHT,
  NODE_WIDTH,
  automaticLayout,
  descendantsOf,
  positionsToLayout,
  savedPositionMap,
  type GraphRecord,
  type GraphRelation,
  type LayoutMode,
  type TypeStyle,
  type XY,
} from "@/components/canvas/layout";
import {
  NODE_TYPES,
  type CanvasNode,
  type CanvasNodeData,
} from "@/components/canvas/record-node";
// ponytail: useNarrow is generic plumbing that happens to live in the diagrams
// folder. Imported rather than copied; it travels with view-kit if that file's
// shared helpers are ever moved under components/shell.
import { useNarrow } from "@/components/diagrams/view-kit";
import { Empty, type StateAction } from "@/components/shell/states";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Status, statusLabel } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, postMutation } from "@/lib/api";
import { countPhrase, ofPhrase } from "@/lib/format";
import { currentRoute, replaceRoute, useRoute } from "@/lib/route";
import type { LayoutPosition } from "@/types";
import { cn } from "@/lib/utils";

/** What a view puts in the detail panel for one record. */
export interface CanvasDetail {
  /** Plain-language name, read first. */
  title: string;
  /** The record identifier, read second. */
  identifier: string;
  /** One sentence saying what this record is. */
  description?: React.ReactNode;
  body: React.ReactNode;
  footer?: React.ReactNode;
}

export interface GraphCanvasProps {
  /** Names the canvas, e.g. "Product blueprint". */
  label: string;
  /** One sentence saying how to work the canvas. */
  instructions: string;
  /** Memoise these in the view: a new array identity re-runs the layout. */
  records: GraphRecord[];
  relations: GraphRelation[];
  typeStyles: Record<string, TypeStyle>;
  mode: LayoutMode;
  /** Positions the service has stored for this canvas. */
  saved: LayoutPosition[];
  /** Scope name sent with the `layout.save` mutation. */
  layoutScope: string;
  /**
   * Builds the detail panel for one record. `open` moves the panel to another
   * record on the same canvas, so a person can walk the relationships without
   * losing their place.
   */
  renderDetail: (id: string, open: (id: string) => void) => CanvasDetail | null;
  /** Shown instead of the canvas when there is nothing at all to draw. */
  empty: {
    title: string;
    explanation: React.ReactNode;
    actions?: StateAction[];
  };
  /** What one node is, in plain language. */
  unit?: { singular: string; plural: string };
  className?: string;
}

const FALLBACK_STYLE: TypeStyle = {
  label: "Record",
  icon: Move3d,
  shape: { corner: "large", badge: "square", outline: "solid" },
  description: "A record of a kind this canvas does not have a name for yet.",
};

const PAN_STEP = 96;

/**
 * Edge colour per relationship kind, used only inside a selected node's own
 * network. The kind is also written on the edge label, so this is a second
 * reading rather than the only one.
 */
const RELATION_STROKE: Record<string, string> = {
  contains: "var(--sd-type-module)",
  supports: "var(--sd-type-goal)",
  delivers: "var(--sd-type-task)",
  depends_on: "var(--sd-state-attention)",
  enables: "var(--sd-type-workflow)",
};

interface FilterOption {
  value: string;
  label: string;
  count: number;
  icon?: TypeStyle["icon"];
}

function toggleOption(
  selected: string[],
  value: string,
  all: string[],
): string[] {
  const current = selected.length === 0 ? all : selected;
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return next.length === all.length ? [] : next;
}

function isOn(selected: string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

export function GraphCanvas(props: GraphCanvasProps) {
  if (props.records.length === 0) {
    return (
      <Empty
        title={props.empty.title}
        explanation={props.empty.explanation}
        actions={props.empty.actions}
        className={props.className}
      />
    );
  }
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  label,
  instructions,
  records,
  relations,
  typeStyles,
  mode,
  saved,
  layoutScope,
  renderDetail,
  unit = { singular: "record", plural: "records" },
  className,
}: GraphCanvasProps) {
  const { route } = useRoute();
  const flow = useReactFlow<CanvasNode, Edge>();
  const searchId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  /* A pinched graph on a phone is not a picture, it is a defect. Below the
     tablet breakpoint the record list is shown on its own instead. */
  const narrow = useNarrow();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [relationFilter, setRelationFilter] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [manual, setManual] = useState<Record<string, XY>>({});
  const [ignoreSaved, setIgnoreSaved] = useState(false);
  /* A shared link carries a record, so it opens straight into that record. */
  const [detailOpen, setDetailOpen] = useState(
    () => currentRoute().record !== null,
  );
  const [layoutNotice, setLayoutNotice] = useState<{
    tone: "active" | "complete" | "blocked";
    message: string;
  } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  /**
   * Both side panes fold away.
   *
   * The index and the detail are each useful and each cost width, which is the
   * one dimension a graph cannot spare. Rather than choose for the reader, both
   * fold, and the choice is remembered per canvas so a layout survives a reload.
   */
  /** Filters start folded: they are occasional, the record list is constant. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [indexOpen, setIndexOpen] = useState(
    () => window.localStorage.getItem(`superdev.canvas.index.${layoutScope}`) !== "closed",
  );
  const [detailPaneOpen, setDetailPaneOpen] = useState(
    () => window.localStorage.getItem(`superdev.canvas.detail.${layoutScope}`) !== "closed",
  );
  const rememberPane = (pane: "index" | "detail", open: boolean) => {
    try {
      window.localStorage.setItem(`superdev.canvas.${pane}.${layoutScope}`, open ? "open" : "closed");
    } catch {
      // Storage denied still gives a working canvas for this session.
    }
  };
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);

  const manualRef = useRef(manual);
  manualRef.current = manual;

  /* Reduced motion switches off every animated viewport move. */
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const duration = reducedMotion ? 0 : 200;

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === sectionRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const styleFor = useCallback(
    (typeKey: string) => typeStyles[typeKey] ?? FALLBACK_STYLE,
    [typeStyles],
  );

  /* ---- what is on screen ------------------------------------------------ */

  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);
  const foldedAway = useMemo(
    () => descendantsOf(records, collapsedSet),
    [records, collapsedSet],
  );
  const foldableIds = useMemo(() => {
    const parents = new Set<string>();
    for (const record of records) {
      if (record.parentId) parents.add(record.parentId);
    }
    return parents;
  }, [records]);

  const visibleRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          !foldedAway.has(record.id) &&
          isOn(typeFilter, record.typeKey) &&
          isOn(statusFilter, record.status ?? "unknown"),
      ),
    [records, foldedAway, typeFilter, statusFilter],
  );

  const visibleIds = useMemo(
    () => new Set(visibleRecords.map((record) => record.id)),
    [visibleRecords],
  );

  const visibleRelations = useMemo(
    () =>
      relations.filter(
        (relation) =>
          visibleIds.has(relation.from) &&
          visibleIds.has(relation.to) &&
          isOn(relationFilter, relation.kindKey),
      ),
    [relations, visibleIds, relationFilter],
  );

  /* ---- selection, highlighting and search ------------------------------- */

  const requestedId = route.record;
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === requestedId) ?? null,
    [records, requestedId],
  );
  const selectedId = selectedRecord?.id ?? null;

  /**
   * The highlighted network follows SELECTION, not the pointer.
   *
   * Hover used to drive it, and dimming every card outside the network is a
   * change to the whole canvas. The graph library reacts to that by rebuilding
   * its nodes, which disturbed hit testing enough that the pointer fell through
   * to the pane behind the card it was over: the card lit, dropped the pointer,
   * unlit, and caught it again. Clicking is a deliberate act, so the same
   * highlight is stable, and nothing is lost because the network was never
   * readable while the cursor was still moving.
   */
  const focusId = selectedId;
  /** Everything one hop from a record: used for both cues below. */
  const networkAround = useCallback(
    (id: string | null) => {
      if (!id || !visibleIds.has(id)) return null;
      const set = new Set<string>([id]);
      for (const relation of visibleRelations) {
        if (relation.from === id) set.add(relation.to);
        if (relation.to === id) set.add(relation.from);
      }
      return set;
    },
    [visibleIds, visibleRelations],
  );

  /**
   * Hover wins over selection, so moving the cursor explores the map without
   * losing what is selected.
   *
   * The dim is instantaneous by design. It used to carry an opacity transition,
   * and because the dim covers every card outside the network, a cursor moving
   * across the canvas restarted that fade on every card it passed. Overlapping
   * fades are what read as flickering. Changing opacity with no transition is
   * both calmer and more responsive.
   */
  const network = useMemo(() => networkAround(focusId), [networkAround, focusId]);

  const trimmedQuery = query.trim();
  const matches = useMemo(() => {
    if (trimmedQuery.length === 0) return null;
    const needle = trimmedQuery.toLowerCase();
    const found = new Set<string>();
    for (const record of visibleRecords) {
      const haystack = [
        record.name,
        record.id,
        record.summary,
        record.meta,
        record.searchText,
        styleFor(record.typeKey).label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(needle)) found.add(record.id);
    }
    return found;
  }, [trimmedQuery, visibleRecords, styleFor]);

  const listedRecords = useMemo(
    () =>
      matches
        ? visibleRecords.filter((record) => matches.has(record.id))
        : visibleRecords,
    [visibleRecords, matches],
  );

  /* ---- positions -------------------------------------------------------- */

  /**
   * The view declares how this canvas reads by default. A person can ask for
   * the other arrangement without leaving the page: grouped by kind, or placed
   * by what connects to what, which is how the entity diagram reads.
   */
  const [layoutChoice, setLayoutChoice] = useState<LayoutMode | null>(null);
  const activeMode = layoutChoice ?? mode;
  const auto = useMemo(
    () => automaticLayout(records, relations, activeMode),
    [records, relations, activeMode],
  );
  const savedMap = useMemo(() => savedPositionMap(saved), [saved]);
  const positions = useMemo(
    () => ({ ...auto, ...(ignoreSaved ? {} : savedMap), ...manual }),
    [auto, savedMap, manual, ignoreSaved],
  );
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const layoutTypeOf = useCallback(
    (id: string) => {
      const record = records.find((entry) => entry.id === id);
      return record ? (record.layoutType ?? record.typeKey) : null;
    },
    [records],
  );

  const persistLayout = useCallback(
    async (next: Record<string, XY>) => {
      setLayoutNotice({ tone: "active", message: "Saving the layout" });
      try {
        await postMutation("layout.save", {
          // The mutation calls this canvas, and validates it against a fixed
          // list. Sending scope meant every save was refused on arrival.
          canvas: layoutScope,
          positions: positionsToLayout(next, layoutTypeOf),
        });
        setLayoutNotice({
          tone: "complete",
          message: "Layout saved, so it opens this way next time",
        });
      } catch (error) {
        setLayoutNotice({
          tone: "blocked",
          message:
            error instanceof ApiError
              ? `The layout was not saved. ${error.message}`
              : "The layout was not saved because the local service did not answer. The nodes stay where you put them until this page is reloaded. Move a node again to retry.",
        });
      }
    },
    [layoutScope],
  );

  /* ---- actions ---------------------------------------------------------- */

  const routeView = route.view;
  const select = useCallback(
    (id: string | null) => replaceRoute(routeView, id),
    [routeView],
  );

  const openRecord = useCallback(
    (id: string) => {
      // The detail panel is portalled to the document body, and the browser
      // paints nothing outside the fullscreen element, so staying fullscreen
      // here would open a panel nobody can see.
      if (document.fullscreenElement) void document.exitFullscreen();
      select(id);
      setDetailOpen(true);
    },
    [select],
  );

  const centreOn = useCallback(
    (id: string) => {
      const point = positionsRef.current[id];
      if (!point) return;
      flow.setCenter(point.x + NODE_WIDTH / 2, point.y + NODE_HEIGHT / 2, {
        zoom: flow.getViewport().zoom,
        duration,
      });
    },
    [flow, duration],
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    let next: Record<string, XY> | null = null;
    for (const change of changes) {
      if (change.type !== "position" || !change.position) continue;
      // Only a real drag may move a node.
      //
      // The graph library also emits position changes when the nodes prop
      // changes identity, which happens on every hover because dimming the
      // records outside the hovered network is derived state. Recording those
      // as manual positions closed a loop: hover produced a new nodes array,
      // that produced a position change, that wrote state, that produced a new
      // nodes array. The cards visibly jittered and the pointer kept falling
      // through to the pane behind them, which is what read as flickering.
      if (!change.dragging) continue;
      next = next ?? { ...manualRef.current };
      next[change.id] = { x: change.position.x, y: change.position.y };
    }
    if (!next) return;
    manualRef.current = next;
    setManual(next);
  }, []);

  const resetLayout = useCallback(() => {
    manualRef.current = {};
    setManual({});
    setIgnoreSaved(true);
    setLayoutChoice(null);
    void persistLayout({});
    window.setTimeout(() => void flow.fitView({ duration, padding: 0.2 }), 0);
  }, [persistLayout, flow, duration]);

  /**
   * Re-place everything by its connections rather than by its kind. Manual
   * positions are dropped, because keeping them would leave half the graph in
   * the old arrangement and the result would read as neither.
   */
  const relayoutByConnections = useCallback(() => {
    const next = activeMode === "network" ? "tiers" : "network";
    manualRef.current = {};
    setManual({});
    setIgnoreSaved(true);
    setLayoutChoice(next);
    void persistLayout({});
    window.setTimeout(() => void flow.fitView({ duration, padding: 0.2 }), 0);
  }, [activeMode, persistLayout, flow, duration]);

  const toggleFullscreen = useCallback(() => {
    setFullscreenNotice(null);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const element = sectionRef.current;
    if (!element || typeof element.requestFullscreen !== "function") {
      setFullscreenNotice(
        "This browser would not hand over the whole screen. Use the browser's own fullscreen control instead.",
      );
      return;
    }
    element.requestFullscreen().catch(() => {
      setFullscreenNotice(
        "This browser refused to hand over the whole screen. Use the browser's own fullscreen control instead.",
      );
    });
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const step = event.shiftKey ? PAN_STEP * 3 : PAN_STEP;
      const viewport = flow.getViewport();
      switch (event.key) {
        case "ArrowLeft":
          flow.setViewport({ ...viewport, x: viewport.x + step }, { duration });
          break;
        case "ArrowRight":
          flow.setViewport({ ...viewport, x: viewport.x - step }, { duration });
          break;
        case "ArrowUp":
          flow.setViewport({ ...viewport, y: viewport.y + step }, { duration });
          break;
        case "ArrowDown":
          flow.setViewport({ ...viewport, y: viewport.y - step }, { duration });
          break;
        case "+":
        case "=":
          void flow.zoomIn({ duration });
          break;
        case "-":
        case "_":
          void flow.zoomOut({ duration });
          break;
        case "0":
          void flow.fitView({ duration, padding: 0.2 });
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [flow, duration],
  );

  /* ---- nodes and edges -------------------------------------------------- */

  const foldedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of collapsedSet) {
      counts.set(id, descendantsOf(records, [id]).size);
    }
    return counts;
  }, [records, collapsedSet]);

  const nodes = useMemo<CanvasNode[]>(
    () =>
      visibleRecords.map((record) => {
        const style = styleFor(record.typeKey);
        const data: CanvasNodeData = {
          label: record.name,
          identifier: record.id,
          typeLabel: style.label,
          icon: style.icon,
          shape: style.shape,
          status: record.status,
          tone: style.tone,
          meta: record.meta ?? null,
          dimmed:
            (network !== null && !network.has(record.id)) ||
            (matches !== null && !matches.has(record.id)),
          orientation: mode === "tiers" ? "horizontal" : "vertical",
          collapsible: foldableIds.has(record.id),
          collapsed: collapsedSet.has(record.id),
          hiddenCount: foldedCounts.get(record.id) ?? 0,
          onOpen: openRecord,
          onFocusNode: centreOn,
          onToggleCollapse: toggleCollapse,
        };
        return {
          id: record.id,
          type: "record",
          position: positions[record.id] ?? { x: 0, y: 0 },
          // The minimap draws from node dimensions, and without these it drew
          // an empty bordered box that promised an overview of the graph. The
          // layout already lays out at exactly this size.
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          selected: record.id === selectedId,
          sourcePosition: mode === "tiers" ? Position.Right : Position.Bottom,
          targetPosition: mode === "tiers" ? Position.Left : Position.Top,
          data,
        };
      }),
    [
      visibleRecords,
      styleFor,
      network,
      matches,
      mode,
      foldableIds,
      collapsedSet,
      foldedCounts,
      openRecord,
      centreOn,
      toggleCollapse,
      positions,
      selectedId,
    ],
  );

  const edges = useMemo<Edge[]>(
    () =>
      visibleRelations.map((relation) => {
        const inNetwork =
          focusId !== null &&
          (relation.from === focusId || relation.to === focusId);
        // Only selection washes the rest back; hover just lights its own.
        const lit =
          network === null ||
          (network.has(relation.from) && network.has(relation.to));
        // A selected node's own connections are drawn in the colour of the
        // relationship, so "contains" and "supports" are told apart at a glance
        // rather than by reading every label. Everything else stays the neutral
        // hairline, because colouring all of them would be colouring none.
        const stroke = inNetwork
          ? (RELATION_STROKE[relation.kindKey] ?? "var(--sd-signal)")
          : "var(--sd-rule-strong)";
        return {
          id: relation.id,
          source: relation.from,
          target: relation.to,
          // Orthogonal routing, the same as the entity diagram. A bezier
          // between two cards several hundred pixels apart sweeps across the
          // ones between them; a stepped line stays in the gaps.
          type: "smoothstep",
          label: relation.hierarchy ? undefined : relation.kindLabel,
          focusable: false,
          zIndex: inNetwork ? 2 : 1,
          // Motion only on the selected node's own edges, and only that far.
          // It carries direction, which is the question being asked: the dashes
          // travel from source to target so "what does this feed" is answered
          // without reading an arrowhead. Animating all of them would be
          // decoration, which section 6 of DESIGN_DIRECTION.md rules out, and
          // it would animate over a hundred paths at once.
          animated: inNetwork && !reducedMotion,
          style: {
            stroke,
            strokeWidth: inNetwork ? 2 : 1.5,
            strokeDasharray: relation.hierarchy ? undefined : "5 4",
            opacity: lit ? 1 : 0.35,
          },
          labelShowBg: true,
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 3,
          labelStyle: {
            fill: "var(--sd-ink-2)",
            fontFamily: "var(--font-chassis)",
            fontSize: 11,
            letterSpacing: "0.02em",
            // The path dimmed and its label did not, so a dimmed edge still
            // announced itself at full strength, which is the opposite of what
            // dimming is for.
            opacity: lit ? 1 : 0.35,
          },
          labelBgStyle: { fill: "var(--sd-panel)", opacity: lit ? 1 : 0.35 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: stroke,
          },
          ariaLabel: `${relation.kindLabel}: ${relation.from} to ${relation.to}`,
        };
      }),
    [visibleRelations, focusId, network],
  );

  /* ---- filter options --------------------------------------------------- */

  const typeOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      counts.set(record.typeKey, (counts.get(record.typeKey) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({
      value,
      count,
      label: styleFor(value).label,
      icon: styleFor(value).icon,
    }));
  }, [records, styleFor]);

  const statusOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      const key = record.status ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({
      value,
      count,
      label: statusLabel(value),
    }));
  }, [records]);

  const relationOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const relation of relations) {
      const entry = counts.get(relation.kindKey);
      if (entry) entry.count += 1;
      else counts.set(relation.kindKey, { label: relation.kindLabel, count: 1 });
    }
    return [...counts.entries()].map(([value, entry]) => ({
      value,
      label: entry.label,
      count: entry.count,
    }));
  }, [relations]);

  const filtersActive =
    typeFilter.length > 0 ||
    statusFilter.length > 0 ||
    relationFilter.length > 0 ||
    collapsed.length > 0;

  /**
   * How many filter groups are narrowing the canvas. Shown on the folded
   * summary, so a filter can never be quietly in force behind a closed panel.
   * An empty selection in a group means everything in it is shown.
   */
  const activeFilterCount =
    (typeFilter.length > 0 ? 1 : 0) +
    (statusFilter.length > 0 ? 1 : 0) +
    (relationFilter.length > 0 ? 1 : 0);

  const clearFilters = useCallback(() => {
    setTypeFilter([]);
    setStatusFilter([]);
    setRelationFilter([]);
    setCollapsed([]);
    setQuery("");
  }, []);

  /* ---- detail panel ----------------------------------------------------- */

  const detail = selectedId ? renderDetail(selectedId, openRecord) : null;

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={cn(
        // Three panes on a wide screen: the index, the graph, the detail. Both
        // side panes fold, so the width they cost is the reader's choice rather
        // than a fixed tax. Below the tablet breakpoint it stacks, because
        // three columns on a phone is none.
        "flex flex-col overflow-hidden border border-rule bg-panel lg:flex-row",
        fullscreen
          ? "h-dvh w-dvw rounded-none"
          : // With no canvas to hold open, a fixed viewport height would trap
            // the record list in a short inner scroller. The phone scrolls the
            // page instead, which is what a phone expects.
            narrow
            ? "rounded-sd-lg"
            : "h-[74vh] min-h-[540px] rounded-sd-lg",
        className,
      )}
    >
      <aside
        aria-label={`${label}: search, filters and the full ${unit.singular} list`}
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border-rule",
          indexOpen
            ? "lg:w-72 lg:shrink-0 lg:border-r lg:border-b-0"
            : "lg:hidden",
          // On a phone the list is the whole surface. Beside the canvas it takes
          // the section's full height, so its inner scroller has room to be a
          // scroller. The 19rem cap here was left over from when this sat above
          // the canvas: in a row it squeezed the list into a sixteen pixel
          // window holding five thousand pixels of records, and that overflow
          // grew the page by nearly five thousand pixels of nothing.
          narrow
            ? "max-h-none min-w-0 flex-1 border-b"
            : "lg:h-auto lg:max-h-none",
        )}
      >
        <div className="flex flex-col gap-3 border-b border-rule p-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={searchId}
              className="font-chassis text-label text-ink-3 uppercase"
            >
              Search
            </label>
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, identifier or purpose"
              aria-describedby={`${searchId}-count`}
            />
            <p
              id={`${searchId}-count`}
              className="font-chassis text-chassis-sm text-ink-3"
            >
              {trimmedQuery
                ? `${ofPhrase(listedRecords.length, visibleRecords.length, unit.singular, `match "${trimmedQuery}"`)}. Everything else on the canvas is dimmed.`
                : `${ofPhrase(visibleRecords.length, records.length, unit.singular, "on the canvas")}${
                    foldedAway.size > 0
                      ? `, and ${countPhrase(foldedAway.size, unit.singular)} folded away inside a collapsed one`
                      : ""
                  }.`}
            </p>
          </div>

          {/* Filters fold away by default. They are occasional and the record
              list is constant, and on a short pane the three groups were taking
              362 pixels of 570 and leaving the list 208. The summary says how
              many are narrowing the canvas right now, so a filter can never be
              silently in force behind a closed panel. */}
          <details
            open={filtersOpen}
            onToggle={(event) => setFiltersOpen((event.target as HTMLDetailsElement).open)}
            className="min-w-0"
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sd py-1 font-chassis text-label text-ink-3 uppercase focus-ring hover:text-ink">
              <ChevronRight
                aria-hidden="true"
                className={cn("size-3 shrink-0 transition-transform duration-[120ms] ease-sd", filtersOpen && "rotate-90")}
              />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-auto rounded-sd-sm border border-signal-edge bg-signal-wash px-1 text-signal normal-case">
                  {countPhrase(activeFilterCount, "filter")} on
                </span>
              ) : null}
            </summary>

            <div className="flex flex-col gap-2 pt-2">
          <FilterChips
            legend="Record type"
            options={typeOptions}
            selected={typeFilter}
            onChange={setTypeFilter}
            unit={unit}
          />
          <FilterChips
            legend="Status"
            options={statusOptions}
            selected={statusFilter}
            onChange={setStatusFilter}
            unit={unit}
          />
          {relationOptions.length > 0 ? (
            <FilterChips
              legend="Relationship"
              options={relationOptions}
              selected={relationFilter}
              onChange={setRelationFilter}
              unit={{ singular: "line", plural: "lines" }}
            />
          ) : null}

          {filtersActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="self-start"
            >
              Show everything again
            </Button>
          ) : null}
            </div>
          </details>
        </div>

        <div
          className={cn(
            // relative is load bearing. Every row carries an sr-only span, and
            // sr-only is position absolute. An absolutely positioned descendant
            // is only clipped by an ancestor's overflow when that ancestor is
            // its containing block, so with this div static the spans escaped
            // the scroller entirely and stretched the document by 4600px of
            // nothing. Making it a containing block clips them with the rest.
            "relative min-h-0 flex-1 p-2",
            narrow ? "overflow-visible" : "overflow-y-auto",
          )}
        >
          {listedRecords.length === 0 ? (
            <Empty
              density="inline"
              title="Nothing is left to show"
              explanation={
                trimmedQuery
                  ? `Nothing on this canvas matches "${trimmedQuery}" with the current filters. Try a shorter word, or show everything again.`
                  : "The current filters hide every record on this canvas. Turn a type, a status or a relationship back on to see them."
              }
              actions={[
                { label: "Show everything again", onClick: clearFilters },
              ]}
            />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {listedRecords.map((record) => {
                const style = styleFor(record.typeKey);
                const Icon = style.icon;
                const active = record.id === selectedId;
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      onClick={() => select(record.id)}
                      onDoubleClick={() => openRecord(record.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-sd px-2 py-1.5 text-left transition-colors duration-[120ms] ease-sd focus-ring",
                        active
                          ? "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]"
                          : "hover:bg-inset",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-ink-3"
                        />
                        <span className="truncate font-prose text-small text-ink">
                          {record.name}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-5">
                        <span className="font-chassis text-chassis-sm text-ink-3">
                          {style.label} {record.id}
                        </span>
                        <Status
                          value={record.status}
                          size="sm"
                          variant="inline"
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {narrow ? (
        <p className="shrink-0 border-t border-rule bg-inset px-3 py-2.5 font-prose text-small text-ink-2">
          The map is not drawn at this width, because a graph of{" "}
          {countPhrase(records.length, unit.singular)} cannot be read on a screen
          this narrow. Everything on it is in the list above, with the same
          search and the same filters, and choosing a name opens the same
          detail. Open this page on a wider screen to see the map itself.
        </p>
      ) : (
      <div
        className="relative min-h-0 min-w-0 flex-1 focus-ring"
        onKeyDown={onKeyDown}
        role="region"
        tabIndex={0}
        aria-label={`${label} canvas. ${instructions} Use the arrow keys to pan, plus and minus to zoom, and 0 to fit everything on screen. Every node can also be reached from the ${unit.singular} list beside the canvas.`}
      >
        <ReactFlow<CanvasNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={() => void persistLayout(manualRef.current)}
          onNodeClick={(_event, node) => select(node.id)}
          onNodeDoubleClick={(_event, node) => openRecord(node.id)}
          onPaneClick={() => {
            select(null);
            setDetailOpen(false);
          }}
          nodesDraggable
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          disableKeyboardA11y
          deleteKeyCode={null}
          nodeDragThreshold={2}
          minZoom={0.1}
          maxZoom={2}
          fitView
          fitViewOptions={{ padding: 0.2, duration: 0 }}
          // The canvas is full width in the content column, so a reader scrolling the

          // page has nowhere to aim past it: wheeling over it used to swallow the

          // scroll and zoom instead. Zoom stays on the controls, which are visible.

          zoomOnScroll={false}

          preventScrolling={false}

          proOptions={{ hideAttribution: true }}
          className="bg-inset"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="var(--sd-rule-strong)"
            bgColor="var(--sd-inset)"
          />
          <MiniMap
            pannable
            zoomable
            ariaLabel="Small map of the whole canvas. Drag inside it to move the view."
            bgColor="var(--sd-panel)"
            nodeColor="var(--sd-rule-strong)"
            nodeStrokeColor="var(--sd-rule-strong)"
            nodeBorderRadius={3}
            maskColor="transparent"
            maskStrokeColor="var(--sd-signal)"
            maskStrokeWidth={3}
            // Inline, because React Flow's own stylesheet sets these and the
            // order the two stylesheets land in is not ours to rely on.
            style={{
              margin: 8,
              border: "1px solid var(--sd-rule)",
              borderRadius: "var(--radius-sd)",
            }}
          />
          {/* A folded pane has to be reachable, or folding it is losing it. */}
          <Panel position="top-left" style={{ margin: 8 }}>
            <div className="hidden items-center gap-1 rounded-sd border border-rule bg-panel-raised p-1 lg:flex">
              {!indexOpen ? (
                <CanvasButton
                  label={`Show the ${unit.singular} list`}
                  icon={PanelLeftOpen}
                  onClick={() => { setIndexOpen(true); rememberPane("index", true); }}
                />
              ) : (
                <CanvasButton
                  label={`Hide the ${unit.singular} list`}
                  icon={PanelLeftClose}
                  onClick={() => { setIndexOpen(false); rememberPane("index", false); }}
                />
              )}
              {!detailPaneOpen ? (
                <CanvasButton
                  label="Show the detail pane"
                  icon={PanelRightOpen}
                  onClick={() => { setDetailPaneOpen(true); rememberPane("detail", true); }}
                />
              ) : null}
            </div>
          </Panel>

          <Panel position="top-right" style={{ margin: 8 }}>
            <div className="flex items-center gap-1 rounded-sd border border-rule bg-panel-raised p-1">
              <CanvasButton
                label="Zoom in"
                icon={ZoomIn}
                onClick={() => void flow.zoomIn({ duration })}
              />
              <CanvasButton
                label="Zoom out"
                icon={ZoomOut}
                onClick={() => void flow.zoomOut({ duration })}
              />
              <CanvasButton
                label="Fit everything on screen"
                icon={Scan}
                onClick={() => void flow.fitView({ duration, padding: 0.2 })}
              />
              <CanvasButton
                label={
                  activeMode === "network"
                    ? "Group the nodes by kind again"
                    : "Arrange the nodes by what connects to what, like the entity diagram"
                }
                icon={Waypoints}
                onClick={relayoutByConnections}
              />
              <CanvasButton
                label="Put every node back where the automatic layout wants it"
                icon={Move3d}
                onClick={resetLayout}
              />
              <CanvasButton
                label={fullscreen ? "Leave fullscreen" : "Fill the screen"}
                icon={fullscreen ? Minimize2 : Maximize2}
                onClick={toggleFullscreen}
              />
            </div>
          </Panel>
          <Panel
            position="bottom-left"
            style={{ margin: 8 }}
            className="max-w-[min(28rem,70vw)]"
          >
            <div className="flex flex-col gap-1">
              {layoutNotice ? (
                <p
                  role="status"
                  className={cn(
                    "rounded-sd border px-2 py-1 font-chassis text-chassis-sm",
                    layoutNotice.tone === "blocked"
                      ? "border-state-blocked/45 bg-state-blocked-wash text-state-blocked"
                      : layoutNotice.tone === "complete"
                        ? "border-state-complete/45 bg-state-complete-wash text-state-complete"
                        : "border-state-active/45 bg-state-active-wash text-state-active",
                  )}
                >
                  {layoutNotice.message}
                </p>
              ) : null}
              {fullscreenNotice ? (
                <p
                  role="status"
                  className="rounded-sd border border-state-attention/45 bg-state-attention-wash px-2 py-1 font-chassis text-chassis-sm text-state-attention"
                >
                  {fullscreenNotice}
                </p>
              ) : null}
            </div>
          </Panel>
        </ReactFlow>
      </div>
      )}

      {/* Wide: the detail is a third pane, so a record stays readable while the
          graph stays visible and the reader keeps their place. Narrow: it is a
          sheet, because a third column on a phone is no column at all. */}
      {!narrow && detailPaneOpen ? (
        <aside
          aria-label={`${label}: the selected ${unit.singular}`}
          className="hidden min-h-0 w-80 shrink-0 flex-col border-l border-rule lg:flex"
        >
          <div className="flex items-start justify-between gap-2 border-b border-rule p-3">
            <div className="min-w-0">
              <h3 className="truncate font-prose text-body text-ink">
                {detail ? detail.title : "Nothing selected"}
              </h3>
              <p className="truncate font-chassis text-chassis-sm text-ink-3">
                {detail ? detail.identifier : `Choose a ${unit.singular} to read it here`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDetailPaneOpen(false); rememberPane("detail", false); }}
              aria-label="Hide the detail pane"
            >
              Hide
            </Button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto p-3">
            {detail ? (
              detail.body
            ) : (
              <p className="font-prose text-small text-ink-3">
                Choose a node on the canvas, or a row in the list, and its full
                record appears here.
              </p>
            )}
          </div>
          {detail?.footer ? (
            <div className="border-t border-rule p-3">{detail.footer}</div>
          ) : null}
        </aside>
      ) : null}

      <Sheet
        open={detailOpen && narrow}
        onOpenChange={(open) => {
          if (!open) setDetailOpen(false);
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>
              {detail ? detail.title : "That record is not on this canvas"}
            </SheetTitle>
            <SheetDescription>
              {detail ? (
                <>
                  <span className="font-chassis text-chassis-sm text-ink-3">
                    {detail.identifier}
                  </span>
                  {detail.description ? <> {detail.description}</> : null}
                </>
              ) : (
                `The address bar points at ${requestedId ?? "a record"}, which is not among the ${countPhrase(records.length, unit.singular)} drawn here. It may have been cancelled, folded into another record, or it may belong to a different view.`
              )}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {detail ? (
              detail.body
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  select(null);
                  setDetailOpen(false);
                }}
              >
                Clear the selection
              </Button>
            )}
          </SheetBody>
          {detail?.footer ? <SheetFooter>{detail.footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

/**
 * One labelled reading inside a detail panel. The label is chassis, the value
 * is prose, so a person can tell a measurement from a sentence.
 */
export function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-rule py-2.5 last:border-b-0">
      <span className="font-chassis text-label text-ink-3 uppercase">
        {label}
      </span>
      <div className="font-prose text-body text-ink-2 prose-measure">
        {children}
      </div>
    </div>
  );
}

export interface DetailLinkItem {
  id: string;
  name: string;
  typeLabel: string;
  status: string | null;
  /** How this record relates to the one on screen, e.g. "Contains". */
  relationship?: string;
}

/**
 * Related records, as controls that move the panel rather than dead text. The
 * empty case says what would put something here instead of showing nothing.
 */
export function DetailLinks({
  items,
  onOpen,
  emptyText,
}: {
  items: DetailLinkItem[];
  onOpen: (id: string) => void;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="font-prose text-small text-ink-3">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={`${item.relationship ?? ""}-${item.id}`}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full flex-col gap-0.5 rounded-sd px-2 py-1.5 text-left transition-colors duration-[120ms] ease-sd focus-ring hover:bg-inset"
          >
            <span className="font-prose text-small text-ink">{item.name}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-chassis text-chassis-sm text-ink-3">
                {item.relationship ? `${item.relationship}: ` : ""}
                {item.typeLabel} {item.id}
              </span>
              <Status value={item.status} size="sm" variant="inline" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CanvasButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: TypeStyle["icon"];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 shrink-0 place-items-center rounded-sd text-ink-2 transition-colors duration-[120ms] ease-sd focus-ring hover:bg-inset hover:text-ink"
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

function FilterChips({
  legend,
  options,
  selected,
  onChange,
  unit,
}: {
  legend: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  unit: { singular: string; plural: string };
}) {
  if (options.length === 0) return null;
  const all = options.map((option) => option.value);

  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="font-chassis text-label text-ink-3 uppercase">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const on = isOn(selected, option.value);
          const Icon = option.icon;
          const counted = countPhrase(option.count, unit.singular, unit.plural);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleOption(selected, option.value, all))}
              title={`${option.label}: ${counted}. ${on ? "Shown. Activate to hide." : "Hidden. Activate to show."}`}
              aria-label={`${option.label}, ${counted}. ${on ? "Shown" : "Hidden"}.`}
              className={cn(
                // 24px is the floor, not a suggestion: this project's own
                // interface audit failed controls below it. Everything else
                // that was costing height, the extra vertical padding and the
                // 32px minimum, is gone, which gives the record list the room
                // the filters were holding.
                "inline-flex min-h-6 items-center gap-1 rounded-sd-sm border px-1.5 py-0 font-chassis text-chassis-sm leading-none transition-colors duration-[120ms] ease-sd focus-ring",
                on
                  ? "border-signal-edge bg-signal-wash text-ink"
                  : "border-rule bg-inset text-ink-3 line-through",
              )}
            >
              {Icon ? (
                <Icon aria-hidden="true" className="size-3 shrink-0" />
              ) : null}
              <span className="truncate">{option.label}</span>
              <span aria-hidden="true" className="tabular-nums text-ink-3">
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
