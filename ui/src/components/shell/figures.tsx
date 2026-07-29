/**
 * The three shapes the overview draws, and the rules they all obey.
 *
 * The overview was seven stacked prose sections read top to bottom, which is a
 * reasonable way to store an argument and a poor way to answer "how is this
 * going". These give the same facts a shape the eye reads first.
 *
 * Every one of them is inline SVG on purpose. The interface ships as a single
 * self-contained file with a strict content policy and it is already large, so a
 * charting library would cost hundreds of kilobytes to draw three things, and would
 * bring its own colours and type into a design system that has already decided
 * both.
 *
 * Three rules from DESIGN_DIRECTION.md apply to all of them, and they are what
 * separates these from decoration:
 *
 *   Section 9.II, every number declares what it counts. No naked figure and no
 *   naked percentage. The fraction is printed next to the shape, always, so the
 *   shape is never the only reading. A meter with no completion contract prints
 *   "Not measurable" rather than an empty bar.
 *
 *   Section 7, status without colour. Every segment carries its label as text.
 *   Colour is the third channel, never the first, so these survive greyscale and
 *   colour blindness.
 *
 *   Section 2, the signal never carries state. The ember signal means interactive,
 *   selected or live. A record's health is only ever one of the six state tokens,
 *   so nothing here is tinted for effect.
 */

import type * as React from "react";

import { cn } from "@/lib/utils";

/** The six state tokens, by the name a record's status maps to. */
export type FigureState = "complete" | "active" | "attention" | "blocked" | "idle" | "retired";

const FILL: Record<FigureState, string> = {
  complete: "var(--sd-state-complete)",
  active: "var(--sd-state-active)",
  attention: "var(--sd-state-attention)",
  blocked: "var(--sd-state-blocked)",
  idle: "var(--sd-state-idle)",
  retired: "var(--sd-state-retired)",
};

// The mapping lives in figure-state.mjs so it can be asserted: it is the one part
// of a chart that can be wrong invisibly, since a finished thing tinted as blocked
// looks exactly as convincing as a correct one.
export { stateOf } from "@/lib/figure-state.mjs";

/* ---------------------------------------------------------------------------
   Meter: one count against its total
   --------------------------------------------------------------------------- */

interface MeterProps {
  label: string;
  done: number;
  total: number;
  /** What is being counted, singular. "feature" gives "3 of 7 features". */
  unit: string;
  href?: string | null;
  state?: FigureState;
}

/**
 * A count against its total, as a bar and as words.
 *
 * The words are not a caption. They are the reading, and the bar is the summary,
 * which is why the fraction is never omitted at small sizes: a bar at 40 percent
 * and a bar at 60 percent are hard to tell apart and `6 of 10` is not.
 */
export function Meter({ label, done, total, unit, href, state = "complete" }: MeterProps) {
  const measurable = total > 0;
  const share = measurable ? Math.min(1, Math.max(0, done / total)) : 0;
  const remaining = Math.max(0, total - done);
  const reading = measurable
    ? `${done} of ${total} ${total === 1 ? unit : `${unit}s`}`
    : "Not measurable";
  const Row = href ? "a" : "div";

  return (
    <Row
      {...(href ? { href } : {})}
      className={cn(
        "group flex flex-col gap-1 rounded-sd px-2 py-1.5",
        href ? "focus-ring hover:bg-inset" : "",
      )}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-prose text-small text-ink-1">{label}</span>
        <span className="font-chassis text-chassis-sm text-ink-2 tabular-nums">{reading}</span>
      </span>
      {measurable ? (
        <span
          role="img"
          aria-label={`${label}: ${reading}. ${remaining} remaining.`}
          className="block h-1.5 w-full overflow-hidden rounded-sd-sm bg-inset"
        >
          <span
            className="block h-full rounded-sd-sm"
            style={{ width: `${share * 100}%`, backgroundColor: FILL[state] }}
          />
        </span>
      ) : (
        // Never an empty bar. Section 9.II: no completion contract means say so.
        <span className="font-prose text-small text-ink-3">
          Nothing has been agreed to measure this against yet.
        </span>
      )}
      {measurable && remaining > 0 ? (
        <span className="font-chassis text-chassis-sm text-ink-3">
          {remaining} still to go
        </span>
      ) : null}
    </Row>
  );
}

/* ---------------------------------------------------------------------------
   Distribution: how a total divides
   --------------------------------------------------------------------------- */

export interface Slice {
  label: string;
  count: number;
  state: FigureState;
  href?: string | null;
}

/**
 * How a total divides, as one bar and a legend that is also the data.
 *
 * The legend carries every count, so the bar is a summary of a table rather than a
 * replacement for one. Segments narrower than three percent still render at three
 * percent, because a segment nobody can see reads as a segment that does not exist,
 * and one blocked task out of two hundred is the most important thing on the page.
 */
export function Distribution({ slices, caption }: { slices: Slice[]; caption?: string }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  if (!total) {
    return (
      <p className="font-prose text-small text-ink-3 prose-measure">
        {caption ?? "Nothing to divide up yet."}
      </p>
    );
  }
  const spoken = slices.map((s) => `${s.count} ${s.label}`).join(", ");

  return (
    <div className="flex flex-col gap-1.5">
      <span
        role="img"
        aria-label={`${total} in total: ${spoken}.`}
        className="flex h-2 w-full overflow-hidden rounded-sd-sm bg-inset"
      >
        {slices.map((slice) => (
          <span
            key={slice.label}
            className="block h-full first:rounded-l-sd-sm last:rounded-r-sd-sm"
            style={{
              width: `${Math.max(3, (slice.count / total) * 100)}%`,
              backgroundColor: FILL[slice.state],
            }}
          />
        ))}
      </span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {slices.map((slice) => {
          const Item = slice.href ? "a" : "span";
          return (
            <li key={slice.label}>
              <Item
                {...(slice.href ? { href: slice.href } : {})}
                className={cn(
                  "flex items-center gap-1.5 rounded-sd font-chassis text-chassis-sm",
                  slice.href ? "text-signal underline underline-offset-2 hover:no-underline focus-ring" : "text-ink-2",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: FILL[slice.state] }}
                />
                <span className="tabular-nums">{slice.count}</span>
                <span>{slice.label}</span>
              </Item>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Trend: whether anything is moving
   --------------------------------------------------------------------------- */

export interface Point {
  day: string;
  count: number;
}

/**
 * Activity per day, which answers the one question a total cannot.
 *
 * A project can read the same percentage for a month, and no count on this page
 * says so. This does. Quiet days are drawn as quiet days rather than compressed
 * away, because a flat run is the reading.
 *
 * Bars, not a line. A line between two daily counts implies values between them
 * that do not exist, and a fortnight of bars is legible at this size where fourteen
 * line vertices are not.
 */
export function Trend({ points, unit = "recorded change" }: { points: Point[]; unit?: string }) {
  const total = points.reduce((n, p) => n + p.count, 0);
  const peak = Math.max(1, ...points.map((p) => p.count));
  const busiest = points.reduce((best, p) => (p.count > best.count ? p : best), points[0] ?? { day: "", count: 0 });
  const quiet = points.filter((p) => p.count === 0).length;

  if (!points.length) {
    return <p className="font-prose text-small text-ink-3">No activity has been recorded yet.</p>;
  }

  const when = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-prose text-small text-ink-1">
          {total} {total === 1 ? unit : `${unit}s`} over {points.length} days
        </span>
        <span className="font-chassis text-chassis-sm text-ink-3 tabular-nums">
          busiest {when(busiest.day)}, {busiest.count}
        </span>
      </span>
      <span
        role="img"
        aria-label={`${total} ${unit}s over ${points.length} days. Busiest was ${when(busiest.day)} with ${busiest.count}. ${quiet} of those days had none.`}
        className="flex h-10 w-full items-end gap-px"
      >
        {points.map((point) => (
          <span
            key={point.day}
            title={`${when(point.day)}: ${point.count}`}
            className="flex-1 rounded-t-[2px]"
            style={{
              // A day with nothing keeps a hairline, so the gap is visible as a gap
              // rather than as the edge of the chart.
              height: point.count ? `${Math.max(8, (point.count / peak) * 100)}%` : "2px",
              backgroundColor: point.count ? FILL.active : "var(--sd-rule)",
            }}
          />
        ))}
      </span>
      {quiet ? (
        <span className="font-chassis text-chassis-sm text-ink-3">
          {quiet} of the last {points.length} days had nothing recorded
        </span>
      ) : null}
    </div>
  );
}

/** A row of figures that stacks below tablet width rather than shrinking. */
export function FigureRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}
