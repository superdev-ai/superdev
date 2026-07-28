import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Prose in, prose out: a textarea holds sentences a person wrote, so it is set
 * in the prose face rather than the chassis face.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-sd border border-rule bg-inset px-2.5 py-2 font-prose text-body text-ink transition-colors duration-[120ms] ease-sd focus-ring",
        "field-sizing-content resize-y placeholder:text-ink-3 focus-visible:border-rule-strong",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:border-state-blocked aria-invalid:bg-state-blocked-wash",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
