import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The thumb travels and the track fills, so the state is carried by position as
 * well as colour. Always pair a switch with a visible label; the on and off
 * readings must be legible without seeing the accent.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-rule-strong transition-colors duration-[120ms] ease-sd focus-ring",
        "data-[state=checked]:border-signal data-[state=checked]:bg-signal data-[state=unchecked]:bg-inset",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3.5 rounded-full bg-panel ring-1 ring-rule-strong transition-transform duration-[120ms] ease-sd",
          "data-[state=checked]:translate-x-[15px] data-[state=checked]:ring-signal data-[state=unchecked]:translate-x-[1px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
