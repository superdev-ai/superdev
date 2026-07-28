<!-- superdev:generated source=FEAT-0066 revision=3021 hash=a57a047f2e52439bca453495b2166ea4dc3afe18371b5a13ba5e9d312917ce36 -->
# Feature: Search memory

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Find relevant memories by topic
- **User:** Someone returning to a project after time away wants to ask 'what do we know about X' and get back what was actually recorded, ranked by relevance, not a raw dump.
- **User value:** Not recorded
- **Scope:** in: Takes free-text search terms and returns matching memory entries ranked by a real lexical scorer combining term coverage, recency, and kind or status weighting, Supports narrowing by --kind, --task, and --feature flags, Defaults to returning at most 10 entries, overridable with --limit, Reports the count recalled and, per entry, its id, kind, recorded date, and a summary or content snippet; out: Does not do semantic or embedding-based search, matching is lexical (tokenize and score), so phrasing that shares no terms with a memory will not surface it, Does not write or update memory, this is a read-only recall path, Does not surface memories from other projects, it is scoped to the current project
- **Affected contracts:** none linked

### Primary flow

1. Run superdev memory search "<topic>"
2. Read the ranked list of recalled entries, most relevant first
3. Optionally narrow with --kind, --task, or --feature, or raise --limit for more results

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev memory search '<topic>' returns memories matching the topic, most relevant first | Run superdev memory search "<topic>" and record what was observed. | Met | EV-0104 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Data Migration States | Applicable | A project whose work sessions have never ended or compacted has zero rows in memory_entries, so every search returns the no-match message, not because search is broken but because nothing has been written to memory yet. |
| Empty States | Applicable | When nothing in memory_entries matches the search text, the command returns "Nothing recorded matches \"<text>\"." instead of an empty table or an error. |
| Invalid Input | Applicable | Calling the command with no search text at all is rejected with a usage error telling the caller to say what to look for, before any query runs. |
| Ordering | Applicable | Results are not returned in insertion order, they are reordered by the scorer's combined term-coverage, recency-half-life, and kind or status weighting, so the most relevant entry can outrank a more recent one. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:1777 cmdMemorySearch calls recall() -> src/memory/index.mjs:378 recallOn, a real lexical scorer (tokenize, term coverage, recency half-life, kind/status weighting at index.mjs:352-374), not a stub. Ran `node src/cli.mjs memory search "decision"`: correctly returned "Nothing recorded matches \"decision\"." because this project's memory_entries table is currently empty (0 rows per `db status --json`). The write side is real and wired: hooks/hooks.json registers PreCompact and SessionEnd hooks that run src/runtime/hooks.mjs preCompact/sessionEnd, which call src/runtime/session.mjs compactSession/endSession (session.mjs lines ~525 and ~544 insert memory_entry rows directly). This project's two work_sessions (SES-0001, SES-0002) have not yet ended or compacted, which is why the table is empty, not because the path is missing. | command | pass | superdev memory search "<topic>" |
| Retrieval measured against what section 15.12 requires, over 40 questions drawn from 79 memories: recall 0.85, precision 0.55, mean reciprocal rank 0.70, token reduction 0.98, latency 3.81 ms median and 5.68 ms worst, 1025 index terms over 79 memories. Resume and handoff accuracy are journeys rather than queries and say so rather than producing a number that is not a measurement. | command | pass | src/memory/benchmark.mjs |

## Delivery state

- **What works now:** Reached by superdev memory search "<topic>". src/cli.mjs:1777 cmdMemorySearch calls recall() -> src/memory/index.mjs:378 recallOn, a real lexical scorer (tokenize, term coverage, recency half-life, kind/status weighting at index.mjs:352-374), not a stub. Ran `node src/cli.mjs memory search "decision"`: correctly returned "Nothing recorded matches \"decision\"." because this project's memory_entries table is currently empty (0 rows per `db status --json`). The write side is real and wired: hooks/hooks.json registers PreCompact and SessionEnd hooks that run src/runtime/hooks.mjs preCompact/sessionEnd, which call src/runtime/session.mjs compactSession/endSession (session.mjs lines ~525 and ~544 insert memory_entry rows directly). This project's two work_sessions (SES-0001, SES-0002) have not yet ended or compacted, which is why the table is empty, not because the path is missing.
- **What remains:** Nothing known.
- **Next action:** Not recorded
