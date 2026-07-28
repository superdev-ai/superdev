/**
 * The workflow swimlane, drawn as SVG straight from the workflow data.
 *
 * One lane per actor, one column per step in sequence, so the reading order is
 * left to right and the owner of every step is the lane it sits in. The happy
 * path is the solid chain along the sequence. Failure, retry and alternate
 * branches are drawn with their own line style, their own glyph and their own
 * written label, so they are distinguishable without relying on colour, and a
 * branch that ends the workflow terminates at a marked stop rather than
 * trailing off the canvas.
 *
 * No diagram library is involved. A swimlane is a grid, and a grid is arithmetic.
 *
 * The actor column is ordinary HTML beside the scrolling SVG, so it stays put
 * while a long workflow scrolls sideways, and the steps table in the view is the
 * keyboard and screen reader route to everything drawn here.
 */

import { useId, useMemo } from "react";

import { statusLabel, statusTone, type StatusTone } from "@/components/shell/status";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Geometry
   --------------------------------------------------------------------------- */

const LANE_WIDTH = 156;
const LANE_HEIGHT = 116;
const RULER_HEIGHT = 26;
const COLUMN_WIDTH = 208;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 80;
const NODE_INSET = (LANE_HEIGHT - NODE_HEIGHT) / 2;
const RETURN_LANE_STEP = 24;
const END_BAND_HEIGHT = 76;
const GUTTER = 24;

/* ---------------------------------------------------------------------------
   The shape the view hands in
   --------------------------------------------------------------------------- */

export interface SwimlaneStep {
  id: string;
  /** Printed on the node, so a person can say "step 3" out loud. */
  ordinal: number;
  action: string;
  /** The lane this step belongs in: an actor, a system or a role. */
  actor: string;
  /** Stored status, mapped to a glyph and a Title Case label by the shared map. */
  status: string;
  /** Plain-language reading of the implementing work, already counted. */
  taskSummary: string;
}

export type BranchKind = "failure" | "retry" | "alternate" | "success";

export interface SwimlaneBranch {
  id: string;
  fromStepId: string;
  /** Null when the branch ends the workflow rather than rejoining it. */
  toStepId: string | null;
  /** Failure, Retry, Alternate Path or Success, in Title Case. */
  kindLabel: string;
  kind: BranchKind;
  condition: string;
}

export interface WorkflowSwimlaneProps {
  steps: SwimlaneStep[];
  branches: SwimlaneBranch[];
  /** Actors declared on the workflow that own no step still get a lane. */
  actors: string[];
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  /** Named in the accessible description of the picture. */
  workflowName: string;
  className?: string;
}

/* ---------------------------------------------------------------------------
   Branch styling. Three channels: dash pattern, written label, colour.
   --------------------------------------------------------------------------- */

const BRANCH_STYLES: Record<
  BranchKind,
  { dash: string; stroke: string; marker: string; description: string }
> = {
  success: {
    dash: "",
    stroke: "var(--sd-state-complete)",
    marker: "complete",
    description: "A solid line that leaves the sequence early on success",
  },
  alternate: {
    dash: "7 4",
    stroke: "var(--sd-state-active)",
    marker: "active",
    description: "A long dashed line for a conditional path",
  },
  retry: {
    dash: "2 3",
    stroke: "var(--sd-state-attention)",
    marker: "attention",
    description: "A dotted line looping back to an earlier step to try again",
  },
  failure: {
    dash: "6 5",
    stroke: "var(--sd-state-blocked)",
    marker: "blocked",
    description: "A dashed line to where the workflow goes when the step fails",
  },
};

const MARKER_COLORS: Record<string, string> = {
  happy: "var(--sd-rule-strong)",
  complete: "var(--sd-state-complete)",
  active: "var(--sd-state-active)",
  attention: "var(--sd-state-attention)",
  blocked: "var(--sd-state-blocked)",
};

/* ---------------------------------------------------------------------------
   Text
   --------------------------------------------------------------------------- */

/** Wrap on word boundaries, because SVG text does not wrap on its own. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}...` : word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    const consumed = lines.join(" ").length;
    if (consumed < text.length) {
      lines[maxLines - 1] =
        last.length > maxChars - 3 ? `${last.slice(0, maxChars - 3)}...` : `${last}...`;
    }
  }
  return lines.length > 0 ? lines : ["No action recorded"];
}

function shorten(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}...`;
}

/* ---------------------------------------------------------------------------
   Status glyph, so a state survives greyscale
   --------------------------------------------------------------------------- */

const GLYPH_CLASS: Record<StatusTone, string> = {
  complete: "stroke-state-complete",
  active: "stroke-state-active",
  attention: "stroke-state-attention",
  blocked: "stroke-state-blocked",
  idle: "stroke-state-idle",
  retired: "stroke-state-retired",
  unrecognized: "stroke-ink-3",
};

const TEXT_CLASS: Record<StatusTone, string> = {
  complete: "fill-state-complete",
  active: "fill-state-active",
  attention: "fill-state-attention",
  blocked: "fill-state-blocked",
  idle: "fill-state-idle",
  retired: "fill-state-retired",
  unrecognized: "fill-ink-3",
};

/** A distinct outline per tone: circle, dot, triangle, octagon, ring, box. */
function StatusGlyph({ tone, x, y }: { tone: StatusTone; x: number; y: number }) {
  const stroke = cn(GLYPH_CLASS[tone], "fill-none [stroke-width:1.4]");
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      {tone === "complete" ? (
        <>
          <circle cx="0" cy="0" r="5" className={stroke} />
          <polyline points="-2.4,0 -0.6,1.9 2.6,-2.2" className={stroke} />
        </>
      ) : null}
      {tone === "active" ? (
        <>
          <circle cx="0" cy="0" r="5" className={stroke} />
          <circle cx="0" cy="0" r="1.8" className={cn(GLYPH_CLASS[tone], "fill-current")} />
        </>
      ) : null}
      {tone === "attention" ? (
        <>
          <polygon points="0,-5.4 5.4,4.4 -5.4,4.4" className={stroke} />
          <line x1="0" y1="-1.6" x2="0" y2="1.4" className={stroke} />
          <line x1="0" y1="2.8" x2="0" y2="2.9" className={stroke} />
        </>
      ) : null}
      {tone === "blocked" ? (
        <>
          <polygon
            points="-2.1,-5.1 2.1,-5.1 5.1,-2.1 5.1,2.1 2.1,5.1 -2.1,5.1 -5.1,2.1 -5.1,-2.1"
            className={stroke}
          />
          <line x1="-2.2" y1="-2.2" x2="2.2" y2="2.2" className={stroke} />
          <line x1="2.2" y1="-2.2" x2="-2.2" y2="2.2" className={stroke} />
        </>
      ) : null}
      {tone === "idle" ? <circle cx="0" cy="0" r="5" className={stroke} /> : null}
      {tone === "retired" ? (
        <>
          <rect x="-5.2" y="-4.4" width="10.4" height="8.8" rx="1.4" className={stroke} />
          <line x1="-5.2" y1="-1.4" x2="5.2" y2="-1.4" className={stroke} />
        </>
      ) : null}
    </g>
  );
}

/* ---------------------------------------------------------------------------
   The diagram
   --------------------------------------------------------------------------- */

export function WorkflowSwimlane({
  steps,
  branches,
  actors,
  selectedStepId,
  onSelectStep,
  workflowName,
  className,
}: WorkflowSwimlaneProps) {
  const markerId = useId().replace(/:/g, "");

  const model = useMemo(() => {
    const lanes: string[] = [];
    for (const step of steps) {
      if (!lanes.includes(step.actor)) lanes.push(step.actor);
    }
    for (const actor of actors) {
      if (actor && !lanes.includes(actor)) lanes.push(actor);
    }
    if (lanes.length === 0) lanes.push("Owner not recorded");

    const column = new Map(steps.map((step, index) => [step.id, index]));
    const lane = new Map(steps.map((step) => [step.id, lanes.indexOf(step.actor)]));

    const rejoining = branches.filter((branch) => branch.toStepId !== null);
    const terminal = branches.filter((branch) => branch.toStepId === null);

    const backward = rejoining.filter(
      (branch) =>
        (column.get(branch.toStepId as string) ?? 0) <=
        (column.get(branch.fromStepId) ?? 0),
    );

    const returnBand =
      backward.length > 0 ? backward.length * RETURN_LANE_STEP + 14 : 0;
    const endBand = terminal.length > 0 ? END_BAND_HEIGHT : 0;

    const lanesBottom = RULER_HEIGHT + lanes.length * LANE_HEIGHT;

    return {
      lanes,
      column,
      lane,
      rejoining,
      terminal,
      backward,
      returnBand,
      endBand,
      lanesBottom,
      width: Math.max(
        COLUMN_WIDTH,
        steps.length * COLUMN_WIDTH + GUTTER,
      ),
      height: lanesBottom + returnBand + endBand,
    };
  }, [steps, branches, actors]);

  /** Everything outside the selected step's own connections drops back. */
  const network = useMemo(() => {
    if (!selectedStepId) return null;
    const ids = new Set<string>([selectedStepId]);
    const index = model.column.get(selectedStepId);
    if (index !== undefined) {
      if (steps[index - 1]) ids.add(steps[index - 1].id);
      if (steps[index + 1]) ids.add(steps[index + 1].id);
    }
    for (const branch of branches) {
      if (branch.fromStepId === selectedStepId && branch.toStepId) {
        ids.add(branch.toStepId);
      }
      if (branch.toStepId === selectedStepId) ids.add(branch.fromStepId);
    }
    return ids;
  }, [selectedStepId, model.column, steps, branches]);

  const nodeX = (index: number) =>
    index * COLUMN_WIDTH + (COLUMN_WIDTH - NODE_WIDTH) / 2;
  const nodeY = (laneIndex: number) =>
    RULER_HEIGHT + laneIndex * LANE_HEIGHT + NODE_INSET;

  const opacityFor = (id: string) => (network && !network.has(id) ? 0.35 : 1);

  const description = `Swimlane diagram of ${workflowName}. ${model.lanes.length} lanes, ${steps.length} steps in sequence, ${branches.length} branches. Every step is also listed in the steps table below this diagram.`;

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex min-w-0">
        {/* The actor column stays put while the sequence scrolls sideways. */}
        <div
          className="shrink-0 border-r border-rule-strong bg-panel-raised"
          style={{ width: LANE_WIDTH }}
          aria-hidden="true"
        >
          <div
            className="flex items-end border-b border-rule px-3 pb-1 font-chassis text-label text-ink-3 uppercase"
            style={{ height: RULER_HEIGHT }}
          >
            Actor
          </div>
          {model.lanes.map((actor) => (
            <div
              key={actor}
              className="flex flex-col justify-center gap-0.5 border-b border-rule px-3"
              style={{ height: LANE_HEIGHT }}
            >
              <span className="font-prose text-small leading-tight text-ink break-words">
                {actor}
              </span>
            </div>
          ))}
          {model.returnBand > 0 ? (
            <div
              className="flex items-center border-b border-rule px-3 font-chassis text-chassis-sm text-ink-3"
              style={{ height: model.returnBand }}
            >
              Return paths
            </div>
          ) : null}
          {model.endBand > 0 ? (
            <div
              className="flex items-center px-3 font-chassis text-chassis-sm text-ink-3"
              style={{ height: model.endBand }}
            >
              Ends here
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto bg-inset">
          <svg
            role="img"
            aria-label={description}
            width={model.width}
            height={model.height}
            viewBox={`0 0 ${model.width} ${model.height}`}
            style={{ minWidth: model.width }}
            className="block"
          >
            <title>{`Swimlane diagram of ${workflowName}`}</title>
            <desc>{description}</desc>

            <defs>
              {Object.entries(MARKER_COLORS).map(([name, color]) => (
                <marker
                  key={name}
                  id={`${markerId}-${name}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
              ))}
            </defs>

            {/* Lane bands. The alternating tone defines the lane, nothing else. */}
            {model.lanes.map((actor, index) => (
              <g key={actor}>
                <rect
                  x="0"
                  y={RULER_HEIGHT + index * LANE_HEIGHT}
                  width={model.width}
                  height={LANE_HEIGHT}
                  className={index % 2 === 0 ? "fill-panel" : "fill-inset"}
                />
                <line
                  x1="0"
                  y1={RULER_HEIGHT + (index + 1) * LANE_HEIGHT}
                  x2={model.width}
                  y2={RULER_HEIGHT + (index + 1) * LANE_HEIGHT}
                  className="stroke-rule"
                />
              </g>
            ))}

            {/* Column ruler, so the sequence is readable without the nodes. */}
            <line
              x1="0"
              y1={RULER_HEIGHT}
              x2={model.width}
              y2={RULER_HEIGHT}
              className="stroke-rule-strong"
            />
            {steps.map((step, index) => (
              <text
                key={`ruler-${step.id}`}
                x={nodeX(index)}
                y={RULER_HEIGHT - 9}
                className="fill-ink-3 font-chassis text-[10px] tracking-[0.09em] uppercase"
              >
                Step {step.ordinal}
              </text>
            ))}

            {/* The happy path: the sequence chain. */}
            {steps.slice(0, -1).map((step, index) => {
              const next = steps[index + 1];
              const from = {
                x: nodeX(index) + NODE_WIDTH,
                y: nodeY(model.lane.get(step.id) ?? 0) + NODE_HEIGHT / 2,
              };
              const to = {
                x: nodeX(index + 1),
                y: nodeY(model.lane.get(next.id) ?? 0) + NODE_HEIGHT / 2,
              };
              const bend = Math.max(28, (to.x - from.x) / 2);
              const dim =
                network && !(network.has(step.id) && network.has(next.id));
              return (
                <path
                  key={`flow-${step.id}`}
                  d={`M ${from.x} ${from.y} C ${from.x + bend} ${from.y} ${to.x - bend} ${to.y} ${to.x} ${to.y}`}
                  fill="none"
                  className="stroke-rule-strong [stroke-width:1.5]"
                  markerEnd={`url(#${markerId}-happy)`}
                  opacity={dim ? 0.35 : 1}
                />
              );
            })}

            {/* Branches that rejoin the workflow. */}
            {model.rejoining.map((branch) => {
              const fromIndex = model.column.get(branch.fromStepId);
              const toIndex = model.column.get(branch.toStepId as string);
              if (fromIndex === undefined || toIndex === undefined) return null;

              const style = BRANCH_STYLES[branch.kind];
              const fromLane = model.lane.get(branch.fromStepId) ?? 0;
              const toLane = model.lane.get(branch.toStepId as string) ?? 0;
              const backIndex = model.backward.indexOf(branch);
              const goesBack = backIndex >= 0;
              const dim =
                network &&
                !(
                  network.has(branch.fromStepId) &&
                  network.has(branch.toStepId as string)
                );

              let path: string;
              let labelPoint: { x: number; y: number };

              if (goesBack) {
                const y =
                  model.lanesBottom + 12 + backIndex * RETURN_LANE_STEP;
                const startX = nodeX(fromIndex) + NODE_WIDTH / 2;
                // A step that retries itself would otherwise draw one line
                // straight down and back up over itself, which reads as a
                // stray tick rather than a loop.
                const endX =
                  toIndex === fromIndex
                    ? startX + 44
                    : nodeX(toIndex) + NODE_WIDTH / 2;
                path =
                  `M ${startX} ${nodeY(fromLane) + NODE_HEIGHT} ` +
                  `L ${startX} ${y} L ${endX} ${y} ` +
                  `L ${endX} ${nodeY(toLane) + NODE_HEIGHT}`;
                labelPoint = { x: (startX + endX) / 2, y: y - 6 };
              } else {
                const from = {
                  x: nodeX(fromIndex) + NODE_WIDTH,
                  y: nodeY(fromLane) + NODE_HEIGHT / 2,
                };
                const to = {
                  x: nodeX(toIndex),
                  y: nodeY(toLane) + NODE_HEIGHT / 2,
                };
                // Bulge away from the sequence chain so a branch between the
                // same two columns never hides underneath the happy path.
                const bulge = fromLane === toLane ? 34 : 0;
                const bend = Math.max(30, (to.x - from.x) / 2);
                path =
                  `M ${from.x} ${from.y} C ${from.x + bend} ${from.y + bulge} ` +
                  `${to.x - bend} ${to.y + bulge} ${to.x} ${to.y}`;
                labelPoint = {
                  x: (from.x + to.x) / 2,
                  y: (from.y + to.y) / 2 + bulge * 0.75 - 6,
                };
              }

              return (
                <g key={branch.id} opacity={dim ? 0.35 : 1}>
                  <path
                    d={path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth="1.5"
                    strokeDasharray={style.dash || undefined}
                    markerEnd={`url(#${markerId}-${style.marker})`}
                  />
                  <EdgeLabel
                    x={labelPoint.x}
                    y={labelPoint.y}
                    text={`${branch.kindLabel}: ${branch.condition}`}
                  />
                </g>
              );
            })}

            {/* Branches that end the workflow. */}
            {model.terminal.map((branch, index) => {
              const fromIndex = model.column.get(branch.fromStepId);
              if (fromIndex === undefined) return null;
              const style = BRANCH_STYLES[branch.kind];
              const fromLane = model.lane.get(branch.fromStepId) ?? 0;
              const startX = nodeX(fromIndex) + NODE_WIDTH / 2;
              const stopX = startX + (index % 2 === 0 ? 0 : 14);
              const stopY = model.lanesBottom + model.returnBand + 22;
              const dim = network && !network.has(branch.fromStepId);

              return (
                <g key={branch.id} opacity={dim ? 0.35 : 1}>
                  <path
                    d={`M ${startX} ${nodeY(fromLane) + NODE_HEIGHT} L ${startX} ${stopY - 18} L ${stopX} ${stopY - 18}`}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth="1.5"
                    strokeDasharray={style.dash || undefined}
                    markerEnd={`url(#${markerId}-${style.marker})`}
                  />
                  <rect
                    x={stopX - 62}
                    y={stopY - 12}
                    width="124"
                    height="34"
                    rx="17"
                    className="fill-panel stroke-rule-strong"
                  />
                  <text
                    x={stopX}
                    y={stopY + 3}
                    textAnchor="middle"
                    className="fill-ink font-chassis text-[11px]"
                  >
                    Workflow ends
                  </text>
                  <text
                    x={stopX}
                    y={stopY + 16}
                    textAnchor="middle"
                    className="fill-ink-3 font-chassis text-[9px]"
                  >
                    {shorten(branch.kindLabel, 18)}
                  </text>
                  <title>{`${branch.kindLabel}: ${branch.condition}. The workflow ends here.`}</title>
                </g>
              );
            })}

            {/* Steps, drawn last so nothing crosses over them. */}
            {steps.map((step, index) => {
              const tone = statusTone(step.status);
              const label = statusLabel(step.status);
              const x = nodeX(index);
              const y = nodeY(model.lane.get(step.id) ?? 0);
              const selected = step.id === selectedStepId;
              const lines = wrap(step.action, 26, 2);

              return (
                <g
                  key={step.id}
                  opacity={opacityFor(step.id)}
                  onClick={() => onSelectStep(selected ? null : step.id)}
                  className="cursor-pointer"
                >
                  <title>{`Step ${step.ordinal}. ${step.action}. Owner ${step.actor}. Status ${label}. ${step.taskSummary}.`}</title>
                  <rect
                    x={x}
                    y={y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="7"
                    className={cn(
                      selected
                        ? "fill-signal-wash stroke-signal [stroke-width:2]"
                        : "fill-panel stroke-rule [stroke-width:1] hover:fill-inset",
                    )}
                  />
                  <text
                    x={x + 12}
                    y={y + 17}
                    className="fill-ink-3 font-chassis text-[10px] tracking-[0.09em] uppercase"
                  >
                    Step {step.ordinal}
                  </text>
                  <StatusGlyph tone={tone} x={x + NODE_WIDTH - 14} y={y + 13} />
                  {lines.map((line, lineIndex) => (
                    <text
                      key={lineIndex}
                      x={x + 12}
                      y={y + 35 + lineIndex * 15}
                      className="fill-ink font-prose text-[12px]"
                    >
                      {line}
                    </text>
                  ))}
                  <text
                    x={x + 12}
                    y={y + NODE_HEIGHT - 20}
                    className={cn(TEXT_CLASS[tone], "font-chassis text-[10px]")}
                  >
                    {label}
                  </text>
                  <text
                    x={x + 12}
                    y={y + NODE_HEIGHT - 8}
                    className="fill-ink-3 font-chassis text-[10px]"
                  >
                    {shorten(step.taskSummary, 27)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <Legend branches={branches} />
    </div>
  );
}

/** A written label on a branch, on its own plate so it stays readable. */
function EdgeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const shown = shorten(text, 34);
  const width = shown.length * 5.6 + 10;
  return (
    <g>
      <title>{text}</title>
      <rect
        x={x - width / 2}
        y={y - 11}
        width={width}
        height="15"
        rx="3"
        className="fill-panel stroke-rule"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        className="fill-ink-2 font-chassis text-[10px]"
      >
        {shown}
      </text>
    </g>
  );
}

/**
 * The key. A line style is only distinct if the reader is told what it means,
 * and this is what lets the diagram work in greyscale.
 */
function Legend({ branches }: { branches: SwimlaneBranch[] }) {
  const kinds = Array.from(new Set(branches.map((branch) => branch.kind)));

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule bg-panel-raised px-3 py-2">
      <span className="font-chassis text-label text-ink-3 uppercase">Key</span>
      <LegendItem
        dash=""
        stroke="var(--sd-rule-strong)"
        label="Happy path"
        description="The ordered sequence, step by step"
      />
      {kinds.map((kind) => {
        const style = BRANCH_STYLES[kind];
        const label =
          branches.find((branch) => branch.kind === kind)?.kindLabel ?? kind;
        return (
          <LegendItem
            key={kind}
            dash={style.dash}
            stroke={style.stroke}
            label={label}
            description={style.description}
          />
        );
      })}
      {kinds.length === 0 ? (
        <span className="font-prose text-small text-ink-3">
          No branches are recorded on this workflow, so every step runs in
          sequence.
        </span>
      ) : null}
    </div>
  );
}

function LegendItem({
  dash,
  stroke,
  label,
  description,
}: {
  dash: string;
  stroke: string;
  label: string;
  description: string;
}) {
  return (
    <span
      title={description}
      className="inline-flex items-center gap-2 font-chassis text-chassis-sm text-ink-2"
    >
      <svg width="30" height="8" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          y1="4"
          x2="30"
          y2="4"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray={dash || undefined}
        />
      </svg>
      {label}
      <span className="sr-only">. {description}.</span>
    </span>
  );
}
