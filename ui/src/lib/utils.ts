import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be told about this project's font-size tokens.
 *
 * `--text-chassis-sm` and friends are custom sizes, but tailwind-merge only
 * knows Tailwind's stock scale, so it filed every one of them under text-colour
 * and dropped whatever colour came earlier in the same `cn()` call. That is how
 * the primary button lost `text-signal-ink` to `text-chassis-sm` from its size
 * variant and ended up drawing near-white text on a light orange fill, 1.93:1,
 * in the dark theme.
 *
 * Keep this list in step with the `--text-*` tokens in index.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "title",
            "subtitle",
            "body",
            "small",
            "chassis",
            "chassis-sm",
            "label",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
