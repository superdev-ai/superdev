import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sd font-chassis transition-colors duration-[120ms] ease-sd focus-ring disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-signal text-signal-ink border border-signal hover:bg-signal/90",
        outline:
          "border border-rule-strong bg-panel text-ink hover:bg-inset hover:border-rule-strong",
        secondary: "border border-rule bg-inset text-ink hover:bg-panel-raised",
        ghost: "text-ink-2 hover:bg-inset hover:text-ink",
        destructive:
          "border border-state-blocked bg-state-blocked-wash text-state-blocked hover:bg-state-blocked hover:text-panel",
        link: "text-signal underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-8 px-3 text-chassis",
        sm: "h-7 px-2.5 text-chassis-sm",
        lg: "h-10 px-4 text-chassis",
        icon: "size-8",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
