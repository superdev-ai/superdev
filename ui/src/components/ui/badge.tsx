import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A badge never carries a record's status on its own: use the Status component
 * for that, which adds a glyph and a plain-language label. This is for counts,
 * categories, tags and identifiers.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-sd-sm border px-1.5 py-0.5 font-chassis text-chassis-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "border-rule bg-inset text-ink-2",
        outline: "border-rule bg-transparent text-ink-2",
        signal: "border-signal-edge bg-signal-wash text-signal",
        solid: "border-signal bg-signal text-signal-ink",
        identifier:
          "border-transparent bg-transparent px-0 text-ink-3 tracking-[0.04em]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
