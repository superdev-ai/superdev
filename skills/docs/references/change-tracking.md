# Change Tracking, Impact, Sync, Drift, and Indexes

Always on. Documentation catches up with accepted changes **before the next unrelated task begins**; the only alternative is a tracked deferral (a visible pending-sync entry), never silence. Completion claims with required sync missing are refused.

## Contents
1. The seven-step protocol
2. Code-edit triggers
3. Change classes → minimum artifacts
4. Silent-edit exceptions
5. Drift taxonomy and reporting
6. Indexes
7. Deferred engine boundary

## 1. The seven-step protocol (every accepted mutation)

1. **Identify** what changed (actual diff, not intention).
2. **Classify** the change (table below).
3. **Confirm** material sibling updates with the user before making them.
4. **Rewrite** the affected current-state artifacts (mark drift where intent and code now disagree - never silently pick a side).
5. **Record** the change: one coherent change entry (fields per the shared project record, `${CLAUDE_PLUGIN_ROOT}/references/project-record.md` §6).
6. **Escalate to a decision record** when the change is architectural (crosses a system-design seam: new datastore, tenancy, external dependency, public contract, security model).
7. **Re-verify:** links resolve; parity holds for touched specs; version/freshness markers updated.

## 2. Code-edit triggers

The profile's ownership map (index or adapter) maps code paths → owning artifacts. On any code edit - the agent's, the user's, or co-edits - walk the changed paths against the map. "No doc impact" is a valid outcome **only after walking the map**, never a default. Bulk refactors and migrations are walked once as a set, with one coherent change entry.

## 3. Change classes → minimum affected artifacts

| Class | Minimum artifacts |
|---|---|
| behavior addition | feature spec (accepted, right depth) · action/state inventory if UI · test plan · change entry |
| behavior change | spec delta · affected inventories · change entry |
| behavior removal | spec status update (removed, not erased) · inventories · change entry |
| bug fix | change entry; spec/docs only if intended behavior or operations changed |
| refactor | change entry; ownership map if paths moved |
| dependency | decision record (or reminder of the declining decision) · stack slot · change entry |
| schema/migration | data/schema doc · migration note · affected API docs · change entry |
| API contract | API doc · consumers notified in docs · versioning note · change entry |
| UI interaction | action/state inventory · acceptance tests · change entry |
| security/privacy | roles/permissions matrices · compliance doc if regime-relevant · change entry |
| operations | observability/runbook content · change entry |
| documentation-only | change entry (docs are artifacts too) |
| decision-only | decision record · decision index · change entry |

## 4. Silent-edit exceptions (the only two)

Typo fixes and user-facing copy corrections that change no meaning may be applied directly - and still appear in the next checkpoint's change entry. Everything else follows the protocol.

## 5. Drift taxonomy and reporting

`code-ahead-of-spec` · `spec-ahead-of-code` · `stale-current-state-prose` · `legitimate-historical-reference` · `missing-ownership` · `broken-cross-reference` · `unverified-assumption` · `implementation-defect` · `unknown`.

Drift reports (template `assets/templates/change-impact-drift-report.md`) list each item with class, evidence (both sides), and the resolution owner (code, docs, or decision). Documentation drift is never reported as runtime failure, nor vice versa. Contradictions stay visible until resolved.

## 6. Indexes

Generated views (module inventory rollups, decision index, ownership rollups) are rebuildable, regeneration-marked, and never hand-edited. Update the affected index at the checkpoint; full rebuilds are the recovery path.

## 7. Engine commands

Durable writes go through the database, reached by the `superdev` command.
Record what moved in accepted scope with
`superdev change record --summary <what> --reason <why> --apply`, which names the
records it moved and is refused without a reason. The activity trail behind it is
append only, enforced by database triggers rather than by convention, and
screening refuses a secret-shaped value before it can be stored. Regenerate the
Markdown with `superdev docs generate --apply`. Generated files are never
hand-edited: an edit becomes a proposal, read with `superdev docs diff` and taken
in with `superdev docs accept`.
