/**
 * Discovery: everything that was said, assumed, feared or ruled out before the
 * product existed, drawn as a map you can move around by hand.
 *
 * Every concept carries where it came from (its source and its provenance) and
 * how much it can be trusted (its epistemic status), and neither is dropped
 * when a concept is turned into a goal, a module or a feature: the concept
 * stays on the map, marked as accepted, next to the record it became.
 *
 * Reads `/api/discovery`. Writes only through `discovery.convert` and
 * `layout.save`, which are two of the actions the service accepts.
 */

import { Ban, CircleHelp, Layers, Lightbulb, Lock, Puzzle, Shapes, ShieldAlert, Target, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type * as React from "react";

import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { AnswerQuestion } from "@/components/discovery/answer-question";
import { Markdown } from "@/components/ui/markdown";
import {
  DetailField,
  DetailLinks,
  GraphCanvas,
  type CanvasDetail,
  type DetailLinkItem,
} from "@/components/canvas/graph-canvas";
import {
  FreshnessLine,
  mergeMeta,
  useLiveRead,
} from "@/components/canvas/freshness";
import {
  readSavedLayout,
  type GraphRecord,
  type GraphRelation,
  type TypeStyle,
} from "@/components/canvas/layout";
import { RecordLink } from "@/components/product/panel";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { ApiError, getDiscovery, postMutation } from "@/lib/api";
import {
  absoluteTime,
  countPhrase,
  relativeTime,
  titleCase,
  truncate,
} from "@/lib/format";
import { hrefFor, type View } from "@/lib/route";
import type { DiscoveryItem, DiscoveryPayload, SourceMaterial } from "@/types";

/** What each kind of concept is, in words a person who is not on the team can read. */
const KIND_STYLES: Record<string, TypeStyle> = {
  user: {
    label: "User",
    icon: Users,
    shape: { corner: "round", badge: "circle", outline: "solid" },
    description: "Someone the product is being built for.",
  },
  problem: {
    label: "Problem",
    icon: Puzzle,
    shape: { corner: "large", badge: "diamond", outline: "solid" },
    description: "Something that is wrong today and worth fixing.",
  },
  goal_candidate: {
    label: "Desired outcome",
    icon: Target,
    shape: { corner: "round", badge: "diamond", outline: "solid" },
    description: "An outcome someone wants, not yet accepted as a goal.",
  },
  feature_candidate: {
    label: "Capability",
    icon: Layers,
    shape: { corner: "large", badge: "square", outline: "solid" },
    description: "Something the product might do, not yet accepted as a feature.",
  },
  constraint: {
    label: "Constraint",
    icon: Lock,
    shape: { corner: "square", badge: "square", outline: "solid" },
    description: "A limit the product has to be built inside.",
  },
  assumption: {
    label: "Assumption",
    icon: Lightbulb,
    shape: { corner: "small", badge: "circle", outline: "dashed" },
    description: "Something being taken as true without having checked it.",
  },
  unknown: {
    label: "Unknown",
    icon: CircleHelp,
    shape: { corner: "small", badge: "diamond", outline: "dashed" },
    description: "Something nobody knows yet that the product depends on.",
  },
  risk: {
    label: "Risk",
    icon: ShieldAlert,
    shape: { corner: "large", badge: "circle", outline: "dashed" },
    description: "Something that could go wrong and what it would cost.",
  },
  exclusion: {
    label: "Exclusion",
    icon: Ban,
    shape: { corner: "square", badge: "diamond", outline: "dashed" },
    description: "Something deliberately ruled out, and kept so it stays ruled out.",
  },
};

/** Plain-language gloss for each epistemic status, so no internal word stands alone. */
const EVIDENCE_MEANING: Record<string, string> = {
  stated: "Someone said this directly in a source that was supplied.",
  inferred: "Worked out from the supplied material rather than said outright.",
  assumed: "Taken as true with nothing yet to back it up.",
  verified: "Checked against evidence and found to hold.",
  contradicted: "Something else that was supplied contradicts this.",
};

type ConvertTarget = "goal" | "module" | "feature";

const CONVERT_TARGETS: { target: ConvertTarget; label: string }[] = [
  { target: "goal", label: "Convert to a goal" },
  { target: "module", label: "Convert to a module" },
  { target: "feature", label: "Convert to a feature" },
];

/** Which view can open a record of each kind. Anything else stays plain text. */
const RECORD_VIEWS: Record<string, View> = {
  goal: "product",
  milestone: "product",
  module: "product",
  feature: "features",
  workflow: "workflows",
  task: "tasks",
  decision: "decisions",
};

interface Conversion {
  id: string;
  state: "working" | "done" | "failed";
  message: string;
  /** The record that was created, so the result can be opened from here. */
  created?: { target: ConvertTarget; id: string } | null;
}

export function DiscoveryView() {
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await getDiscovery(signal);
    return { data: result.data, meta: mergeMeta([result.meta]) };
  }, []);

  const read = useLiveRead<DiscoveryPayload>(load);
  const { data, meta, error, loading, connection } = read;
  const [conversion, setConversion] = useState<Conversion | null>(null);

  const items = useMemo(() => collectItems(data), [data]);
  const sources = data?.sources ?? [];
  const questions = data?.questions ?? [];

  const sourceById = useMemo(() => {
    const map = new Map<string, SourceMaterial>();
    for (const source of sources) map.set(source.id, source);
    return map;
  }, [sources]);

  const typeStyles = useMemo(() => {
    const styles: Record<string, TypeStyle> = { ...KIND_STYLES };
    for (const item of items) {
      if (styles[item.kind]) continue;
      styles[item.kind] = {
        label: titleCase(item.kind),
        icon: Shapes,
        shape: { corner: "large", badge: "square", outline: "dashed" },
        description:
          "A kind of concept this project uses that the control center has no fixed wording for.",
      };
    }
    return styles;
  }, [items]);

  const records = useMemo<GraphRecord[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        name: truncate(item.statement, 120),
        typeKey: item.kind,
        // The service stores one type for everything on this canvas.
        layoutType: "discovery_item",
        status: item.status,
        meta: `Evidence: ${titleCase(item.epistemic_status)}`,
        summary: item.statement,
        searchText: [item.provenance, sourceById.get(item.source_id ?? "")?.path_or_label]
          .filter(Boolean)
          .join(" "),
      })),
    [items, sourceById],
  );

  const relations = useMemo<GraphRelation[]>(() => {
    const known = new Set(items.map((item) => item.id));
    const seen = new Set<string>();
    const out: GraphRelation[] = [];
    for (const link of data?.links ?? []) {
      if (!known.has(link.from_id) || !known.has(link.to_id)) continue;
      if (link.from_id === link.to_id) continue;
      const id = `${link.relationship}:${link.from_id}:${link.to_id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        from: link.from_id,
        to: link.to_id,
        kindKey: link.relationship,
        kindLabel: titleCase(link.relationship),
        hierarchy: false,
      });
    }
    return out;
  }, [data?.links, items]);

  const itemById = useMemo(() => {
    const map = new Map<string, DiscoveryItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const savedLayout = useMemo(() => readSavedLayout(data), [data]);

  const refresh = read.refresh;
  const convert = useCallback(
    async (id: string, target: ConvertTarget) => {
      setConversion({
        id,
        state: "working",
        message: `Turning this concept into a ${target}.`,
      });
      try {
        // The service answers with the record it created under `converted`.
        const result = await postMutation<{ converted?: { id?: string } } | null>(
          "discovery.convert",
          { id, target },
        );
        const createdId =
          result.data && typeof result.data === "object"
            ? String(result.data.converted?.id ?? "")
            : "";
        setConversion({
          id,
          state: "done",
          message: createdId
            ? `Converted into ${target} ${createdId}. This concept stays on the map, and the new record keeps it as its origin.`
            : `Converted into a ${target}. This concept stays on the map, and the new record keeps it as its origin.`,
          created: createdId ? { target, id: createdId } : null,
        });
        refresh();
      } catch (failure) {
        setConversion({
          id,
          state: "failed",
          message:
            failure instanceof ApiError
              ? failure.message
              : `This concept was not converted into a ${target} because the local service did not answer. Nothing was changed. Try again once the service is back.`,
        });
      }
    },
    [refresh],
  );

  const renderDetail = useCallback(
    (id: string, open: (next: string) => void): CanvasDetail | null => {
      const item = itemById.get(id);
      if (!item) return null;
      return buildDetail({
        item,
        typeStyles,
        source: item.source_id ? (sourceById.get(item.source_id) ?? null) : null,
        relations,
        itemById,
        open,
        conversion: conversion?.id === id ? conversion : null,
        onConvert: convert,
      });
    },
    [itemById, typeStyles, sourceById, relations, conversion, convert],
  );

  if (loading && !data) {
    return (
      <>
        <ViewHeader view="discovery" />
        <ViewBody width="prose">
          <Loading
            title="Loading discovery"
            explanation="Reading the sources, concepts, questions, assumptions and risks from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        <ViewHeader view="discovery" />
        <ViewBody width="prose">
          {error instanceof ApiError && error.isOffline ? (
            <Offline
              onReconnect={read.reconnect}
              state={connection === "reconnecting" ? "reconnecting" : "offline"}
              meta={meta}
            />
          ) : (
            <ErrorState
              title="Discovery did not load"
              error={error}
              onRetry={read.refresh}
            />
          )}
        </ViewBody>
      </>
    );
  }

  return (
    <>
      <ViewHeader view="discovery">
        <FreshnessLine
          meta={meta}
          connection={connection}
          connectionExplanation={read.connectionExplanation}
          onRefresh={read.refresh}
          refreshing={read.refreshing}
        />
      </ViewHeader>

      <ViewBody width="prose">
        {error && data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            error={error}
            onRetry={read.refresh}
          />
        ) : null}

        {meta?.stale ? (
          <Stale
            meta={meta}
            onRefresh={read.refresh}
            showing={countPhrase(items.length, "concept")}
          />
        ) : null}

        <GraphCanvas
          label="Discovery mind map"
          instructions="Click a concept to light up what it connects to, double click to open it, drag it anywhere you like, and drag empty space to pan."
          records={records}
          relations={relations}
          typeStyles={typeStyles}
          mode="network"
          saved={savedLayout}
          layoutScope="discovery"
          renderDetail={renderDetail}
          unit={{ singular: "concept", plural: "concepts" }}
          empty={{
            title: "No concepts have been captured yet",
            explanation:
              "Concepts appear here once source material has been supplied to this project and screened: the users, problems, desired outcomes, capabilities, constraints, assumptions, unknowns, risks and exclusions found in it. They are captured by working through discovery with Superdev, not from this page.",
            actions: [{ label: "Go to the overview", href: hrefFor("overview") }],
          }}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ListPanel
            title="Where this came from"
            description="Every piece of material supplied to this project, and whether it has been screened for anything that must not be stored."
          >
            {sources.length === 0 ? (
              <Empty
                density="inline"
                title="No source material has been supplied"
                explanation="Nothing has been handed to this project to read yet. Supply a brief, a transcript or an existing document through Superdev and it will be listed here with its screening result."
              />
            ) : (
              <ul className="flex flex-col">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="flex flex-col gap-1 border-b border-rule py-2.5 last:border-b-0"
                  >
                    <span className="font-prose text-small text-ink">
                      {source.path_or_label}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Status value={source.screening_status} size="sm" />
                      <span className="font-chassis text-chassis-sm text-ink-3">
                        {titleCase(source.source_type)}
                      </span>
                      {source.supplied_by ? (
                        <span className="font-chassis text-chassis-sm text-ink-3">
                          Supplied by {source.supplied_by}
                        </span>
                      ) : null}
                      <span
                        className="font-chassis text-chassis-sm text-ink-3"
                        title={absoluteTime(source.received_at)}
                      >
                        Received {relativeTime(source.received_at).toLowerCase()}
                      </span>
                    </span>
                    {source.redaction_summary ? (
                      <span className="font-prose text-small text-ink-2 prose-measure">
                        {source.redaction_summary}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ListPanel>

          <ListPanel
            title="What is still being asked"
            description="Questions raised during discovery, why each one matters, and what Superdev recommends if nobody answers."
          >
            {questions.length === 0 ? (
              <Empty
                density="inline"
                title="No questions are open"
                explanation="Nothing about this project is currently waiting on an answer. Questions appear here as soon as discovery finds something it cannot decide on its own."
              />
            ) : (
              <ul className="flex flex-col">
                {questions.map((question) => (
                  <li
                    key={question.id}
                    className="flex flex-col gap-1 border-b border-rule py-2.5 last:border-b-0"
                  >
                    <Markdown measure={false}>{question.question}</Markdown>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Status value={question.status} size="sm" />
                      <span className="font-chassis text-chassis-sm text-ink-3">
                        {question.id}
                      </span>
                      {/* The record the question is waiting on an answer about. */}
                      {question.scope_id && RECORD_VIEWS[question.scope_type] ? (
                        <a
                          href={hrefFor(
                            RECORD_VIEWS[question.scope_type],
                            question.scope_id,
                          )}
                          className="rounded-sd-sm font-chassis text-chassis-sm text-signal underline underline-offset-2 hover:no-underline focus-ring"
                        >
                          About {question.scope_id}
                        </a>
                      ) : null}
                    </span>
                    {question.why_it_matters ? (
                      <span className="font-prose text-small text-ink-2 prose-measure">
                        Why it matters: {question.why_it_matters}
                      </span>
                    ) : null}
                    {question.recommendation ? (
                      <span className="font-prose text-small text-ink-2 prose-measure">
                        Recommended if unanswered: {question.recommendation}
                      </span>
                    ) : null}
                    {/*
                      The options are the half of section 8.4 that makes a
                      question answerable rather than merely stated. They used to
                      be folded into a read-only list, so somebody holding a
                      question with four worked-out options could read them here
                      and then had to retype one at a terminal. An open question
                      is now answerable where it is asked; an answered one shows
                      what was decided and stays quiet.
                    */}
                    {question.answer ? (
                      <span className="font-prose text-small text-ink-2 prose-measure">
                        Answered: {question.answer}
                      </span>
                    ) : (
                      <AnswerQuestion question={question} onAnswered={refresh} />
                    )}
                    {question.deferral_reason ? (
                      <span className="font-prose text-small text-ink-2 prose-measure">
                        {question.deferral_reason}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ListPanel>
        </div>
      </ViewBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Pieces
   --------------------------------------------------------------------------- */

/**
 * `items`, `assumptions` and `risks` are three windows onto the same table, so
 * the same concept can arrive more than once. The map draws each one once.
 */
function collectItems(data: DiscoveryPayload | null): DiscoveryItem[] {
  if (!data) return [];
  const byId = new Map<string, DiscoveryItem>();
  for (const item of [
    ...(data.items ?? []),
    ...(data.assumptions ?? []),
    ...(data.risks ?? []),
  ]) {
    if (!item || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function ListPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-sd-lg border border-rule bg-panel">
      <div className="flex flex-col gap-1 border-b border-rule px-4 py-3">
        <h3 className="font-prose text-title text-ink">{title}</h3>
        <p className="font-prose text-small text-ink-2 prose-measure">
          {description}
        </p>
      </div>
      <div className="px-4 py-1">{children}</div>
    </section>
  );
}

function buildDetail({
  item,
  typeStyles,
  source,
  relations,
  itemById,
  open,
  conversion,
  onConvert,
}: {
  item: DiscoveryItem;
  typeStyles: Record<string, TypeStyle>;
  source: SourceMaterial | null;
  relations: GraphRelation[];
  itemById: Map<string, DiscoveryItem>;
  open: (id: string) => void;
  conversion: Conversion | null;
  onConvert: (id: string, target: ConvertTarget) => void;
}): CanvasDetail {
  const style = typeStyles[item.kind];
  const evidence = titleCase(item.epistemic_status);

  // A converted concept records what it became. The shared contract type does
  // not name the two columns yet, so read them off the row the service sends.
  const { converted_type: convertedType, converted_id: convertedId } =
    item as DiscoveryItem & {
      converted_type?: string | null;
      converted_id?: string | null;
    };
  const convertedView = convertedType ? RECORD_VIEWS[convertedType] : undefined;

  const meaning =
    EVIDENCE_MEANING[item.epistemic_status.toLowerCase()] ??
    "This project uses a word for how much this can be trusted that the control center has no gloss for yet.";

  const linkItem = (id: string, relationship: string): DetailLinkItem | null => {
    const other = itemById.get(id);
    if (!other) return null;
    return {
      id: other.id,
      name: truncate(other.statement, 90),
      typeLabel: typeStyles[other.kind]?.label ?? titleCase(other.kind),
      status: other.status,
      relationship,
    };
  };

  const outgoing: DetailLinkItem[] = [];
  const incoming: DetailLinkItem[] = [];
  for (const relation of relations) {
    if (relation.from === item.id) {
      const entry = linkItem(relation.to, relation.kindLabel);
      if (entry) outgoing.push(entry);
    } else if (relation.to === item.id) {
      const entry = linkItem(relation.from, relation.kindLabel);
      if (entry) incoming.push(entry);
    }
  }

  return {
    title: truncate(item.statement, 120),
    identifier: `${style?.label ?? titleCase(item.kind)} ${item.id}`,
    description: style?.description,
    body: (
      <div className="flex flex-col">
        <DetailField label="What was said">{item.statement}</DetailField>

        <DetailField label="Status">
          <Status value={item.status} />
        </DetailField>

        <DetailField label="How much this can be trusted">
          <span>
            <span className="font-chassis text-chassis text-ink">{evidence}</span>
            . {meaning}
          </span>
        </DetailField>

        <DetailField label="Where it came from">
          {source ? (
            <span>
              {source.path_or_label} ({titleCase(source.source_type)})
              {source.supplied_by ? `, supplied by ${source.supplied_by}` : ""}
              <span title={absoluteTime(source.received_at)}>
                , received {relativeTime(source.received_at).toLowerCase()}
              </span>
              .
            </span>
          ) : (
            "No source material is recorded against this concept, so it was added directly rather than read out of something supplied."
          )}
        </DetailField>

        <DetailField label="Provenance">
          {item.provenance ??
            "Nothing further was recorded about how this concept was arrived at."}
        </DetailField>

        {item.accepted_at ? (
          <DetailField label="Accepted">
            <span title={absoluteTime(item.accepted_at)}>
              Accepted {relativeTime(item.accepted_at).toLowerCase()}. Whatever
              this was turned into keeps this concept as its origin, and the
              concept itself stays on the map.
            </span>
          </DetailField>
        ) : null}

        {convertedId ? (
          <DetailField label="What it became">
            {convertedView ? (
              <RecordLink
                name={`This concept is now a ${convertedType}`}
                id={convertedId}
                href={hrefFor(convertedView, convertedId)}
              />
            ) : (
              `This concept is now ${convertedType} ${convertedId}.`
            )}
          </DetailField>
        ) : null}

        <DetailField label="What it points to">
          <DetailLinks
            items={outgoing}
            onOpen={open}
            emptyText="No link has been drawn from this concept to another one yet."
          />
        </DetailField>

        <DetailField label="What points at it">
          <DetailLinks
            items={incoming}
            onOpen={open}
            emptyText="No other concept points at this one yet."
          />
        </DetailField>

        <DetailField label="Turning this into a product record">
          <p>
            Converting keeps the concept exactly where it is. The goal, module or
            feature that is created records this concept, its source and its
            provenance as its origin, so nothing is lost by accepting it.
          </p>
        </DetailField>
      </div>
    ),
    footer: (
      <div className="flex w-full flex-col items-start gap-2">
        {conversion ? (
          <p
            role="status"
            className={
              conversion.state === "failed"
                ? "font-prose text-small text-state-blocked"
                : conversion.state === "done"
                  ? "font-prose text-small text-state-complete"
                  : "font-prose text-small text-state-active"
            }
          >
            {conversion.message}
          </p>
        ) : null}
        {conversion?.created ? (
          <RecordLink
            name={`Open the new ${conversion.created.target}`}
            id={conversion.created.id}
            href={hrefFor(
              RECORD_VIEWS[conversion.created.target],
              conversion.created.id,
            )}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {CONVERT_TARGETS.map((entry) => (
            <Button
              key={entry.target}
              type="button"
              variant="outline"
              size="sm"
              disabled={conversion?.state === "working"}
              onClick={() => onConvert(item.id, entry.target)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      </div>
    ),
  };
}
