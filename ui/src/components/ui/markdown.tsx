/**
 * The one place Markdown becomes elements.
 *
 * Record text arrives from the database as plain strings that are frequently
 * Markdown in practice: a purpose with `backticked` identifiers, a list of
 * scope items, a paragraph with emphasis. Rendering those into a bare span
 * showed the punctuation instead of the meaning.
 *
 * Streamdown does the parsing. It is hardened by default, which matters because
 * this text is written by agents and by people editing generated files, so it is
 * not trusted input even though it is local: rehype-sanitize is on, raw HTML is
 * filtered, and link targets are constrained.
 */
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

export function Markdown({
  children,
  className,
  measure = true,
}: {
  children: string | null | undefined;
  className?: string;
  /** Keep the 68ch reading measure. Turn it off inside a narrow column. */
  measure?: boolean;
}) {
  if (!children?.trim()) return null;
  return (
    <div
      className={cn(
        "font-prose text-body text-ink-2",
        // The project's own type scale rather than the library's defaults, so a
        // rendered paragraph sits on the same rhythm as the text beside it.
        "[&_p]:my-0 [&_p+p]:mt-2",
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_code]:rounded-sd-sm [&_code]:bg-inset [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-chassis [&_code]:text-chassis-sm",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-sd-sm [&_pre]:bg-inset [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_strong]:font-semibold [&_strong]:text-ink",
        "[&_a]:text-signal [&_a]:underline [&_a]:underline-offset-2",
        "[&_h1]:font-chassis [&_h2]:font-chassis [&_h3]:font-chassis",
        "[&_h1]:text-title [&_h2]:text-body [&_h3]:text-body [&_h2]:mt-3 [&_h3]:mt-3",
        "[&_table]:w-full [&_table]:text-small [&_th]:text-left [&_th]:font-chassis",
        "[&_td]:border-t [&_td]:border-rule [&_td]:py-1 [&_th]:py-1",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-3",
        measure && "prose-measure",
        className,
      )}
    >
      <Streamdown
        parseIncompleteMarkdown={false}
        shikiTheme={["github-light", "github-dark"]}
      >
        {children}
      </Streamdown>
    </div>
  );
}
