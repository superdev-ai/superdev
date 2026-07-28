/**
 * Status is always three channels at once: a glyph, a plain-language Title Case
 * label, and colour. Colour is never the only carrier. See DESIGN_DIRECTION.md
 * section 7.
 *
 * Views must not build their own status chip. Pass the raw stored value to
 * `Status` and it will be mapped, cased and iconified consistently everywhere.
 */

import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  HelpCircle,
  OctagonX,
  type LucideIcon,
} from "lucide-react";
import type * as React from "react";

import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/types";

export type StatusTone =
  | "complete"
  | "active"
  | "attention"
  | "blocked"
  | "idle"
  | "retired"
  | "unrecognized";

interface ToneStyle {
  icon: LucideIcon;
  /** Read out to assistive technology in place of the colour. */
  meaning: string;
  chip: string;
  text: string;
  dot: string;
}

const TONES: Record<StatusTone, ToneStyle> = {
  complete: {
    icon: CheckCircle2,
    meaning: "Finished and verified",
    chip: "border-state-complete/45 bg-state-complete-wash text-state-complete",
    text: "text-state-complete",
    dot: "bg-state-complete",
  },
  active: {
    icon: CircleDot,
    meaning: "Work is underway",
    chip: "border-state-active/45 bg-state-active-wash text-state-active",
    text: "text-state-active",
    dot: "bg-state-active",
  },
  attention: {
    icon: AlertTriangle,
    meaning: "Needs someone to look at it",
    chip:
      "border-state-attention/45 bg-state-attention-wash text-state-attention",
    text: "text-state-attention",
    dot: "bg-state-attention",
  },
  blocked: {
    icon: OctagonX,
    meaning: "Stopped and cannot proceed",
    chip: "border-state-blocked/45 bg-state-blocked-wash text-state-blocked",
    text: "text-state-blocked",
    dot: "bg-state-blocked",
  },
  idle: {
    icon: Circle,
    meaning: "Not started or intentionally stopped",
    chip: "border-state-idle/45 bg-state-idle-wash text-state-idle",
    text: "text-state-idle",
    dot: "bg-state-idle",
  },
  retired: {
    icon: Archive,
    meaning: "No longer the current answer",
    chip: "border-state-retired/45 bg-state-retired-wash text-state-retired",
    text: "text-state-retired",
    dot: "bg-state-retired",
  },
  // For a stored value this interface has no mapping for. It has to render
  // something, and the one thing it must not do is assert a meaning. Falling
  // back to idle announced a met criterion and an implemented module as "not
  // started", which is worse than saying nothing: it is confidently wrong.
  unrecognized: {
    icon: HelpCircle,
    meaning: "Recorded state this view does not have a description for",
    chip: "border-state-idle/45 bg-state-idle-wash text-ink-2",
    text: "text-ink-2",
    dot: "bg-state-idle",
  },
};

/**
 * Every stored status value the interface may meet, mapped to a tone. A value
 * that is not here renders as `unrecognized`, which says it has no description
 * rather than borrowing one, and still shows its Title Case name.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  // Record lifecycle, section 7.4.
  draft: "idle",
  ready: "idle",
  paused: "idle",
  cancelled: "idle",
  in_progress: "active",
  in_review: "active",
  verifying: "active",
  blocked: "blocked",
  complete: "complete",
  superseded: "retired",
  deprecated: "retired",
  // Capability and readiness states, section 8.2.
  specified: "complete",
  applicable_and_specified: "complete",
  awaiting_decision: "attention",
  applicable_and_awaiting_a_decision: "attention",
  not_applicable: "idle",
  deferred: "retired",
  // Evidence, documents, screening and sync.
  verified: "complete",
  stale: "attention",
  failed: "blocked",
  conflict: "blocked",
  in_sync: "complete",
  drifted: "attention",
  proposal_pending: "attention",
  screened: "complete",
  rejected: "retired",
  accepted: "complete",
  active: "active",
  inactive: "idle",
  open: "attention",
  answered: "complete",
  // The rest of what the schema can store. The map used to cover 24 values and
  // the other 47 fell through to idle, so a met criterion and an implemented
  // module were both announced to a screen reader as not started.
  met: "complete",
  pass: "complete",
  applied: "complete",
  configured: "complete",
  confirmed: "complete",
  connected: "complete",
  current: "complete",
  resolved: "complete",
  implemented: "complete",
  merged: "complete",
  filled: "complete",
  generated: "complete",
  clean: "complete",
  compacted: "complete",
  converted: "complete",
  partial: "active",
  time_boxed: "active",
  unmet: "attention",
  inconclusive: "attention",
  inferred: "attention",
  assumed: "attention",
  manual_edit_pending: "attention",
  partially_superseded: "attention",
  revisit_required: "attention",
  unconfigured: "attention",
  unverified: "attention",
  applicable: "attention",
  error: "blocked",
  fail: "blocked",
  failing: "blocked",
  missing: "blocked",
  disconnected: "blocked",
  contradicted: "blocked",
  unmeasured: "idle",
  planned: "idle",
  proposed: "idle",
  pending: "idle",
  unknown: "idle",
  idle: "idle",
  waived: "retired",
  // A milestone that has been reached, and a record deliberately taken out of
  // use. Both are stored today and neither was mapped, so the blueprint
  // announced thirteen of them as states it had no description for.
  reached: "complete",
  retired: "retired",
  // Changes and assumptions, migration 008. A validator now reads the schema's
  // own CHECK constraints and reports any state this map cannot describe, so
  // the next vocabulary added to the database fails the build rather than
  // reaching a reader as a state nobody described.
  recorded: "complete",
  reverted: "retired",
  holding: "active",
  overturned: "retired",
  expired: "retired",
  declined: "retired",
  abandoned: "retired",
  withdrawn: "retired",
  rolled_back: "retired",
  redacted: "retired",
  ended: "retired",
  handed_off: "retired",
  // Connection, for the header indicator and the Offline panel.
  live: "active",
  reconnecting: "attention",
  offline: "blocked",
  degraded: "attention",
};

/** Connection labels. A Record so an added state is a type error, not a wrong word. */
const LABELS: Record<ConnectionState, string> = {
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
  degraded: "Not updating",
};

/** Labels whose plain-language wording differs from a titled slug. */
const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
  in_review: "In Review",
  not_applicable: "Not Applicable",
  awaiting_decision: "Awaiting a Decision",
  applicable_and_specified: "Specified",
  applicable_and_awaiting_a_decision: "Awaiting a Decision",
  proposal_pending: "Edit Proposal Waiting",
  in_sync: "In Sync",
  drifted: "Edited By Hand",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function statusTone(value: string | null | undefined): StatusTone {
  if (!value) return "idle";
  return STATUS_TONES[normalize(value)] ?? "unrecognized";
}

export function statusLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const key = normalize(value);
  return STATUS_LABELS[key] ?? titleCase(value);
}

/** The tone styles, for a caller that needs the colours without the chip. */
export function statusStyle(tone: StatusTone): ToneStyle {
  return TONES[tone];
}

export interface StatusProps extends React.ComponentProps<"span"> {
  /** The stored status value, in whatever casing the database uses. */
  value: string | null | undefined;
  /** Override the mapped tone when a view knows better. */
  tone?: StatusTone;
  /** Override the mapped label when the product has a better word here. */
  label?: string;
  size?: "sm" | "default";
  /** "chip" for a bordered pill, "inline" for a glyph plus text in a sentence. */
  variant?: "chip" | "inline";
  /** Extra words appended after the label, e.g. a reason or an owner. */
  detail?: string;
}

export function Status({
  value,
  tone,
  label,
  size = "default",
  variant = "chip",
  detail,
  className,
  ...props
}: StatusProps) {
  const resolvedTone = tone ?? statusTone(value);
  const resolvedLabel = label ?? statusLabel(value);
  const style = TONES[resolvedTone];
  const Icon = style.icon;

  return (
    <span
      data-slot="status"
      data-tone={resolvedTone}
      title={`${resolvedLabel}: ${style.meaning}`}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 font-chassis whitespace-nowrap",
        variant === "chip" &&
          cn("rounded-sd-sm border px-1.5 py-0.5", style.chip),
        variant === "inline" && style.text,
        size === "sm" ? "text-chassis-sm" : "text-chassis",
        className,
      )}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn(size === "sm" ? "size-3" : "size-3.5", "shrink-0")}
      />
      <span>{resolvedLabel}</span>
      {detail ? (
        <span className="font-prose text-ink-3">{detail}</span>
      ) : null}
      <span className="sr-only">. {style.meaning}.</span>
    </span>
  );
}

/**
 * The live connection reading in the header. Live pulses; reduced motion stops
 * the pulse and the word still says Live, so the dot is never the only signal.
 */
export function ConnectionStatus({
  state,
  explanation,
  className,
}: {
  state: ConnectionState;
  explanation: string;
  className?: string;
}) {
  const tone = statusTone(state);
  const style = TONES[tone];
  const label = LABELS[state];

  return (
    <span
      data-slot="connection-status"
      title={explanation}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sd-sm border px-1.5 py-0.5 font-chassis text-chassis-sm",
        style.chip,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          style.dot,
          state === "live" && "animate-sd-heartbeat motion-reduce:animate-none",
        )}
      />
      <span>{label}</span>
      <span className="sr-only">. {explanation}</span>
    </span>
  );
}
