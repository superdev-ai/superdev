import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Operator density: 28px rows, chassis face, tabular numerals, hairline rules
 * and no zebra striping. See DESIGN_DIRECTION.md section 8.
 *
 * The wrapper scrolls sideways on its own so the page body never does. Below
 * 768px a table should be replaced by a stacked list rather than scrolled.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-collapse font-chassis text-chassis-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "sticky top-0 z-10 bg-panel-raised [&_tr]:border-b [&_tr]:border-rule-strong",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-rule-strong bg-panel-raised font-medium",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-rule transition-colors duration-[120ms] ease-sd hover:bg-inset",
        "data-[selected=true]:bg-signal-wash data-[selected=true]:shadow-[inset_2px_0_0_var(--sd-signal)]",
        "focus-visible:bg-signal-wash focus-visible:shadow-[inset_2px_0_0_var(--sd-signal)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-7 px-3 text-left align-middle font-chassis text-label whitespace-nowrap text-ink-3 uppercase",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-px",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-7 px-3 align-middle text-ink-2",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-px",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-2 font-prose text-small text-ink-3", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
