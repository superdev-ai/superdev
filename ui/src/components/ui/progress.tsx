import * as ProgressPrimitive from "@radix-ui/react-progress";
import type * as React from "react";

import { isMeasurable, notMeasurable, progressPhrase } from "@/lib/format";
import type { Progress as ProgressValue } from "@/types";
import { cn } from "@/lib/utils";

/**
 * The bare bar. Prefer ProgressMeter below: a bar with no words beside it
 * breaks principle II, because the reader cannot tell what is being counted.
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-inset",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-signal transition-transform duration-[240ms] ease-sd"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

/**
 * A reading that always says what it counts.
 *
 * Where there is no completion contract this prints "Not measurable" with the
 * reason, and draws no bar at all: an empty bar would read as zero progress,
 * which would be a lie.
 */
function ProgressMeter({
  progress,
  qualifier = "met",
  subject = "This record",
  className,
  showRemaining = true,
}: {
  progress: ProgressValue | null | undefined;
  /** Trailing word in the count phrase, e.g. "met", "complete", "applied". */
  qualifier?: string;
  /** Named in the not-measurable explanation. */
  subject?: string;
  className?: string;
  showRemaining?: boolean;
}) {
  const measurable = isMeasurable(progress);
  const phrase = progressPhrase(progress, qualifier);

  if (!measurable) {
    const { label, explanation } = notMeasurable(subject);
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <span className="font-chassis text-chassis-sm text-ink-3">{label}</span>
        <span className="font-prose text-small text-ink-3 prose-measure">
          {explanation}
        </span>
      </div>
    );
  }

  // The service already applied the honest rule: never 100 while anything is
  // outstanding, never 0 once something is done. Rounding again here threw that
  // away, so a bar could sit at full while its own caption read 99 percent.
  const percent =
    progress!.percent ??
    Math.round((progress!.completed / progress!.total) * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Progress
        value={percent}
        aria-label={phrase}
        aria-valuetext={phrase}
        max={100}
      />
      <span className="font-chassis text-chassis-sm text-ink-2">{phrase}</span>
      {progress!.stale ? (
        // The service has always sent this and no meter could show it, because
        // the type left the field out. A number derived from records that have
        // since moved is worth showing, but not worth showing silently.
        <span className="font-prose text-small text-state-attention prose-measure">
          Some of the records behind this number have changed since it was
          worked out.
        </span>
      ) : null}
      {showRemaining && progress!.remains ? (
        <span className="font-prose text-small text-ink-3 prose-measure">
          Remaining: {progress!.remains}
        </span>
      ) : null}
    </div>
  );
}

export { Progress, ProgressMeter };
