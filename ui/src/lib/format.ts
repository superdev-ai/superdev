/**
 * Formatting helpers that enforce principles II and III of DESIGN_DIRECTION.md:
 * every number declares what it counts, and plain language leads.
 *
 * Views should never build a count string by hand. Use `countPhrase`, `ofPhrase`
 * or `progressPhrase` so the phrasing stays identical everywhere.
 */

import type { Progress } from "@/types";

/** The exact words used wherever a value cannot honestly be measured. */
export const NOT_MEASURABLE = "Not measurable";

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "so",
  "the",
  "to",
  "up",
  "via",
  "vs",
  "with",
  "yet",
]);

/** Words whose casing the product owns, so they survive title casing intact. */
const PRESERVED: Record<string, string> = {
  api: "API",
  apis: "APIs",
  ui: "UI",
  ux: "UX",
  id: "ID",
  ids: "IDs",
  url: "URL",
  urls: "URLs",
  http: "HTTP",
  sql: "SQL",
  nfr: "NFR",
  nfrs: "NFRs",
  er: "ER",
  ci: "CI",
  cd: "CD",
  seo: "SEO",
  qa: "QA",
  sse: "SSE",
};

/**
 * Human-facing statuses are Title Case. Accepts snake_case, kebab-case, camel
 * case or an ordinary sentence, and returns something a person can read.
 */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (PRESERVED[lower]) return PRESERVED[lower];
      if (index > 0 && index < words.length - 1 && SMALL_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Sentence case, for explanation copy built from a stored value. */
export function sentenceCase(value: string | null | undefined): string {
  if (!value) return "";
  const flat = value.replace(/[_-]+/g, " ").trim();
  return flat.charAt(0).toUpperCase() + flat.slice(1).toLowerCase();
}

/** Naive but adequate pluralisation for the count helpers. */
export function plural(count: number, singular: string, many?: string): string {
  if (count === 1) return singular;
  if (many) return many;
  if (/(s|x|z|ch|sh)$/i.test(singular)) return `${singular}es`;
  if (/[^aeiou]y$/i.test(singular)) return `${singular.slice(0, -1)}ies`;
  return `${singular}s`;
}

/** `3 features`, `1 feature`. A number never appears without its unit. */
export function countPhrase(
  count: number,
  singular: string,
  many?: string,
): string {
  return `${formatNumber(count)} ${plural(count, singular, many)}`;
}

/** Words after which the noun has already been named, so nothing later is it. */
const PREPOSITIONS = new Set([
  "of", "in", "on", "at", "to", "for", "from", "by", "per",
  "across", "within", "under", "over", "against", "this", "the",
]);

/**
 * Pluralise the head noun of a unit phrase, leaving the rest alone.
 *
 * `delivery item` becomes `delivery items`; `feature across this module`
 * becomes `features across this module`, never `feature across this modules`.
 */
function pluralHead(count: number, unit: string): string {
  const words = unit.split(" ");
  if (words.length === 1) return plural(count, unit);
  let head = words.length - 1;
  for (let i = 0; i < words.length; i += 1) {
    if (PREPOSITIONS.has(words[i].toLowerCase())) {
      head = i - 1;
      break;
    }
  }
  if (head < 0) return unit;
  return words.map((w, i) => (i === head ? plural(count, w) : w)).join(" ");
}

/** `7 of 12 acceptance criteria met`. */
export function ofPhrase(
  completed: number,
  total: number,
  unit: string,
  qualifier?: string,
): string {
  // Pluralise the head noun, not the last word. Skipping every multi word unit
  // was too blunt: all six units the service sends are phrases, so nothing was
  // ever pluralised and every meter read "0 of 5 delivery item". Taking the
  // last word instead turned "feature across this module" into "...this
  // modules". The head is the word before the first preposition, or the last
  // word when there is none.
  const noun = pluralHead(total, unit);

  // The same phrases often end in their own qualifier ("exit conditions met"),
  // and appending it again produced "exit conditions met met".
  const tail =
    qualifier && !noun.toLowerCase().endsWith(qualifier.toLowerCase())
      ? ` ${qualifier}`
      : "";

  return `${formatNumber(completed)} of ${formatNumber(total)} ${noun}${tail}`;
}

/**
 * The single phrasing for a Progress value. Returns "Not measurable" whenever
 * there is no completion contract, never a zero percentage.
 */
export function progressPhrase(
  progress: Progress | null | undefined,
  qualifier = "met",
): string {
  if (!progress || !progress.measurable || progress.total <= 0) {
    return NOT_MEASURABLE;
  }
  return ofPhrase(
    progress.completed,
    progress.total,
    progress.counts,
    qualifier,
  );
}

/**
 * The reason a value is not measurable, for the tooltip or helper line beside
 * `Not measurable`. Never leave the phrase standing on its own.
 */
export function notMeasurable(
  what = "This record",
  because = "no completion criteria have been defined for it yet",
): { label: string; explanation: string } {
  return {
    label: NOT_MEASURABLE,
    explanation: `${what} has no measurable progress because ${because}.`,
  };
}

/** True when a Progress value may be drawn as a meter at all. */
export function isMeasurable(progress: Progress | null | undefined): boolean {
  return Boolean(progress && progress.measurable && progress.total > 0);
}

/**
 * A fraction between 0 and 1, or null when the value is not measurable. Callers
 * must render `Not measurable` for null rather than substituting zero.
 */
export function progressFraction(
  progress: Progress | null | undefined,
): number | null {
  if (!isMeasurable(progress)) return null;
  const value = progress!.completed / progress!.total;
  return Math.min(1, Math.max(0, value));
}

const NUMBER_FORMAT = new Intl.NumberFormat(undefined);

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

const UNITS: [limit: number, seconds: number, unit: Intl.RelativeTimeFormatUnit][] =
  [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86_400, 3600, "hour"],
    [604_800, 86_400, "day"],
    [2_629_800, 604_800, "week"],
    [31_557_600, 2_629_800, "month"],
    [Number.POSITIVE_INFINITY, 31_557_600, "year"],
  ];

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

/**
 * `4 minutes ago`, `in 2 days`, `just now`. Pair it with `absoluteTime` in a
 * title attribute so the exact value is always one hover away.
 */
export function relativeTime(
  value: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  const time = toTime(value);
  if (time === null) return "Never";
  const deltaSeconds = (time - now) / 1000;
  const magnitude = Math.abs(deltaSeconds);
  if (magnitude < 45) return "Just now";
  for (const [limit, divisor, unit] of UNITS) {
    if (magnitude < limit) {
      return RELATIVE_FORMAT.format(Math.round(deltaSeconds / divisor), unit);
    }
  }
  return "Never";
}

const ABSOLUTE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_ONLY_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

/** A stored calendar date with no time of day, e.g. a milestone target date. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY.test(value);
}

export function absoluteTime(
  value: string | number | Date | null | undefined,
): string {
  const time = toTime(value);
  if (time === null) return "No time recorded";
  // A target date has no time of day. Printing "5:30 AM" beside one invents a
  // precision the project record does not hold.
  return isDateOnly(value)
    ? DATE_ONLY_FORMAT.format(time)
    : ABSOLUTE_FORMAT.format(time);
}

/** Both readings at once, for a cell that shows one and reveals the other. */
export function timeReading(value: string | number | Date | null | undefined) {
  return { relative: relativeTime(value), absolute: absoluteTime(value) };
}

/** `2 minutes` as a duration, for estimates and elapsed time. */
export function durationPhrase(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unknown";
  if (seconds < 60) return countPhrase(Math.round(seconds), "second");
  if (seconds < 3600) return countPhrase(Math.round(seconds / 60), "minute");
  if (seconds < 86_400) return countPhrase(Math.round(seconds / 3600), "hour");
  return countPhrase(Math.round(seconds / 86_400), "day");
}

function toTime(value: string | number | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  // "2026-08-14" is parsed by the platform as UTC midnight, which renders as
  // the previous day everywhere west of Greenwich. A calendar date means the
  // same day whoever reads it, so it is anchored to local midnight instead.
  if (isDateOnly(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Joins a list into readable prose: `a, b and c`. Used in explanations so lists
 * do not appear as raw comma-separated machine values.
 */
export function listPhrase(items: string[], conjunction = "and"): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} ${conjunction} ${clean.at(-1)}`;
}

/** Cuts prose to a length without cutting mid-word. */
export function truncate(value: string, max = 140): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}...`;
}


/**
 * An exit condition, whichever shape it is stored in.
 *
 * These were plain strings until a condition needed to record whether it was
 * met, because conditionCounts can only count one as done when it carries a met
 * flag. Changing the shape without changing the three places that rendered it
 * put objects where React expected text and blanked the whole control centre.
 *
 * Both shapes are accepted here rather than migrated, because a project created
 * before the change still holds strings and would otherwise render nothing.
 */
export interface ExitCondition {
  condition: string;
  met: boolean | null;
  reading: string | null;
  /** The command that can decide this condition again, when one can. */
  check: string | null;
}

export function exitConditions(
  raw: unknown,
): ExitCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): ExitCondition | null => {
      if (typeof entry === "string") {
        return entry.trim() ? { condition: entry, met: null, reading: null, check: null } : null;
      }
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        const condition = typeof row.condition === "string" ? row.condition : String(row.condition ?? "");
        if (!condition.trim()) return null;
        return {
          condition,
          met: typeof row.met === "boolean" ? row.met : null,
          reading: typeof row.reading === "string" ? row.reading : null,
          check: typeof row.check === "string" ? row.check : null,
        };
      }
      return null;
    })
    .filter((x): x is ExitCondition => x !== null);
}
