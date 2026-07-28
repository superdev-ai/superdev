/**
 * Decisions.
 *
 * History is immutable here. A superseded decision keeps its place in the list
 * with a banner explaining that it no longer governs, rather than vanishing,
 * because "what did we decide, and when did that stop being true" is a question
 * this page has to keep answering.
 *
 * A partial supersession prints the exact scope that stopped applying. A time
 * boxed decision whose date has passed is visibly expired and asks to be
 * revisited. Anything the service flags as conflicting with a current request
 * is shown at the top and again on the decision itself.
 *
 * Reads GET /api/decisions and writes only through the decision.transition
 * action on POST /api/mutations. See docs/rebuild/MODULE_CONTRACT.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { Check, RefreshCw, Scale } from "lucide-react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Markdown } from "@/components/ui/markdown";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status, type StatusTone } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getDecisions, postMutation } from "@/lib/api";
import { useLive } from "@/lib/live";
import {
  absoluteTime,
  countPhrase,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { hrefFor, type View } from "@/lib/route";
import { useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type {
  Decision,
  DecisionConflict,
  DecisionLink,
  DecisionsPayload,
  DecisionTransition,
  Meta,
} from "@/types";

/* ---------------------------------------------------------------------------
   Payload shape
   --------------------------------------------------------------------------- */

/** Fields the service sends that the shared contract types do not name yet. */
type DecisionRecord = Decision & {
  statusLabel?: string;
  expires_at?: string | null;
  supersedes_id?: string | null;
  superseded_by_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Transition = DecisionTransition & {
  reason?: string | null;
  sequence?: number;
};

type Link = DecisionLink & { id?: string; scope_note?: string | null };

type DecisionsData = Omit<
  DecisionsPayload,
  "decisions" | "transitions" | "links"
> & {
  decisions: DecisionRecord[];
  transitions: Transition[];
  links: Link[];
};

/* ---------------------------------------------------------------------------
   Vocabulary
   --------------------------------------------------------------------------- */

/** The eight statuses the service accepts, in the order a person meets them. */
const STATUSES = [
  "proposed",
  "accepted",
  "time_boxed",
  "revisit_required",
  "partially_superseded",
  "superseded",
  "deprecated",
  "rejected",
] as const;

const STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  time_boxed: "Time Boxed",
  revisit_required: "Revisit Required",
  partially_superseded: "Partly Superseded",
  superseded: "Superseded",
  deprecated: "Deprecated",
  rejected: "Rejected",
};

const STATUS_TONES: Record<string, StatusTone> = {
  proposed: "idle",
  accepted: "complete",
  time_boxed: "active",
  revisit_required: "attention",
  partially_superseded: "retired",
  superseded: "retired",
  deprecated: "retired",
  rejected: "retired",
};

const STATUS_MEANINGS: Record<string, string> = {
  proposed: "Written down, not yet agreed. It binds nothing.",
  accepted: "Agreed and binding on everything in its scope.",
  time_boxed: "Agreed, but only until its expiry date.",
  revisit_required: "Still on the books, but something asked for it to be reopened.",
  partially_superseded: "Part of it still governs; the rest has been replaced.",
  superseded: "Replaced by a later decision. Kept for the record.",
  deprecated: "No longer the way things are done, with no direct replacement.",
  rejected: "Considered and turned down.",
};

/** Which view can open a record of each kind. Anything else stays plain text. */
const TARGET_VIEWS: Record<string, View> = {
  feature: "features",
  module: "product",
  goal: "product",
  milestone: "product",
  workflow: "workflows",
  data_entity: "data",
  decision: "decisions",
  task: "tasks",
  project: "overview",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  governs: "Governs",
  supersedes: "Supersedes",
  partially_supersedes: "Partly supersedes",
  amends: "Amends",
  relates_to: "Relates to",
};

function key(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function statusLabelOf(value: string | null | undefined): string {
  return STATUS_LABELS[key(value)] ?? titleCase(value);
}

function statusToneOf(value: string | null | undefined): StatusTone {
  return STATUS_TONES[key(value)] ?? "idle";
}

/* ---------------------------------------------------------------------------
   Tolerant readers for the stored JSON columns
   --------------------------------------------------------------------------- */

/**
 * These columns hold a list in most rows and an object in a few, so both are
 * read rather than one being assumed and the other silently dropped.
 */
function asList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : item && typeof item === "object"
            ? Object.values(item as Record<string, unknown>)
                .filter((part) => typeof part === "string")
                .join(", ")
            : String(item),
      )
      .filter((item) => item.trim().length > 0);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([name, item]) => `${titleCase(name)}: ${String(item)}`);
  }
  return [String(value)];
}

interface ReadOption {
  name: string;
  summary: string | null;
  chosen: boolean;
}

function asOptions(value: unknown): ReadOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") {
      return { name: item, summary: null, chosen: false };
    }
    const record = (item ?? {}) as Record<string, unknown>;
    return {
      name:
        typeof record.name === "string"
          ? record.name
          : `Option ${index + 1} (unnamed)`,
      summary: typeof record.summary === "string" ? record.summary : null,
      chosen: record.chosen === true,
    };
  });
}

/* ---------------------------------------------------------------------------
   Reading the data
   --------------------------------------------------------------------------- */

interface Loaded {
  data: DecisionsData | null;
  meta: Meta | null;
  error: ApiError | null;
  loading: boolean;
}

function useDecisions() {
  const { status, revision, reconnect } = useLive();
  const [token, setToken] = useState(0);
  const [state, setState] = useState<Loaded>({
    data: null,
    meta: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    getDecisions(controller.signal)
      .then((result) => {
        setState({
          data: result.data as DecisionsData,
          meta: result.meta,
          error: null,
          loading: false,
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error:
            cause instanceof ApiError
              ? cause
              : new ApiError(
                  "E_UNEXPECTED",
                  "Something went wrong while reading the decisions. Choose Retry, and check the service log if it happens again.",
                  500,
                ),
        }));
      });
    return () => controller.abort();
  }, [revision, token]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);
  return { ...state, connection: status, refresh, reconnect };
}

/* ---------------------------------------------------------------------------
   Small shared pieces
   --------------------------------------------------------------------------- */

function Panel({
  id,
  title,
  reading,
  description,
  children,
}: {
  id: string;
  title: string;
  reading?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="overflow-hidden rounded-sd-lg border border-rule bg-panel"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-3">
        <h3 id={`${id}-title`} className="font-prose text-title text-ink">
          {title}
        </h3>
        {reading ? (
          <span className="font-chassis text-chassis-sm text-ink-3">
            {reading}
          </span>
        ) : null}
        {description ? (
          <p className="w-full font-prose text-small text-ink-2 prose-measure">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="font-chassis text-label text-ink-3 uppercase">
        {label}
      </span>
      <div className="min-w-0 font-prose text-small text-ink-2">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 prose-measure">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`}>
          {/* Stored text, so it carries the same Markdown the record was written in. */}
          <Markdown measure={false}>{item}</Markdown>
        </li>
      ))}
    </ul>
  );
}

function Unrecorded({ what }: { what: string }) {
  return <span className="text-ink-3">Nothing recorded for {what}.</span>;
}

/** A record identifier, linked when a view exists that can open it. */
function TargetLink({
  type,
  id,
}: {
  type: string | null | undefined;
  id: string | null | undefined;
}) {
  if (!id) return <span className="text-ink-3">No record named</span>;
  const view = TARGET_VIEWS[key(type)];
  const label = `${titleCase(type ?? "record")} ${id}`;
  if (!view) {
    return (
      <span className="font-chassis text-chassis-sm text-ink-2">{label}</span>
    );
  }
  return (
    <a
      href={hrefFor(view, id)}
      className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
    >
      {label}
    </a>
  );
}

function MetaLine({ meta }: { meta: Meta | null }) {
  if (!meta) return null;
  return (
    <p
      className="font-chassis text-chassis-sm text-ink-3"
      title={absoluteTime(meta.generatedAt)}
    >
      Read from database revision {meta.revision},{" "}
      {relativeTime(meta.generatedAt).toLowerCase()}.
    </p>
  );
}

/* ---------------------------------------------------------------------------
   Banners: the reason a decision is not simply binding
   --------------------------------------------------------------------------- */

interface Banner {
  tone: StatusTone;
  label: string;
  text: React.ReactNode;
}

const BANNER_CLASSES: Record<StatusTone, string> = {
  complete: "border-state-complete/45 bg-state-complete-wash",
  active: "border-state-active/45 bg-state-active-wash",
  attention: "border-state-attention/45 bg-state-attention-wash",
  blocked: "border-state-blocked/45 bg-state-blocked-wash",
  idle: "border-rule bg-inset",
  retired: "border-state-retired/45 bg-state-retired-wash",
  unrecognized: "border-rule bg-inset",
};

function BannerStrip({ banner }: { banner: Banner }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-sd border px-3 py-2",
        BANNER_CLASSES[banner.tone],
      )}
    >
      <Status
        size="sm"
        value={banner.label}
        tone={banner.tone}
        label={banner.label}
      />
      <p className="font-prose text-small text-ink-2 prose-measure">
        {banner.text}
      </p>
    </div>
  );
}

function isExpired(decision: DecisionRecord, now: number): boolean {
  if (!decision.expires_at) return false;
  const at = Date.parse(decision.expires_at);
  if (Number.isNaN(at)) return false;
  if (["superseded", "rejected", "deprecated"].includes(key(decision.status))) {
    return false;
  }
  return at <= now;
}

/* ---------------------------------------------------------------------------
   Recording a transition
   --------------------------------------------------------------------------- */

function TransitionForm({
  decision,
  onDone,
  onCancel,
}: {
  decision: DecisionRecord;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [scopeDelta, setScopeDelta] = useState("");
  const [acceptedBy, setAcceptedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const needsScope = to === "partially_superseded";
  const scopeMissing = needsScope && scopeDelta.trim().length === 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!to || scopeMissing) {
      setFailure(
        !to
          ? "Choose the status this decision is moving to before saving."
          : "A partial supersession has to say which part stops applying, otherwise nobody can tell what still governs.",
      );
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await postMutation("decision.transition", {
        decisionId: decision.id,
        to,
        reason: reason.trim() || undefined,
        scopeDelta: scopeDelta.trim() || undefined,
        acceptedBy: acceptedBy.trim() || undefined,
      });
      onDone();
    } catch (cause: unknown) {
      setFailure(
        cause instanceof ApiError
          ? cause.message
          : "The transition was not saved. Try again, and check the service log if it happens again.",
      );
      setBusy(false);
    }
  }

  const fieldId = `transition-${decision.id}`;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-sd border border-rule-strong bg-inset px-3 py-3"
    >
      <p className="font-prose text-small text-ink-2 prose-measure">
        Moving a decision writes a new line in its history. Nothing already
        recorded is changed or removed.
      </p>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${fieldId}-to`}
          className="font-chassis text-label text-ink-3 uppercase"
        >
          Move it to
        </label>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger id={`${fieldId}-to`} className="w-full sm:w-72">
            <SelectValue placeholder="Choose a status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.filter((status) => status !== key(decision.status)).map(
              (status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        {to ? (
          <p className="font-prose text-small text-ink-3 prose-measure">
            {STATUS_MEANINGS[to]}
          </p>
        ) : (
          <p className="font-prose text-small text-ink-3 prose-measure">
            This decision is currently {statusLabelOf(decision.status)}. Every
            other status is offered here.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${fieldId}-reason`}
          className="font-chassis text-label text-ink-3 uppercase"
        >
          Why it is moving
        </label>
        <Textarea
          id={`${fieldId}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What changed, in one sentence. This is what the next person reads."
          className="min-h-16"
        />
      </div>

      {needsScope ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${fieldId}-scope`}
            className="font-chassis text-label text-ink-3 uppercase"
          >
            Which part stops applying
          </label>
          <Textarea
            id={`${fieldId}-scope`}
            value={scopeDelta}
            onChange={(event) => setScopeDelta(event.target.value)}
            aria-invalid={scopeMissing || undefined}
            aria-describedby={`${fieldId}-scope-help`}
            placeholder="Name the exact part that is being replaced, and leave the rest untouched."
            className="min-h-16"
          />
          <p
            id={`${fieldId}-scope-help`}
            className="font-prose text-small text-ink-3 prose-measure"
          >
            Required. Without it nobody can tell which part of this decision
            still governs.
          </p>
        </div>
      ) : null}

      {to === "accepted" ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${fieldId}-by`}
            className="font-chassis text-label text-ink-3 uppercase"
          >
            Accepted by
          </label>
          <Input
            id={`${fieldId}-by`}
            value={acceptedBy}
            onChange={(event) => setAcceptedBy(event.target.value)}
            placeholder="Who agreed to this"
            className="sm:w-72"
          />
        </div>
      ) : null}

      {failure ? (
        <p
          role="alert"
          className="rounded-sd border border-state-blocked/45 bg-state-blocked-wash px-2 py-1.5 font-prose text-small text-ink-2 prose-measure"
        >
          {failure}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving the transition" : "Record the transition"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------
   One decision
   --------------------------------------------------------------------------- */

function DecisionCard({
  decision,
  banners,
  links,
  transitions,
  selected,
  transitionOpen,
  onToggleTransition,
  onTransitioned,
}: {
  decision: DecisionRecord;
  banners: Banner[];
  links: Link[];
  transitions: Transition[];
  selected: boolean;
  transitionOpen: boolean;
  onToggleTransition: () => void;
  onTransitioned: () => void;
}) {
  const retired = ["superseded", "partially_superseded", "deprecated", "rejected"].includes(
    key(decision.status),
  );
  const options = asOptions(decision.options_json);
  const criteria = asList(decision.criteria_json);
  const evidence = asList(decision.evidence_json);
  const consequences = asList(decision.consequences_json);
  const risks = asList(decision.risks_json);
  const enforcement = asList(decision.enforcement_json);
  const triggers = asList(decision.revisit_triggers_json);

  return (
    <article
      id={`decision-${decision.id}`}
      data-selected={selected || undefined}
      aria-labelledby={`decision-${decision.id}-title`}
      className={cn(
        "flex flex-col gap-3 border-b border-rule px-4 py-4 last:border-b-0",
        "data-[selected]:bg-signal-wash data-[selected]:shadow-[inset_2px_0_0_var(--sd-signal)]",
      )}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h4
            id={`decision-${decision.id}-title`}
            className="font-prose text-subtitle text-ink"
          >
            {decision.title}
          </h4>
          {/* The identifier links to itself, so the decision being read has an
              address that can be copied and sent to someone else. */}
          <a
            href={hrefFor("decisions", decision.id)}
            className={cn(
              "w-fit rounded-sd-sm font-chassis text-chassis-sm text-ink-3 hover:text-signal focus-ring",
              retired && "line-through",
            )}
          >
            {decision.id}
          </a>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Status
            value={decision.status}
            tone={statusToneOf(decision.status)}
            label={statusLabelOf(decision.status)}
            size="sm"
            title={
              STATUS_MEANINGS[key(decision.status)] ??
              "Status as recorded on this decision."
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTransition}
            aria-expanded={transitionOpen}
            aria-controls={`transition-${decision.id}-form`}
          >
            {transitionOpen ? "Close" : "Change status"}
          </Button>
        </div>
      </header>

      {banners.length > 0 ? (
        <div className="flex flex-col gap-2">
          {banners.map((banner, index) => (
            <BannerStrip key={`${banner.label}-${index}`} banner={banner} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        <Field label="What was decided" className="md:col-span-2">
          {decision.decision ? (
            <Markdown>{decision.decision}</Markdown>
          ) : (
            <Unrecorded what="the decision itself" />
          )}
        </Field>

        {decision.observable_rationale ? (
          <Field label="Why" className="md:col-span-2">
            <Markdown>{decision.observable_rationale}</Markdown>
          </Field>
        ) : null}

        {decision.context ? (
          <Field label="What prompted it" className="md:col-span-2">
            <Markdown>{decision.context}</Markdown>
          </Field>
        ) : null}

        <Field label="What it binds">
          {decision.scope_id || decision.scope_type ? (
            <TargetLink type={decision.scope_type} id={decision.scope_id} />
          ) : (
            <span className="text-ink-3">
              The whole project, with no narrower scope recorded.
            </span>
          )}
        </Field>

        {decision.supersedes_id ? (
          <Field label="What it replaces">
            <TargetLink type="decision" id={decision.supersedes_id} />
          </Field>
        ) : null}

        <Field label="How it is enforced">
          {enforcement.length > 0 ? (
            <Bullets items={enforcement} />
          ) : (
            <span className="text-ink-3">
              No enforcement point recorded, so nothing checks this
              automatically.
            </span>
          )}
        </Field>

        {decision.verification ? (
          <Field label="How it is verified">
            <Markdown>{decision.verification}</Markdown>
          </Field>
        ) : null}

        <Field label="What would reopen it">
          {triggers.length > 0 ? (
            <Bullets items={triggers} />
          ) : (
            <span className="text-ink-3">
              No revisit trigger recorded, so nothing will reopen this on its
              own.
            </span>
          )}
        </Field>

        <Field label="Expiry">
          {decision.expires_at ? (
            <span title={absoluteTime(decision.expires_at)}>
              Time boxed to {absoluteTime(decision.expires_at)},{" "}
              {relativeTime(decision.expires_at).toLowerCase()}.
            </span>
          ) : (
            <span className="text-ink-3">
              Not time boxed. It stands until something supersedes it.
            </span>
          )}
        </Field>

        <Field label="Agreed">
          {decision.accepted_at ? (
            <span title={absoluteTime(decision.accepted_at)}>
              {relativeTime(decision.accepted_at)}
              {decision.accepted_by ? ` by ${decision.accepted_by}` : ""}
            </span>
          ) : (
            <span className="text-ink-3">Not agreed by anyone yet.</span>
          )}
        </Field>

        {options.length > 0 ? (
          <Field label="Options weighed" className="md:col-span-2">
            <ul className="flex flex-col gap-1">
              {options.map((option, index) => (
                <li
                  key={`${option.name}-${index}`}
                  className="flex items-start gap-2"
                >
                  {option.chosen ? (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-state-complete"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-3"
                    />
                  )}
                  <span className="prose-measure">
                    <span className={option.chosen ? "text-ink" : undefined}>
                      {option.name}
                    </span>
                    {option.chosen ? (
                      <span className="font-chassis text-chassis-sm text-state-complete">
                        {" "}
                        Chosen
                      </span>
                    ) : (
                      <span className="font-chassis text-chassis-sm text-ink-3">
                        {" "}
                        Not chosen
                      </span>
                    )}
                    {option.summary ? <span>. {option.summary}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        {criteria.length > 0 ? (
          <Field label="Judged against">
            <Bullets items={criteria} />
          </Field>
        ) : null}

        {evidence.length > 0 ? (
          <Field label="Evidence">
            <Bullets items={evidence} />
          </Field>
        ) : null}

        {consequences.length > 0 ? (
          <Field label="What follows from it">
            <Bullets items={consequences} />
          </Field>
        ) : null}

        {risks.length > 0 ? (
          <Field label="Risks accepted">
            <Bullets items={risks} />
          </Field>
        ) : null}

        {links.length > 0 ? (
          <Field label="Records it touches" className="md:col-span-2">
            <ul className="flex flex-col gap-1">
              {links.map((link, index) => (
                <li
                  key={`${link.target_type}-${link.target_id}-${index}`}
                  className="flex flex-wrap items-baseline gap-2"
                >
                  <span className="font-chassis text-chassis-sm text-ink-3">
                    {RELATIONSHIP_LABELS[key(link.relationship)] ??
                      titleCase(link.relationship)}
                  </span>
                  <TargetLink type={link.target_type} id={link.target_id} />
                  {link.scope_note ? (
                    <span className="prose-measure">{link.scope_note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        <Field label="History" className="md:col-span-2">
          {transitions.length === 0 ? (
            <span className="text-ink-3">
              No status change has been recorded since this decision was
              written.
            </span>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {transitions.map((transition) => (
                <li key={transition.id} className="flex flex-col gap-0.5">
                  <span>
                    <span className="font-chassis text-chassis-sm text-ink">
                      {transition.from_status
                        ? statusLabelOf(transition.from_status)
                        : "Written"}
                    </span>{" "}
                    to{" "}
                    <span className="font-chassis text-chassis-sm text-ink">
                      {statusLabelOf(transition.to_status)}
                    </span>
                    ,{" "}
                    <span
                      className="text-ink-3"
                      title={absoluteTime(transition.created_at)}
                    >
                      {relativeTime(transition.created_at).toLowerCase()}
                    </span>
                    {transition.actor_id ? (
                      <span className="text-ink-3">, by {transition.actor_id}</span>
                    ) : null}
                  </span>
                  {transition.reason ? (
                    <Markdown measure={false}>{transition.reason}</Markdown>
                  ) : null}
                  {transition.scope_delta ? (
                    <span className="prose-measure">
                      <span className="font-chassis text-label text-ink-3 uppercase">
                        Scope removed
                      </span>{" "}
                      {transition.scope_delta}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Field>
      </div>

      {transitionOpen ? (
        <div id={`transition-${decision.id}-form`}>
          <TransitionForm
            decision={decision}
            onDone={onTransitioned}
            onCancel={onToggleTransition}
          />
        </div>
      ) : null}
    </article>
  );
}

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

type Filter = "all" | "binding" | "attention" | "proposed" | "retired";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Everything",
  binding: "Binding now",
  attention: "Needs attention",
  proposed: "Proposed",
  retired: "No longer governing",
};

const FILTER_EXPLANATIONS: Record<Filter, string> = {
  all: "Every decision ever recorded, in the order it was written, whether it still governs or not.",
  binding:
    "Decisions that bind work happening right now: accepted, or time boxed and still inside their time box.",
  attention:
    "Decisions that something has to be done about: expired, asked to be revisited, partly superseded without a successor, or in conflict with a current request.",
  proposed: "Written down but not yet agreed. These bind nothing yet.",
  retired:
    "Superseded, deprecated or rejected. They are kept because the record of what was decided is not rewritten.",
};

export function DecisionsView() {
  const { data, meta, error, loading, connection, refresh, reconnect } =
    useDecisions();
  const { route } = useRoute();
  const selected = route.record;
  const [filter, setFilter] = useState<Filter>("all");
  const [transitionFor, setTransitionFor] = useState<string | null>(null);
  const scrolledTo = useRef<string | null>(null);

  const decisions = useMemo(() => data?.decisions ?? [], [data]);
  const links = useMemo(() => data?.links ?? [], [data]);
  const transitions = useMemo(() => data?.transitions ?? [], [data]);
  const conflicts = useMemo(() => data?.conflicts ?? [], [data]);

  const now = Date.now();

  const bannersFor = useCallback(
    (decision: DecisionRecord): Banner[] => {
      const out: Banner[] = [];
      const status = key(decision.status);
      const own = conflicts.filter(
        (conflict: DecisionConflict) => conflict.decisionId === decision.id,
      );
      const supersession = transitions
        .filter(
          (transition) =>
            transition.decision_id === decision.id &&
            Boolean(transition.scope_delta),
        )
        .at(-1);
      const partialLink = links.find(
        (link) =>
          link.decision_id === decision.id &&
          key(link.relationship) === "partially_supersedes",
      );

      if (status === "superseded") {
        out.push({
          tone: "retired",
          label: "Superseded",
          text: (
            <>
              This decision no longer governs anything. It keeps its place here
              because the record of what was decided, and when it stopped being
              true, is never rewritten.
              {decision.superseded_by_id ? (
                <>
                  {" "}
                  It was replaced by{" "}
                  <a
                    href={hrefFor("decisions", decision.superseded_by_id)}
                    className="rounded-sd-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
                  >
                    {decision.superseded_by_id}
                  </a>
                  .
                </>
              ) : (
                " No successor was recorded, so what replaced it is unknown."
              )}
            </>
          ),
        });
      }

      if (status === "partially_superseded") {
        const scope = supersession?.scope_delta ?? partialLink?.scope_note ?? null;
        // Reaches the decision that took over the replaced part, when one was
        // recorded. Appended to both wordings, since either can have a successor.
        const successor = decision.superseded_by_id ? (
          <>
            {" "}
            The part that was replaced is now governed by{" "}
            <a
              href={hrefFor("decisions", decision.superseded_by_id)}
              className="rounded-sd-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
            >
              {decision.superseded_by_id}
            </a>
            .
          </>
        ) : null;
        out.push({
          tone: "attention",
          label: "Partly Superseded",
          text: scope ? (
            <>
              Part of this decision has been replaced. Exactly this stopped
              applying: {scope} Everything else below still governs.
              {successor}
            </>
          ) : (
            <>
              Part of this decision has been replaced, but which part was never
              recorded. Until somebody records the scope, treat the whole
              decision as uncertain rather than assuming any of it still holds.
              {successor}
            </>
          ),
        });
      }

      if (isExpired(decision, now)) {
        out.push({
          tone: "attention",
          label: "Expired",
          text: (
            <>
              The time box on this decision ran out on{" "}
              {absoluteTime(decision.expires_at)},{" "}
              {relativeTime(decision.expires_at).toLowerCase()}. Revisit it and
              either accept it again or replace it before relying on it.
            </>
          ),
        });
      }

      if (status === "revisit_required") {
        const triggers = asList(decision.revisit_triggers_json);
        out.push({
          tone: "attention",
          label: "Revisit Required",
          text: (
            <>
              Somebody asked for this decision to be reopened, so treat it as
              provisional until it is settled.
              {triggers.length > 0
                ? ` What triggered it: ${triggers.join("; ")}`
                : ""}
            </>
          ),
        });
      }

      for (const conflict of own) {
        out.push({
          tone: "blocked",
          label: "Conflict",
          text: (
            <>
              {conflict.explanation}
              <span className="block pt-1 text-ink-3">
                In conflict with: {conflict.request}.
              </span>
            </>
          ),
        });
      }

      return out;
    },
    [conflicts, links, transitions, now],
  );

  const groupOf = useCallback(
    (decision: DecisionRecord): Filter[] => {
      const status = key(decision.status);
      const groups: Filter[] = ["all"];
      const expired = isExpired(decision, now);
      const inConflict = conflicts.some(
        (conflict: DecisionConflict) => conflict.decisionId === decision.id,
      );

      if (status === "accepted" || (status === "time_boxed" && !expired)) {
        groups.push("binding");
      }
      if (status === "proposed") groups.push("proposed");
      if (["superseded", "deprecated", "rejected"].includes(status)) {
        groups.push("retired");
      }
      if (
        expired ||
        inConflict ||
        status === "revisit_required" ||
        (status === "partially_superseded" && !decision.superseded_by_id)
      ) {
        groups.push("attention");
      }
      if (status === "partially_superseded" && !groups.includes("attention")) {
        groups.push("retired");
      }
      return groups;
    },
    [conflicts, now],
  );

  const counts = useMemo(() => {
    const out: Record<Filter, number> = {
      all: decisions.length,
      binding: 0,
      attention: 0,
      proposed: 0,
      retired: 0,
    };
    for (const decision of decisions) {
      for (const group of groupOf(decision)) {
        if (group !== "all") out[group] += 1;
      }
    }
    return out;
  }, [decisions, groupOf]);

  /** The selected record is always shown, even when the filter would hide it. */
  const shown = decisions.filter(
    (decision) =>
      decision.id === selected || groupOf(decision).includes(filter),
  );

  useEffect(() => {
    if (!selected || scrolledTo.current === selected) return;
    const element = document.getElementById(`decision-${selected}`);
    if (!element) return;
    scrolledTo.current = selected;
    element.scrollIntoView({ block: "start" });
  }, [selected, shown.length]);

  /* ------------------------------------------------------------------ states */

  if (loading && !data) {
    return (
      <>
        <ViewHeader view="decisions" />
        <ViewBody width="prose">
          <Loading
            title="Loading the decisions"
            explanation="Reading what has been decided on this project, and what has since replaced it, from the database on this machine."
            rows={4}
          />
        </ViewBody>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <ViewHeader view="decisions" />
        <ViewBody width="prose">
          {error?.isOffline ? (
            <Offline onReconnect={reconnect} state="offline" meta={meta} />
          ) : (
            <ErrorState
              title="The decisions did not load"
              error={error}
              onRetry={refresh}
            />
          )}
        </ViewBody>
      </>
    );
  }

  return (
    <>
      <ViewHeader
        view="decisions"
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        }
      >
        <div
          role="group"
          aria-label="Show which decisions"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(Object.keys(FILTER_LABELS) as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              title={FILTER_EXPLANATIONS[option]}
              onClick={() => setFilter(option)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sd border px-2 py-1 font-chassis text-chassis-sm transition-colors duration-[120ms] ease-sd focus-ring",
                filter === option
                  ? "border-signal-edge bg-signal-wash text-ink"
                  : "border-rule bg-panel text-ink-2 hover:bg-inset hover:text-ink",
              )}
            >
              <span>{FILTER_LABELS[option]}</span>
              <span className="text-ink-3" aria-hidden="true">
                {counts[option]}
              </span>
              <span className="sr-only">
                {countPhrase(counts[option], "decision")}
              </span>
            </button>
          ))}
        </div>
        <p className="font-prose text-small text-ink-2 prose-measure">
          {FILTER_EXPLANATIONS[filter]}
        </p>
      </ViewHeader>

      <ViewBody width="prose">
        {connection.state === "offline" ? (
          <Offline
            state="offline"
            onReconnect={reconnect}
            meta={meta}
            density="inline"
            explanation="The live connection to the local Superdev service has dropped, so a decision changed elsewhere will not appear here on its own. Everything shown is the last data received."
          />
        ) : null}

        {error ? (
          <ErrorState
            title="The last refresh failed"
            explanation={`${error.message} The decisions below are the last copy that arrived.`}
            error={error}
            onRetry={refresh}
            density="inline"
          />
        ) : null}

        {meta?.stale ? (
          <Stale
            meta={meta}
            onRefresh={refresh}
            showing={countPhrase(decisions.length, "decision")}
          />
        ) : null}

        {selected && !decisions.some((decision) => decision.id === selected) ? (
          <div className="flex flex-wrap items-center gap-3 rounded-sd border border-state-attention/45 bg-state-attention-wash px-3 py-2">
            <span className="font-prose text-small text-ink-2">
              There is no decision {selected} on this project. It may belong to
              another project, or the link may be out of date.
            </span>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <a href={hrefFor("decisions")}>Show every decision</a>
            </Button>
          </div>
        ) : null}

        {/* -------------------------------------------------------- conflicts */}
        <Panel
          id="conflicts"
          title="Conflicts with what is being asked for now"
          reading={
            conflicts.length === 0
              ? "None"
              : countPhrase(conflicts.length, "conflict")
          }
          description="Where a decision on the books contradicts something the project is currently doing or asking for. Each one names the decision, the clash, and where it bites."
        >
          {conflicts.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No decision is in conflict"
              explanation="Nothing currently being asked for contradicts a decision that is still on the books. This is the state you want, and it needs no action."
            />
          ) : (
            <ul className="flex flex-col">
              {conflicts.map((conflict: DecisionConflict, index) => (
                <li
                  key={`${conflict.decisionId}-${index}`}
                  className="flex flex-col gap-1.5 border-b border-rule px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Status
                      size="sm"
                      value="conflict"
                      tone="blocked"
                      label="Conflict"
                    />
                    <a
                      href={hrefFor("decisions", conflict.decisionId)}
                      className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
                    >
                      {conflict.decisionId}
                    </a>
                    {conflict.targetId ? (
                      <TargetLink
                        type={conflict.targetType}
                        id={conflict.targetId}
                      />
                    ) : null}
                  </div>
                  <Markdown>{conflict.explanation}</Markdown>
                  <p className="font-prose text-small text-ink-3 prose-measure">
                    In conflict with: {conflict.request}.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* -------------------------------------------------------- decisions */}
        <Panel
          id="decisions"
          title="Decisions"
          reading={`${countPhrase(shown.length, "decision")} shown of ${countPhrase(
            decisions.length,
            "decision",
          )}`}
          description="In the order they were written, so a superseded decision keeps its place rather than disappearing from the history."
        >
          {decisions.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No decisions recorded yet"
              explanation="A decision is recorded when a choice is made that later work has to respect. None has been written for this project, so nothing here binds anyone yet."
              actions={[
                { label: "Refresh", onClick: refresh, icon: RefreshCw },
                { label: "See the open questions", href: hrefFor("discovery") },
              ]}
            />
          ) : shown.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title={`No decision is ${FILTER_LABELS[filter].toLowerCase()}`}
              explanation={`${FILTER_EXPLANATIONS[filter]} Nothing on this project matches that right now.`}
              details={
                <span>
                  Filtered to {FILTER_LABELS[filter]} out of{" "}
                  {countPhrase(decisions.length, "decision")}.
                </span>
              }
              actions={[
                {
                  label: "Show every decision",
                  onClick: () => setFilter("all"),
                  icon: Scale,
                },
              ]}
            />
          ) : (
            shown.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                banners={bannersFor(decision)}
                links={links.filter((link) => link.decision_id === decision.id)}
                transitions={transitions.filter(
                  (transition) => transition.decision_id === decision.id,
                )}
                selected={selected === decision.id}
                transitionOpen={transitionFor === decision.id}
                onToggleTransition={() =>
                  setTransitionFor((current) =>
                    current === decision.id ? null : decision.id,
                  )
                }
                onTransitioned={() => {
                  setTransitionFor(null);
                  refresh();
                }}
              />
            ))
          )}
        </Panel>

        <MetaLine meta={meta} />
      </ViewBody>
    </>
  );
}
