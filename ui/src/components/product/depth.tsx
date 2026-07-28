/**
 * Specification depth, and what each depth requires.
 *
 * Section 9.2 of the rebuild spec: a microspec covers small, local, reversible
 * behaviour; a standard spec covers a normal cross-component feature; a full
 * design covers architecture, auth, tenancy, public contracts, migrations,
 * privacy, security, billing and high-risk integrations. The depth decides
 * which child records have to exist before the feature can be accepted.
 *
 * The point of showing it: a thin microspec is finished, a thin full design is
 * unfinished, and the interface has to make those two look different.
 */

import type * as React from "react";

import { JumpLink, Panel } from "@/components/product/panel";
import { ProgressMeter } from "@/components/ui/progress";
import { Status } from "@/components/shell/status";
import { countPhrase } from "@/lib/format";
import type { Progress } from "@/types";
import { cn } from "@/lib/utils";

export type SectionKey =
  | "purpose"
  | "scope"
  | "acceptanceCriteria"
  | "edgeCases"
  | "workflows"
  | "surfaces"
  | "apiOperations"
  | "data"
  | "integrations"
  | "nfrs"
  | "decisions"
  | "tasks"
  | "evidence";

export const SECTION_LABELS: Record<SectionKey, string> = {
  purpose: "Purpose And User Value",
  scope: "Scope In And Out",
  acceptanceCriteria: "Acceptance Criteria",
  edgeCases: "Edge Cases",
  workflows: "Workflows",
  surfaces: "Surfaces And UI Actions",
  apiOperations: "API Operations",
  data: "Data Entities And Migrations",
  integrations: "Integrations",
  nfrs: "Non-Functional Requirements",
  decisions: "Governing Decisions",
  tasks: "Tasks And Subtasks",
  evidence: "Verification Evidence",
};

/** The panel id each section renders with, so the checklist can link to it. */
export const SECTION_ANCHORS: Record<SectionKey, string> = {
  purpose: "feature-purpose",
  scope: "feature-scope",
  acceptanceCriteria: "feature-acceptance",
  edgeCases: "feature-edge-cases",
  workflows: "feature-workflows",
  surfaces: "feature-surfaces",
  apiOperations: "feature-apis",
  data: "feature-data",
  integrations: "feature-integrations",
  nfrs: "feature-nfrs",
  decisions: "feature-decisions",
  tasks: "feature-tasks",
  evidence: "feature-evidence",
};

export const SECTION_ORDER: SectionKey[] = [
  "purpose",
  "scope",
  "acceptanceCriteria",
  "edgeCases",
  "workflows",
  "surfaces",
  "apiOperations",
  "data",
  "integrations",
  "nfrs",
  "decisions",
  "tasks",
  "evidence",
];

export type DepthKey = "microspec" | "standard" | "full_design" | "unrecorded";

export interface Depth {
  key: DepthKey;
  /** Title Case, for a person. */
  label: string;
  /** One sentence saying what kind of work this depth is for. */
  meaning: string;
  /** What this depth expects to exist before the feature can be accepted. */
  required: SectionKey[];
}

const MICROSPEC_REQUIRED: SectionKey[] = [
  "purpose",
  "scope",
  "acceptanceCriteria",
  "tasks",
];

const STANDARD_REQUIRED: SectionKey[] = [
  ...MICROSPEC_REQUIRED,
  "workflows",
  "surfaces",
  "apiOperations",
  "data",
  "evidence",
];

const FULL_REQUIRED: SectionKey[] = [
  ...STANDARD_REQUIRED,
  "edgeCases",
  "integrations",
  "nfrs",
  "decisions",
];

export const DEPTHS: Record<DepthKey, Depth> = {
  microspec: {
    key: "microspec",
    label: "Microspec",
    meaning:
      "A microspec is for small, local, reversible behaviour, so it is expected to be short. Only the four sections below have to be filled in.",
    required: MICROSPEC_REQUIRED,
  },
  standard: {
    key: "standard",
    label: "Standard Spec",
    meaning:
      "A standard spec is for a normal feature that crosses components, so the surfaces, interfaces and data it touches all have to be written down.",
    required: STANDARD_REQUIRED,
  },
  full_design: {
    key: "full_design",
    label: "Full Design",
    meaning:
      "A full design is for architecture, authentication, tenancy, public contracts, migrations, privacy, security, billing or a high-risk integration. Every section below has to be filled in before it can be accepted.",
    required: FULL_REQUIRED,
  },
  unrecorded: {
    key: "unrecorded",
    label: "Depth Not Recorded",
    meaning:
      "Nobody has recorded how deeply this feature needs to be specified, so the shortest contract is assumed here. Set the depth to see the real requirement.",
    required: MICROSPEC_REQUIRED,
  },
};

/** Maps whatever the database stores onto one of the four depths above. */
export function resolveDepth(value: string | null | undefined): Depth {
  const flat = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (flat.includes("micro")) return DEPTHS.microspec;
  if (flat.includes("full")) return DEPTHS.full_design;
  if (flat.includes("standard") || flat.includes("normal")) {
    return DEPTHS.standard;
  }
  return DEPTHS.unrecorded;
}

/** How many records each section holds, so "specified" is a counted fact. */
export type SectionCounts = Record<SectionKey, number>;

export function depthProgress(
  depth: Depth,
  counts: SectionCounts,
  sourceRevision?: number,
): Progress {
  const missing = depth.required.filter((key) => counts[key] === 0);
  const completed = depth.required.length - missing.length;
  return {
    completed,
    total: depth.required.length,
    counts: "required section",
    remains:
      missing.length === 0
        ? null
        : missing.map((key) => SECTION_LABELS[key]).join(", "),
    sourceRevision,
    measurable: depth.required.length > 0,
  };
}

/**
 * The depth contract, drawn as a checklist. Required and empty is an attention
 * state with words, not an absence, which is what makes an unfinished full
 * design visibly unfinished instead of quietly thin.
 */
export function DepthPanel({
  depth,
  counts,
  rawDepth,
  sourceRevision,
  className,
}: {
  depth: Depth;
  counts: SectionCounts;
  /** The value as stored, shown once so the mapping is not a black box. */
  rawDepth: string | null | undefined;
  sourceRevision?: number;
  className?: string;
}) {
  const progress = depthProgress(depth, counts, sourceRevision);

  return (
    <Panel
      id="feature-depth"
      title="Specification depth"
      count={depth.label}
      description={depth.meaning}
      className={className}
    >
      <div className="flex flex-col gap-4">
        <ProgressMeter
          progress={progress}
          qualifier="specified"
          subject="This feature"
        />
        <p className="font-prose text-small text-ink-3 prose-measure">
          {rawDepth
            ? `Recorded on the feature as "${rawDepth}".`
            : "No depth is recorded on the feature, so the shortest contract is shown."}{" "}
          Sections outside this depth are still shown when they hold records,
          and are marked as extra rather than missing.
        </p>

        <ul className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
          {SECTION_ORDER.map((key) => (
            <SectionCheck
              key={key}
              sectionKey={key}
              required={depth.required.includes(key)}
              count={counts[key]}
              depthLabel={depth.label}
            />
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function SectionCheck({
  sectionKey,
  required,
  count,
  depthLabel,
}: {
  sectionKey: SectionKey;
  required: boolean;
  count: number;
  depthLabel: string;
}) {
  const present = count > 0;
  const { tone, label, detail } = sectionVerdict(
    required,
    present,
    count,
    depthLabel,
  );

  return (
    <li className="flex items-start justify-between gap-3 border-b border-rule py-2 last:border-b-0">
      <JumpLink
        targetId={SECTION_ANCHORS[sectionKey]}
        className="min-w-0 font-prose text-body text-ink"
      >
        {SECTION_LABELS[sectionKey]}
      </JumpLink>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Status value={label} tone={tone} label={label} size="sm" />
        <span className="text-right font-prose text-small text-ink-3">
          {detail}
        </span>
      </span>
    </li>
  );
}

function sectionVerdict(
  required: boolean,
  present: boolean,
  count: number,
  depthLabel: string,
): { tone: "complete" | "attention" | "idle"; label: string; detail: string } {
  if (required && present) {
    return {
      tone: "complete",
      label: "Specified",
      detail: countPhrase(count, "record"),
    };
  }
  if (required && !present) {
    return {
      tone: "attention",
      label: "Not Yet Specified",
      detail: `Required at ${depthLabel} depth`,
    };
  }
  if (!required && present) {
    return {
      tone: "complete",
      label: "Specified",
      detail: `${countPhrase(count, "record")}, beyond this depth`,
    };
  }
  return {
    tone: "idle",
    label: "Not Required",
    detail: `Not required at ${depthLabel} depth`,
  };
}

/**
 * The state a section shows when it holds nothing: an unmet requirement when
 * the depth asks for it, a deliberate absence when it does not. Either way it
 * says what happened and what the next move is.
 */
export function SectionEmpty({
  sectionKey,
  required,
  depthLabel,
  featureName,
  fills,
}: {
  sectionKey: SectionKey;
  required: boolean;
  depthLabel: string;
  featureName: string;
  /** What would appear here, in plain language. */
  fills: string;
}) {
  const label = SECTION_LABELS[sectionKey];
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-sd border p-3",
        required
          ? "border-state-attention/45 bg-state-attention-wash"
          : "border-rule bg-inset",
      )}
    >
      <Status
        value={required ? "not_yet_specified" : "not_required"}
        tone={required ? "attention" : "idle"}
        label={required ? "Not Yet Specified" : "Not Required At This Depth"}
        size="sm"
      />
      <p className="font-prose text-body text-ink-2 prose-measure">
        {required
          ? `${label} is required at ${depthLabel} depth and nothing has been recorded for ${featureName} yet. ${fills} Until it is written down this feature cannot be accepted at this depth.`
          : `${label} is not required at ${depthLabel} depth, and nothing has been recorded for ${featureName}. ${fills} Nothing is missing: this depth does not ask for it.`}
      </p>
    </div>
  );
}

/** Wraps a section body so an empty one always answers. */
export function Section({
  sectionKey,
  required,
  depthLabel,
  featureName,
  fills,
  count,
  unit,
  title,
  description,
  actions,
  children,
  bodyClassName,
}: {
  sectionKey: SectionKey;
  required: boolean;
  depthLabel: string;
  featureName: string;
  fills: string;
  count: number;
  /** What one unit of `count` is, so the reading never stands alone. */
  unit?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Panel
      id={SECTION_ANCHORS[sectionKey]}
      title={title ?? SECTION_LABELS[sectionKey]}
      count={
        count > 0
          ? countPhrase(count, unit ?? "record")
          : required
            ? `Required at ${depthLabel} depth`
            : `Not required at ${depthLabel} depth`
      }
      description={description}
      actions={actions}
      bodyClassName={count > 0 ? bodyClassName : "p-4"}
    >
      {count > 0 ? (
        children
      ) : (
        <SectionEmpty
          sectionKey={sectionKey}
          required={required}
          depthLabel={depthLabel}
          featureName={featureName}
          fills={fills}
        />
      )}
    </Panel>
  );
}
