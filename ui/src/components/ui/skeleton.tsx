import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A skeleton is a placeholder for a shape, never an explanation. It is always
 * used inside the Loading state from components/shell/states.tsx, which carries
 * the words saying what is being fetched and what to do if it does not arrive.
 * A skeleton on its own, with no accompanying text, is a defect.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-sd-sm bg-inset motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
