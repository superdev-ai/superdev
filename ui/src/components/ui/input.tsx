import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-sd border border-rule bg-inset px-2.5 font-chassis text-chassis text-ink transition-colors duration-[120ms] ease-sd focus-ring",
        "placeholder:text-ink-3 focus-visible:border-rule-strong",
        "file:mr-2 file:border-0 file:bg-transparent file:font-chassis file:text-chassis-sm file:text-ink-2",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:border-state-blocked aria-invalid:bg-state-blocked-wash",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
