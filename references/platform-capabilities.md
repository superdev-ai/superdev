# Platform Capability Matrix

Verified against installed CLIs and primary documentation on **2026-07-27**. Re-verify before each release; versions below are evidence, not permanent requirements.

## Claude Code hook event registry (re-verified 2026-07-27, CLI 2.1.220)

The events named by the official `plugin-dev` skill are: `PreToolUse`,
`PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`,
`UserPromptSubmit`, `PreCompact`, `Notification`.

`PostToolBatch` is **not** in that list. A search of every installed plugin
found it only in Superdev's own files and in one third-party plugin, with no
first-party documentation anywhere. Superdev previously routed its single
canonical-write path through `PostToolBatch`, which means that path may never
have fired. Nothing may depend on it. It is treated as unverified until a
first-party source names it.

`FileChanged` was listed here previously on the same weak basis and has been
removed for the same reason.

Per-hook `timeout` is a documented field in `hooks.json`, so the execution
budget is set by the plugin rather than being undocumented.

| Capability | Claude Code 2.1.218 | Codex CLI 0.144.1 | skills CLI 1.5.20 (Agent Skills spec) |
|---|---|---|---|
| Manifest | `.claude-plugin/plugin.json` (only `name` required) | `.codex-plugin/plugin.json` (no formal published schema; `name`/`version`/`description`/component paths observed) | `SKILL.md` frontmatter only |
| Skills | `skills/<name>/SKILL.md`, namespaced `/plugin:skill` | `skills/` dir supported; `@plugin` mentions | `<dir>/SKILL.md`; `name` must equal dir name; `description` ≤ 1024 chars |
| Agents | `agents/*.md` (no hooks/mcpServers/permissionMode in plugin agents) | `agents/` supported | Not applicable |
| Hooks | `hooks/hooks.json`; verified event set above; per-hook `timeout` field; blocks on `permissionDecision: "deny"` | `hooks/hooks.json` in a plugin IS discovered (verified 2026-07-25 from live `[hooks.state]` trust keys of the form `<plugin>@<marketplace>:hooks/hooks.json:<event>:0:0`); **per-hook hash trust required**; **`PreToolUse` runs for SHELL COMMANDS ONLY** and blocks only on `permissionDecision: "deny"`, legacy `decision: "block"`, or **exit code 2** | Not applicable |
| MCP | `.mcp.json` at plugin root | `.mcp.json` supported | Not applicable |
| Plugin dependencies | **Native**: `dependencies` in plugin.json - verified 2026-07-25 against `claude plugin validate --strict` as a STRING ARRAY of marketplace-qualified ids (`["superpowers@claude-plugins-official"]`); an object array `[{name,version}]` also validates, `{name:{...}}` does NOT, and `allowCrossMarketplaceDependenciesOn` is a MARKETPLACE field that --strict rejects inside plugin.json. Semver ranges, git tag convention `{plugin}--v{version}` | No dependency mechanism verified | None. `compatibility` frontmatter is free text; no skill-to-skill dependencies |
| Marketplace | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json`; also consumes Claude-format marketplaces (observed, not formally documented) | skills.sh registry / git sources |
| Validation | `claude plugin validate [path] [--strict]` | No dedicated validator verified; load test via local marketplace add | **No validate command in the CLI**; `skills-ref validate` from the reference library is the validator |
| Local testing | `claude --plugin-dir <path>` (+ `.zip`), `/reload-plugins` | `codex plugin marketplace add <local>` → `codex plugin add <name>@<mkt>` | `npx skills add <local-path>` |
| Install cache | `~/.claude/plugins/cache/<mkt>/<plugin>/<version>/` - **copied**, external paths break | `~/.codex/plugins/cache/…` - same copy semantics | canonical `~/.agents/skills/` (or project `.agents/skills/`) + per-agent symlinks |
| Persistent data | `${CLAUDE_PLUGIN_DATA}` | Not verified | Not applicable |

## Degradation rules (truthful, never silent)

- **Codex hooks:** activation requires per-hook trust approval (hash-based), so a freshly installed Superdev gets no lifecycle automation on Codex until the developer trusts the hook. Superdev never depends on hooks firing for correctness; the explicit `status` / `sync` / `resume` workflows cover the gap, and the doctor reports hook trust state.
- **Codex hook events are shell-only (verified 2026-07-25).** Codex runs tool hooks for shell commands, not for file-edit tools, so Superdev's post-change dirty marking does not fire there. Nothing depends on it: `project status` re-derives everything from canonical records, and the record engine's root confinement and symlink rejection run inside the engines regardless of hooks.
- **Hooks are development convenience, never a permission boundary.** Superdev's hooks inject session context, mark the projection stale after a write, perform one bounded derived-view refresh after a Claude tool batch edits canonical project records, and prompt for continuity before a session or context ends. They never block a tool call. Destructive, outward-facing and irreversible actions are governed by the harness's own permission model.
- **skills.sh has no hook mechanism at all.** A Superdev skill installed through skills.sh gets **no** session-context injection and **no** dirty marking - there is nothing to install them into. That surface is documented as manual: ask for project status at the start and end of a session; it reconciles from canonical records either way. Absence of automation is stated rather than implied, because a user who believes something is running when it is not is worse off than one who knows it is not.
- **Codex validation:** absent a dedicated validator, the evidence is an isolated-home marketplace add + plugin add + list; reported as such, never as "validated" in the Claude sense.
- **skills.sh standalone installs:** a single Superdev skill installed standalone lacks the plugin's shared `references/`. Standalone capability is narrowed and states its plugin dependency until per-skill packaging is finalized.
- **skills.sh consent:** setup flows name exact skills and never use bulk or confirmation-skipping flags (`--all`, `-y`, `--yes`). **This binds relayed commands too.** A command Superdev quotes for the operator to run is a command Superdev is recommending: if a registry listing, a provider's output, or a README supplies an install line carrying `-y`, strip the flag before surfacing it and let the confirmation prompt happen. Passing the flag along because "the source said so" hands the user a paste-ready way to skip the confirmation this rule exists to preserve.
- **Session hooks (all platforms):** never perform network installs; fail non-destructively; stay root-confined.

## Known ambiguities (tracked)

Codex plugin.json required-field set is inferred from examples, not a published schema; Codex tolerance of Claude-format marketplaces is observed behavior; skills CLI lockfile (`skills-lock.json`) is experimental and undocumented; `PostToolBatch` has no first-party source and is treated as not existing.
