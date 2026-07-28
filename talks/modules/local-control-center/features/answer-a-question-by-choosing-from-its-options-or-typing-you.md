<!-- superdev:generated source=FEAT-0095 revision=3298 hash=076e3d1ae1fad92946c57b7ef35e84d7157c897570a3ac00b5dd084883cb370c -->
# Feature: Answer a question by choosing from its options or typing your own

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Make an open question answerable in the control centre, with its options offered, the recommended one tagged and explained, and a free-text answer always available
- **User:** Somebody reading an open question who has to decide it, and who currently sees the options as a folded list of prose with no way to answer at all
- **User value:** Not recorded
- **Scope:** in: Options offered as choices, single or multiple according to what the question needs, A free-text option, always present, so a real answer is never forced into a preset one, A Recommended tag on the recommended option, with why it is recommended, Answering from the control centre, through the existing mutation path, The same option list available from the command line, so the two surfaces agree; out: Generating options with a language model, because a question's options are part of its recorded definition, Changing what happens when a question is deferred, which already records a reversible assumption
- **Affected contracts:** none linked

### Primary flow

1. An open question is shown with its options
2. The recommended option carries a tag and the reason it is recommended
3. The reader selects one option, or several where the question allows it, or types their own answer
4. The answer is recorded through the mutation path, and the capability area it belongs to is settled

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A question offers its options with the recommended one tagged and explained | Open the discovery area of the control centre against a project with open questions | Met | EV-0138 |
| A question that takes one answer refuses several, and one that takes several accepts them | Post question.answer with two selections against each kind and read the refusal and the record | Met | EV-0139 |
| A typed answer is accepted when no option fits | Answer a question with free text and read it back on the question | Met | EV-0140 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | An option that is not one of the question's own is refused, and an empty answer is refused |
| State Machine Violations | Applicable | A question already answered is refused rather than answered twice |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| The API carries each question's options, select mode, recommended options and why, and the control centre renders them as choices | manual_check | pass | - |
| One-answer questions refuse several options; many-answer questions accept them | manual_check | pass | - |
| A typed answer is accepted alone or alongside an option, and the right half of it reaches the project field | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
