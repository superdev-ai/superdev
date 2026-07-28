# Cited Markdown Project Summary

Produce a complete, honest summary of what a project is and does - from evidence, with citations, without creating any file unless asked.

## Method

1. **Read before writing:** repository instructions, manifests/configs, entry points, routing/module structure, schema sources, tests, existing docs (via the profile adapter), and `talks/` records if present.
2. **Summarize in layers:** what it is (one paragraph) · who uses it (roles) · what it does (capability map by module/area) · how it is built (stack from evidence) · how it runs (entry points, environments - names only, never secret values) · state of the project (tests, docs freshness, known drift) · open questions.
3. **Cite every load-bearing claim** with its source path (`file`, or `file:line` for specifics). Claims from docs that code contradicts are reported as `Contradicted` with both sources - never silently reconciled.
4. **Label:** code-derived claims are Confirmed; structure-derived interpretations are Inferred and marked; gaps are Unknown, listed, not papered over.
5. **Separate drift:** a "docs vs code" section lists disagreements found while summarizing, by drift class (`change-tracking.md` taxonomy) - the summary itself stays descriptive.
6. **Write a file only when requested**, to the exact requested path, using `assets/templates/project-summary.md`; otherwise deliver in-conversation.

## Refusals

- No invented capabilities: if evidence is thin, the summary says what could not be established.
- No secret values, ever - variable names and presence only.
- Recall (memory plugins, prior summaries) may point at things to check, never substitute for checking.
