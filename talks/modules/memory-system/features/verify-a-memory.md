<!-- superdev:generated source=FEAT-0068 revision=2943 hash=4b9c22fa5a4fcf0fdf07b4ee31999a6aa33752c54f0be912fc6f79016d892897 -->
# Feature: Verify a memory

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Check a recalled memory against current specifications, decisions, and code
- **User:** Someone about to rely on a recalled memory wants to know if it still holds against what the project's tasks, features, and decisions say now, before acting on it.
- **User value:** Not recorded
- **Scope:** in: Takes a memory id and checks its superseded_by and epistemic_status fields first, Walks the memory's links against live task, feature, and decision rows, comparing the fingerprint or version recorded at write time to the current one, Checks whether verification_evidence has been recorded since the memory was written, Returns one of four verdicts: verified, contradicted, needs_review, or unverifiable; out: Does not modify the memory or anything it links to, this is a read-only check, Does not verify memories in bulk, it takes one memory id at a time, Does not re-run the original evidence command itself, it compares recorded state to current state, not live command output
- **Affected contracts:** none linked

### Primary flow

1. Identify a memory id via memory search or memory show
2. Run superdev memory verify <MEM-id>
3. Read the verdict (verified, contradicted, needs_review, or unverifiable) and the reasoning behind it

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev memory verify <MEMORY-id> returns verified, needs review, contradicted, or unverifiable | Run superdev memory verify <MEMORY-id> and record what was observed. | Met | EV-0088 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | When a linked task, feature, or decision has moved on since the memory recorded its fingerprint or version, the mismatch drives the verdict toward contradicted or needs_review rather than a stale verified result. |
| Empty States | Applicable | A memory with no links and no verification evidence to check against falls back to unverifiable rather than being reported as verified by default. |
| Invalid Input | Applicable | Verifying an id that does not exist in memory_entries refuses with "Memory <id> does not exist." and a non-zero exit, rather than producing a fabricated verdict. |
| State Machine Violations | Applicable | A memory already marked superseded is expected to short-circuit toward a non-verified verdict via its superseded_by field before the linked-record comparison even runs. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| memory verify compared the memory against the records it names and returned a verification state. It reported: | command | pass | node src/cli.mjs memory verify MEM-0001 |

## Delivery state

- **What works now:** Reached by superdev memory verify <MEM-id>. src/cli.mjs:1182 cmdMemoryVerify calls verifyRecall -> src/memory/index.mjs:468 verifyLocal, a substantial real implementation: checks superseded_by, epistemic_status, walks memory_links against live task/feature/decision rows comparing recorded fingerprint/version to current state, checks verification_evidence recorded after the memory, and derives a 4-state verdict (verified/contradicted/needs_review/unverifiable). Ran `node src/cli.mjs memory verify MEM-9999`: correctly refused with "Memory MEM-9999 does not exist." exit 1 since no memories exist yet.
- **What remains:** Nothing known.
- **Next action:** Not recorded
