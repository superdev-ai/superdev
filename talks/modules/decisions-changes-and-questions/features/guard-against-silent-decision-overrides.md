<!-- superdev:generated source=FEAT-0079 revision=2943 hash=761ac5fce96ce57ea86668d68d691b466aab3a9abc1d46e428f642fefe620ff6 -->
# Feature: Guard against silent decision overrides

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Decisions, Changes, and Questions
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0003 Always-answerable project state, GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Ask for confirmation when a request contradicts an accepted decision
- **User:** A team lead who accepted a decision wants any later request that would quietly contradict it to be flagged, so a decision is not overridden by an unrelated request months later without anyone noticing.
- **User value:** Not recorded
- **Scope:** in: Runs on the same prompt submit hook, in parallel with the missing task check, Matches shared subject words between the prompt and the title and text of every accepted or time boxed decision, Surfaces up to three matching decisions, naming their id, title and text, when at least two subject words overlap, Tells the reader to check whether the request agrees with the decision, and to supersede rather than edit around it; out: Does not determine whether the request actually contradicts the decision, only that it shares the same subject, Does not block the prompt or supersede the decision automatically, Does not match on decisions that are proposed, rejected or superseded, only accepted or time boxed ones count
- **Affected contracts:** none linked

### Primary flow

1. User submits a prompt naming a subject an accepted decision covers
2. Hook strips stopwords and extracts subject words from the prompt and from each decision's title and text
3. Decisions sharing two or more subject words are ranked and the top three are kept
4. A warning is injected naming each decision and its text, with instruction to check agreement or run decision supersede

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A prompt contradicting an accepted decision triggers a confirmation request before proceeding | Do it through the surface a person would use and record what was observed. | Met | EV-0011 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | Exactly one shared subject word between prompt and decision is treated as coincidence and produces no warning, the floor is two shared words. |
| Duplication | Applicable | When more than three decisions match, only the three with the most shared words are shown, so the warning stays short rather than listing every decision in a broad subject area. |
| Empty States | Applicable | A prompt shorter than 12 characters is skipped entirely, since too short a prompt cannot carry enough real subject words to match safely. |
| Ordering | Applicable | This check runs even on prompts classified as questions, since a decision already in force is worth surfacing even when the phrasing reads as a question rather than a command. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A prompt proposing direct schema push surfaced DEC-0002, which forbids exactly that, naming the decision and telling the reader to supersede it rather than edit around it. This is acceptance criterion 11 of section 22 and nothing implemented it before. | command | pass | src/runtime/hooks.mjs decisionsInTheWay |
| A prompt proposing direct schema push surfaced DEC-0002, which forbids exactly that, naming the decision and telling the reader to supersede it rather than edit around it. This is acceptance criterion 11 of section 22 and nothing implemented it before. | command | pass | src/runtime/hooks.mjs decisionsInTheWay |

## Delivery state

- **What works now:** Reached by the user prompt submit hook. A prompt proposing direct schema push surfaced DEC-0002, which forbids exactly that, naming the decision and telling the reader to supersede rather than edit around it. Silent when no decision covers the subject: a prompt about storing secrets in memory produced no warning because no decision mentions either.
- **What remains:** Nothing known.
- **Next action:** Not recorded
