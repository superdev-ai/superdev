/**
 * The layout vocabulary shared by the Product and Features views.
 *
 * Panels butt together and divide with hairlines, values are chassis, sentences
 * are prose, and every list that can be empty carries the words that explain
 * why. See DESIGN_DIRECTION.md sections 4, 8 and 9.
 */

import type * as React from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Status } from "@/components/shell/status";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";

/* ---------------------------------------------------------------------------
   Panel
   --------------------------------------------------------------------------- */

export function Panel({
  id,
  title,
  /** A chassis reading beside the title, e.g. "12 features". */
  count,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  id?: string;
  title: React.ReactNode;
  count?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "flex min-w-0 flex-col rounded-sd-lg border border-rule bg-panel focus-ring",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-rule px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3
              id={id ? `${id}-title` : undefined}
              className="font-prose text-title text-ink"
            >
              {title}
            </h3>
            {count ? (
              <span className="font-chassis text-chassis-sm text-ink-3">
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          // Not shrink-0: a filter bar wide enough to overflow a phone has to be
          // allowed to shrink and wrap, or it pushes the page sideways and the
          // last control is clipped where nobody can reach it.
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </header>
      <div className={cn("min-w-0", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

/** A hairline-divided run of sub-blocks inside one panel body. */
export function PanelRows({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col divide-y divide-rule", className)}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Words
   --------------------------------------------------------------------------- */

/**
 * A stored sentence, or the reason there is not one. Never renders a blank
 * region and never renders the word "None" on its own.
 */
export function Prose({
  value,
  fallback,
  className,
}: {
  value: string | null | undefined;
  /** What it means that this is absent, and what would fill it. */
  fallback: string;
  className?: string;
}) {
  const missing = !value || value.trim().length === 0;
  // Recorded prose is Markdown in practice: identifiers in backticks, the odd
  // list, an emphasised clause. Rendering it as a bare string showed people the
  // punctuation instead of the meaning. The fallback is this interface's own
  // sentence, so it stays a plain paragraph.
  if (missing) {
    return (
      <p className={cn("font-prose text-body text-ink-3 prose-measure", className)}>
        {fallback}
      </p>
    );
  }
  return <Markdown className={cn("text-ink-2", className)}>{value}</Markdown>;
}

/** A labelled reading. The label is chassis, the value is whatever it is. */
export function Fact({
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
      <div className="min-w-0 font-chassis text-chassis text-ink">
        {children}
      </div>
    </div>
  );
}

/** A row of labelled readings that wraps rather than scrolls. */
export function Facts({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <Fact key={item.label} label={item.label}>
          {item.value}
        </Fact>
      ))}
    </div>
  );
}

/** A stored list, or the reason the list is empty. */
export function Bullets({
  items,
  empty,
  className,
}: {
  items: (string | null | undefined)[] | null | undefined;
  /** What it means that nothing is listed here. */
  empty: string;
  className?: string;
}) {
  const clean = (items ?? []).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  if (clean.length === 0) {
    return (
      <p className={cn("font-prose text-small text-ink-3 prose-measure", className)}>
        {empty}
      </p>
    );
  }
  return (
    <ul
      className={cn(
        "flex list-disc flex-col gap-1 pl-5 font-prose text-body text-ink-2 marker:text-ink-3 prose-measure",
        className,
      )}
    >
      {clean.map((item, index) => (
        <li key={`${index}-${item}`}>
          {/* Stored text, so it carries the same Markdown the record was written in. */}
          <Markdown measure={false}>{item}</Markdown>
        </li>
      ))}
    </ul>
  );
}

/**
 * Plain language first, the identifier second. The identifier is struck through
 * when the record is superseded, because a strike on the name would read as the
 * work being cancelled rather than replaced.
 */
export function RecordName({
  name,
  id,
  href,
  superseded,
  className,
}: {
  name: string;
  id: string;
  href?: string;
  superseded?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="truncate font-prose text-subtitle text-ink">{name}</span>
      <span
        className={cn(
          "shrink-0 font-chassis text-chassis-sm text-ink-3",
          superseded && "line-through",
        )}
      >
        {id}
      </span>
    </>
  );

  if (!href) {
    return (
      <span className={cn("flex min-w-0 items-baseline gap-2", className)}>
        {body}
      </span>
    );
  }
  return (
    <a
      href={href}
      className={cn(
        "flex min-w-0 items-baseline gap-2 rounded-sd hover:text-signal focus-ring",
        className,
      )}
    >
      {body}
    </a>
  );
}

/**
 * Moves to another region of the same page.
 *
 * It cannot be an anchor: the address bar carries the route, so writing a
 * fragment into it would send the person back to the overview. This scrolls and
 * moves focus instead, and respects a reduced-motion preference.
 */
export function JumpLink({
  targetId,
  children,
  className,
}: {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const target = document.getElementById(targetId);
        if (!target) return;
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        target.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
        target.focus({ preventScroll: true });
      }}
      className={cn(
        "rounded-sd text-left underline decoration-rule-strong underline-offset-4 hover:text-signal hover:decoration-signal focus-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A cross-reference to another record, in the same plain-language-first order. */
export function RecordLink({
  name,
  id,
  href,
  className,
}: {
  name: string;
  id: string;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex max-w-full items-baseline gap-1.5 rounded-sd-sm text-ink hover:text-signal focus-ring",
        className,
      )}
    >
      <span className="truncate font-prose text-body">{name}</span>
      <span className="shrink-0 font-chassis text-chassis-sm text-ink-3">
        {id}
      </span>
    </a>
  );
}

/**
 * A list of cross-references, or a sentence saying there are none and what that
 * means. Used everywhere one record points at several others.
 */
export function RecordLinks({
  items,
  empty,
  className,
}: {
  items: { id: string; name: string; href: string }[];
  empty: string;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={cn("font-prose text-small text-ink-3 prose-measure", className)}>
        {empty}
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <RecordLink name={item.name} id={item.id} href={item.href} />
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
   Data grid
   --------------------------------------------------------------------------- */

export interface Column<T> {
  key: string;
  /** Title Case column label, shown as a header wide and as a field label narrow. */
  label: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Right aligned, for a column of counts. */
  numeric?: boolean;
  /** True for the column that identifies the record: it leads the narrow card. */
  lead?: boolean;
}

/**
 * One record set, two shapes: a dense table from 768px up, and a stacked list
 * of labelled fields below it, so a narrow screen never scrolls sideways.
 */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  selectedKey,
  blocked,
  caption,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** The record currently selected, marked with a label as well as a tint. */
  selectedKey?: string | null;
  /** Rows that are stopped, given a hatch as well as their status chip. */
  blocked?: (row: T) => boolean;
  /** What the table contains, read out to assistive technology. */
  caption: string;
  /** Shown in place of the rows, saying why there are none. */
  empty: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0) {
    return <div className={cn("p-4", className)}>{empty}</div>;
  }

  const lead = columns.find((column) => column.lead) ?? columns[0];
  const rest = columns.filter((column) => column !== lead);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  scope="col"
                  className={cn(
                    column.numeric && "text-right",
                    column.className,
                  )}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const key = rowKey(row);
              const isSelected = selectedKey === key;
              const isBlocked = blocked?.(row) ?? false;
              return (
                <TableRow key={key} data-selected={isSelected || undefined}>
                  {columns.map((column, index) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "py-1.5 align-top",
                        index === 0 && "relative",
                        column.numeric && "text-right",
                        column.className,
                      )}
                    >
                      {index === 0 && isBlocked ? (
                        <span
                          aria-hidden="true"
                          className="hatch-blocked pointer-events-none absolute inset-0 text-state-blocked"
                        />
                      ) : null}
                      {index === 0 && isSelected ? (
                        <span className="sr-only">Selected. </span>
                      ) : null}
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul
        aria-label={caption}
        className="flex flex-col divide-y divide-rule md:hidden"
      >
        {rows.map((row) => {
          const key = rowKey(row);
          const isSelected = selectedKey === key;
          return (
            <li
              key={key}
              className={cn(
                "flex flex-col gap-2 px-4 py-3",
                isSelected && "bg-signal-wash shadow-[inset_2px_0_0_var(--sd-signal)]",
              )}
            >
              {isSelected ? <span className="sr-only">Selected.</span> : null}
              <div className="min-w-0">{lead.cell(row)}</div>
              <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                {rest.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className="font-chassis text-label text-ink-3 uppercase">
                      {column.label}
                    </dt>
                    <dd className="min-w-0 font-chassis text-chassis-sm text-ink-2">
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A status chip plus, when there is one, the reason behind it. Views pass the
 * raw stored value; the chip supplies the glyph, the Title Case label and the
 * colour together.
 */
export function StatusCell({
  value,
  detail,
}: {
  value: string | null | undefined;
  detail?: string | null;
}) {
  return (
    <span className="flex flex-col gap-1">
      <Status value={value} size="sm" />
      {detail ? (
        <span className="font-prose text-small text-ink-3">{detail}</span>
      ) : null}
    </span>
  );
}
