<!-- superdev:generated source=PRJ-0001 revision=279 hash=510988512188ab95226b05b0f1e75798d4b7d0524d18f214e939fa6014b2b6e7 -->
# Superdev - Module Inventory

- **Status:** living registry, regenerated from the database.
- **Last verified:** see the generation marker at the top of this file.

## Modules

| Module | Purpose | Primary users | Owns | Status | Doc root |
|---|---|---|---|---|---|
| Discovery and Onboarding | Guides a new or existing product through structured interviews to establish product foundation, modules, features, workflows, and architecture, then produces an accepted product map before implementation starts. | none | none | Planned | modules/discovery-and-onboarding/module.md |
| Product Model and Orchestration | Owns the canonical product model (goals, milestones, modules, features, workflows, tasks and their relationships) and routes all product work through it and through specialist providers via the project skill. | none | none | Planned | modules/product-model-and-orchestration/module.md |
| Documentation Generation and Sync | Adapts the existing Docs skill to convert accepted database records into human-readable Markdown contracts, tracks revisions, detects manual edits as proposals, and keeps the database and documents from silently diverging. | none | none | Planned | modules/documentation-generation-and-sync/module.md |
| Task and Implementation Lifecycle | Creates, assigns, starts, blocks, verifies, completes, cancels, and reopens tasks and subtasks, enforcing that implementation only proceeds against an accepted feature and contract with satisfied dependencies. | none | none | Planned | modules/task-and-implementation-lifecycle/module.md |
| Decisions, Changes, and Questions | Records, supersedes, and applies architectural and product decisions, tracks accepted scope changes, and manages unresolved questions and their assumptions. | none | none | Planned | modules/decisions-changes-and-questions/module.md |
| Database and Persistence | Stores normalized project records, enforces data invariants such as one active assignment per task and immutable history, manages versioned migrations, backups, and portable export and import. | none | none | Planned | modules/database-and-persistence/module.md |
| Memory System | Captures, verifies, retrieves, and consolidates short-term and long-term memory such as decisions, learned facts, blockers, and handoffs, so context survives across sessions and agent handoffs. | none | none | Planned | modules/memory-system/module.md |
| Hooks and Session Continuity | Runs lifecycle hooks at session start, prompt submit, post tool use, pre compact, and session end to keep the active task, decisions, blockers, and next action current, with command-based fallback when hooks are unavailable. | none | none | Planned | modules/hooks-and-session-continuity/module.md |
| Local Control Center | A local UI reading live data from the database that presents overview, product map, tasks, architecture, decisions, evidence, memory, activity, and an interactive blueprint canvas, and supports creating and managing tasks directly. | none | none | Planned | modules/local-control-center/module.md |
| Provider Orchestration | Invokes specialist provider skills such as brainstorming, planning, TDD, debugging, code review, and frontend design for the smallest necessary context, screening and attributing their output before it becomes project truth. | none | none | Planned | modules/provider-orchestration/module.md |
| Packaging and Distribution | How Superdev is installed and shipped: the Claude Code plugin, the Codex plugin, the skills.sh standalone bundle, and what each of them must contain. Section 19 of the requirements document. | none | none | Planned | modules/packaging-and-distribution/module.md |

## Status rules

- `implemented` requires implementation parity to have been verified at least once.
- A deprecated module keeps its row and its doc root. History is never deleted.

## Deliberate exclusions

- None recorded.
