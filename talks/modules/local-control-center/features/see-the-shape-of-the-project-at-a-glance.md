<!-- superdev:generated source=FEAT-0101 revision=3752 hash=8bcc5fc9a505d0941c800af5d9e69ae636f7bbd07e32ad2d276baaf6562311c0 -->
# Feature: See the shape of the project at a glance

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Give the overview and discovery areas a visual reading of where the project stands, so somebody arriving understands it without reading seven prose sections in order
- **User:** Somebody opening the control centre who wants to know how the project is doing, and currently has to read seven stacked prose sections top to bottom to find out
- **User value:** Not recorded
- **Scope:** in: A compact visual reading of progress per component, task distribution, and activity over time, on the overview, A clearer discovery area that leads with what discovery found and what is still unanswered, Every figure carrying what it counts, so a bar is never the only reading; out: A dashboard of decorative charts, because a figure nobody can act on is noise that competes with the ones they can, A charting dependency, since the interface ships as one self-contained file and is already large
- **Affected contracts:** none linked

### Primary flow

1. Somebody opens the overview and sees progress, movement and what is blocked in one screen
2. Each reading names what it counts and links to the area that holds the detail
3. They read the prose only when they want the reasoning

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Every chart prints the fraction it represents, so the shape is never the only reading | Read each chart on a real project and confirm the numbers are beside it | Met | EV-0175 |
| State is carried by glyph and label as well as colour, and the signal colour never carries state | Check each segment has a label and that no state uses the ember token | Met | EV-0176 |
| The interface still ships as one self-contained file with no new dependency | Build it and check the bundle and the dependency list | Met | EV-0177 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | A project with nothing recorded shows what to record rather than an empty chart |
| Platform Variance | Applicable | Below tablet width the charts stack and stay readable rather than shrinking to illegibility |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Every figure prints the fraction beside the shape, and says so when there is nothing to measure | manual_check | pass | - |
| Every segment carries its label as text, and no state is tinted with the signal | manual_check | pass | - |
| One self-contained file, no new dependency, seven kilobytes larger | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
