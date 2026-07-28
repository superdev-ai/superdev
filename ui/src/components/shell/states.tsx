/**
 * The shared Empty, Loading, Error, Stale and Offline states.
 *
 * Principle I of DESIGN_DIRECTION.md: the panel always answers. Every one of
 * these takes a title, an explanation of what happened, and an action. A view
 * that renders a bare spinner, a blank region or the word "None" is a defect,
 * so these are the only sanctioned way to show the absence of data.
 *
 * Views import these rather than writing their own, which is what keeps the
 * promise from being broken one view at a time.
 */

import {
  AlertTriangle,
  Clock3,
  Inbox,
  PlugZap,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Status, type StatusTone } from "@/components/shell/status";
import { absoluteTime, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/now";
import type { ApiError } from "@/lib/api";
import type { Meta } from "@/types";
import { cn } from "@/lib/utils";

export interface StateAction {
  /** Imperative and specific: "Retry", "Clear the filters", "Create a task". */
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  icon?: LucideIcon;
}

interface StatePanelProps {
  icon: LucideIcon;
  tone: StatusTone;
  /** What state this is, in plain language. */
  title: string;
  /** What happened, and why, in one or two sentences. */
  explanation: React.ReactNode;
  /** What the person can do next. At least one action is expected. */
  actions?: StateAction[];
  /** Optional supporting readings, e.g. active filters or a service log path. */
  details?: React.ReactNode;
  /** "panel" fills a region, "inline" sits inside an existing panel. */
  density?: "panel" | "inline";
  className?: string;
  children?: React.ReactNode;
}

const TONE_ICON_CLASSES: Record<StatusTone, string> = {
  complete: "border-state-complete/45 bg-state-complete-wash text-state-complete",
  active: "border-state-active/45 bg-state-active-wash text-state-active",
  attention:
    "border-state-attention/45 bg-state-attention-wash text-state-attention",
  blocked: "border-state-blocked/45 bg-state-blocked-wash text-state-blocked",
  idle: "border-rule bg-inset text-ink-3",
  retired: "border-state-retired/45 bg-state-retired-wash text-state-retired",
  unrecognized: "border-rule bg-inset text-ink-2",
};

function ActionButtons({ actions }: { actions?: StateAction[] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {actions.map((action, index) => {
        const Icon = action.icon;
        const content = (
          <>
            {Icon ? <Icon aria-hidden="true" /> : null}
            {action.label}
          </>
        );
        return action.href ? (
          <Button
            key={action.label}
            asChild
            variant={action.variant ?? (index === 0 ? "default" : "outline")}
            size="sm"
          >
            <a href={action.href}>{content}</a>
          </Button>
        ) : (
          <Button
            key={action.label}
            type="button"
            onClick={action.onClick}
            variant={action.variant ?? (index === 0 ? "default" : "outline")}
            size="sm"
          >
            {content}
          </Button>
        );
      })}
    </div>
  );
}

function StatePanel({
  icon: Icon,
  tone,
  title,
  explanation,
  actions,
  details,
  density = "panel",
  className,
  children,
}: StatePanelProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="state-panel"
      data-tone={tone}
      className={cn(
        "flex w-full items-start gap-3 rounded-sd-lg border border-rule bg-panel",
        density === "panel" ? "p-6" : "p-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center rounded-sd border",
          density === "panel" ? "size-9" : "size-7",
          TONE_ICON_CLASSES[tone],
        )}
      >
        <Icon className={density === "panel" ? "size-4.5" : "size-3.5"} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="font-prose text-subtitle text-ink">{title}</h3>
        <div className="font-prose text-body text-ink-2 prose-measure">
          {explanation}
        </div>
        {details ? (
          <div className="pt-0.5 font-chassis text-chassis-sm text-ink-3">
            {details}
          </div>
        ) : null}
        {children}
        <ActionButtons actions={actions} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Empty
   --------------------------------------------------------------------------- */

export interface EmptyProps {
  /** What is empty, e.g. "No features yet". */
  title: string;
  /** Why it is empty and what would fill it. */
  explanation: React.ReactNode;
  actions?: StateAction[];
  /** For a filtered list: say what was searched so it can be widened. */
  details?: React.ReactNode;
  density?: "panel" | "inline";
  className?: string;
}

export function Empty({
  title,
  explanation,
  actions,
  details,
  density,
  className,
}: EmptyProps) {
  return (
    <StatePanel
      icon={Inbox}
      tone="idle"
      title={title}
      explanation={explanation}
      actions={actions}
      details={details}
      density={density}
      className={className}
    />
  );
}

/* ---------------------------------------------------------------------------
   Loading
   --------------------------------------------------------------------------- */

export interface LoadingProps {
  /** What is being fetched, e.g. "Loading the feature contract". */
  title?: string;
  /** What will appear when it arrives, and what to do if it does not. */
  explanation?: React.ReactNode;
  /** How many placeholder rows to draw under the words. */
  rows?: number;
  actions?: StateAction[];
  density?: "panel" | "inline";
  className?: string;
}

export function Loading({
  title = "Loading",
  explanation = "Reading the project database on this machine. This normally takes well under a second.",
  rows = 4,
  actions,
  density = "panel",
  className,
}: LoadingProps) {
  return (
    <StatePanel
      icon={RefreshCw}
      tone="active"
      title={title}
      explanation={explanation}
      actions={actions}
      density={density}
      className={className}
    >
      {rows > 0 ? (
        <div className="flex flex-col gap-1.5 pt-2" aria-hidden="true">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton
              key={index}
              className="h-7 w-full"
              style={{ maxWidth: `${100 - index * 7}%` }}
            />
          ))}
        </div>
      ) : null}
    </StatePanel>
  );
}

/* ---------------------------------------------------------------------------
   Error
   --------------------------------------------------------------------------- */

export interface ErrorStateProps {
  title?: string;
  /** Overrides the message carried by the error. */
  explanation?: React.ReactNode;
  /** The failure, whose message already says what to do next. */
  error?: ApiError | Error | null;
  onRetry?: () => void;
  actions?: StateAction[];
  density?: "panel" | "inline";
  className?: string;
}

export function ErrorState({
  title = "This did not load",
  explanation,
  error,
  onRetry,
  actions,
  density,
  className,
}: ErrorStateProps) {
  const code = (error as ApiError | undefined)?.code;
  const message =
    explanation ??
    error?.message ??
    "Something went wrong reading the project database. Choose Retry, and check the service log if it happens again.";

  const resolvedActions: StateAction[] =
    actions ??
    (onRetry
      ? [{ label: "Retry", onClick: onRetry, icon: RefreshCw }]
      : [{ label: "Reload the page", onClick: () => window.location.reload() }]);

  return (
    <StatePanel
      icon={AlertTriangle}
      tone="blocked"
      title={title}
      explanation={message}
      actions={resolvedActions}
      details={
        code ? <span>Reported by the service as {code}.</span> : undefined
      }
      density={density}
      className={className}
    />
  );
}

/* ---------------------------------------------------------------------------
   Stale
   --------------------------------------------------------------------------- */

export interface StaleProps {
  /** The envelope from the last successful read. */
  meta?: Meta | null;
  title?: string;
  explanation?: React.ReactNode;
  onRefresh?: () => void;
  /** Say what is being shown despite the staleness, e.g. "12 tasks". */
  showing?: string;
  density?: "panel" | "inline";
  className?: string;
}

export function Stale({
  meta,
  title = "This is not the latest data",
  explanation,
  onRefresh,
  showing,
  density = "inline",
  className,
}: StaleProps) {
  const now = useNow();
  const generated = meta?.generatedAt ?? null;
  const message =
    explanation ??
    "The project database has moved on since this was read, so what you see below may be behind. Refresh to catch up.";

  return (
    <StatePanel
      icon={Clock3}
      tone="attention"
      title={title}
      explanation={message}
      actions={
        onRefresh
          ? [{ label: "Refresh now", onClick: onRefresh, icon: RefreshCw }]
          : undefined
      }
      details={
        <span title={generated ? absoluteTime(generated) : undefined}>
          {showing ? `Showing ${showing}. ` : ""}
          Read {relativeTime(generated, now).toLowerCase()}
          {meta ? ` at database revision ${meta.revision}` : ""}.
        </span>
      }
      density={density}
      className={className}
    />
  );
}

/* ---------------------------------------------------------------------------
   Offline
   --------------------------------------------------------------------------- */

export interface OfflineProps {
  title?: string;
  explanation?: React.ReactNode;
  onReconnect?: () => void;
  /** The last envelope received, so the page can say how old the data is. */
  meta?: Meta | null;
  /** Live, Reconnecting or Offline, so the chip agrees with the header. */
  state?: "reconnecting" | "offline";
  density?: "panel" | "inline";
  className?: string;
}

export function Offline({
  title = "The local service is not answering",
  explanation,
  onReconnect,
  meta,
  state = "offline",
  density = "panel",
  className,
}: OfflineProps) {
  const now = useNow();
  const message =
    explanation ??
    (state === "reconnecting"
      ? "The connection to the local Superdev service dropped and is being retried automatically. Everything below is the last data received."
      : "Nothing is answering on the local Superdev service. Start it with `superdev start --apply` in the project directory, then choose Reconnect.");

  return (
    <StatePanel
      icon={PlugZap}
      tone={state === "reconnecting" ? "attention" : "blocked"}
      title={title}
      explanation={message}
      actions={
        onReconnect
          ? [{ label: "Reconnect", onClick: onReconnect, icon: RefreshCw }]
          : undefined
      }
      details={
        meta ? (
          <span title={absoluteTime(meta.generatedAt)}>
            Last data received {relativeTime(meta.generatedAt, now).toLowerCase()}, at
            database revision {meta.revision}.
          </span>
        ) : (
          <span>No data has been received in this session yet.</span>
        )
      }
      density={density}
      className={className}
    >
      <div className="pt-1">
        <Status value={state} size="sm" />
      </div>
    </StatePanel>
  );
}

/* ---------------------------------------------------------------------------
   Unavailable
   --------------------------------------------------------------------------- */

/**
 * For a region that cannot be shown for a product reason rather than a failure:
 * a diagram with nothing to draw, a capability marked not applicable, a view
 * that depends on a record that was cancelled.
 */
export function Unavailable({
  title,
  explanation,
  actions,
  density,
  className,
}: EmptyProps) {
  return (
    <StatePanel
      icon={AlertTriangle}
      tone="retired"
      title={title}
      explanation={explanation}
      actions={actions}
      density={density}
      className={className}
    />
  );
}
