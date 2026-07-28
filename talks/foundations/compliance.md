<!-- superdev:generated source=PRJ-0001 revision=3142 hash=419a646554b6c8f91ffa944758209ba44b14b537b27c6eb50f69894ad5e6f869 -->
# Superdev - Compliance

- **Status:** Active
- **Declared regimes:** none declared
- **Last verified:** see the generation marker at the top of this file.

Regimes are only ever declared by a recorded decision. None is inferred from geography or vertical.

## Regulated data inventory

| Entity.field | Class | Modules touching it |
|---|---|---|
| ui_actions.keyboard | secret | Local Control Center |
| developers.display_name | personal | Task and Implementation Lifecycle |
| verification_evidence.content_hash | secret | Task and Implementation Lifecycle |
| decisions.body_hash | secret | Decisions, Changes, and Questions |
| decision_transitions.immutable_hash | secret | Hooks and Session Continuity |
| activity_events.immutable_hash | secret | Hooks and Session Continuity |
| documents.generated_hash | secret | Documentation Generation and Sync |
| documents.manual_hash | secret | Documentation Generation and Sync |
| memory_entries.dedupe_key | secret | Memory System |
| memory_entries.content_hash | secret | Memory System |
| memory_embeddings.content_hash | secret | Memory System |

## Handling rules

No handling rules recorded.

## Gaps (open items)

| Gap | Risk | Owner decision needed |
|---|---|---|
| Compliance | No regulated data is handled. The product stores a project record on the developer's own machine and transmits nothing, so no regime applies. This changes the moment cloud synchronization is built, which is one reason DEC-TBD-008 has to be answered first. | No regulated data is handled. The product stores a project record on the developer's own machine and transmits nothing, so no regime applies. This changes the moment cloud synchronization is built, which is one reason DEC-TBD-008 has to be answered first. |
