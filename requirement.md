# Your Product Name

<!--
This is the template to hand Superdev when you start a project:

    superdev init --brief requirement.md            # shows the plan, writes nothing
    superdev init --brief requirement.md --apply    # now it writes

Read this once before filling it in. Three things about it are worth knowing,
because they change what you get:

1. THE HEADINGS ARE NOT DECORATION. Superdev classifies what it reads by the
   heading it sits under. "## Features" becomes features; "## Constraints"
   becomes constraints. Rename a heading to something it does not recognise and
   the content under it is skipped rather than guessed at. The recognised names
   are listed against each section below.

2. NOTHING IS INVENTED TO FILL A GAP. A section you leave out becomes a recorded
   open question, not an assumption. That is deliberate: you will be asked, and
   the gap stays visible until somebody answers it. Leaving a section out is a
   valid choice, and better than writing something you do not mean.

3. WRITE STATEMENTS, NOT QUESTIONS. A line ending in a question mark is read as a
   prompt for content rather than as content, and skipped. So is a line that
   starts with "identify", "decide", "clarify" or "list". Say what is true, or
   leave it for the interview.

Delete these comments and every example before handing it over. Keep the
headings you use and delete the ones you do not.
-->

The one-sentence version, for somebody who has thirty seconds. What it is, who
uses it, and what it does for them.

## Problem

<!-- Recognised as: Problem, Pain, Motivation, Background, Why -->

What is wrong today, and for whom. Write it as the situation somebody is in
rather than as the feature you have in mind, because the feature is a guess at
the answer and this is the question.

If you cannot describe the problem without naming your solution, that is worth
noticing before anything is built.

## Users

<!-- Recognised as: Users, Personas, Audiences, Customers, Actors, Roles,
     Stakeholders, Who this is for, Target audience -->

Who uses this. One line each, saying what they are trying to get done.

- **Name the role.** What they want, in their words.
- **Another role.** What they want, and how it differs from the first.

Say if any of them must not see what another can. That single sentence decides
whether this product needs permissions, and finding out later is expensive.

## Goals

<!-- Recognised as: Goals, Outcomes, Objectives, Success criteria, Metrics -->

What counts as this having worked. Not features: outcomes.

A goal is worth writing if you could tell whether it happened. "People find
recipes faster" is not checkable. "A saved recipe is readable on the tablet in
the kitchen with no network" is.

- The outcome, and how you would know it happened.

## Features

<!-- Recognised as: Features, Capabilities, Functionality, What it does, Scope -->

What it must actually do. One bullet per feature, one sentence each, phrased as
something somebody can do.

- Save a recipe with its ingredients and steps.
- Read the previous shift's handover before service.
- Flag an item as out of stock so the next shift sees it first.

Keep these coarse. Superdev asks for the detail per feature afterwards, at a
depth it picks from the risk, so a fifty-bullet list here buys you nothing and
costs you an hour.

## Modules

<!-- Recognised as: Modules, Subsystems, Components -->

The major parts, if you already know them. Leave this out if you do not: it will
be derived from the features and you will be asked to confirm it.

- **Part name.** What it owns.

## Out of scope

<!-- Recognised as: Out of scope, Non-goals, Will not, Excluded, Exclusions -->

What this deliberately does not do. The most valuable section here, and the one
most often skipped.

Every line saves an argument later, and it is the only place where "we decided
not to" is distinguishable from "nobody thought of it".

- Importing from other applications.
- Sharing between accounts.

## Constraints

<!-- Recognised as: Constraints, Limitations, Must not, Requirements, Budget,
     Deadline -->

What the build has to live inside. Anything true regardless of design.

- Runs on a tablet in a kitchen, so touch targets are large and hands are wet.
- Works with no network connection.
- Must be usable by somebody who has never seen it, with no training.
- Ships by the end of the quarter.

## Assumptions

<!-- Recognised as: Assumptions -->

What you are taking as true without having checked. Writing one down is not a
weakness; it is what makes it reviewable when it turns out to be wrong.

- One person per account, so no sharing model is needed yet.
- Fewer than a hundred recipes, so search can be simple.

## Risks

<!-- Recognised as: Risks, Threats, Failure modes, Concerns -->

What could go wrong, and what it would cost.

- If the tablet is offline at the end of a shift, a note could be lost.

## Open questions

<!-- Recognised as: Open questions, Unknown, Undecided, To be decided, TBD -->

What you genuinely do not know yet. Put it here rather than guessing: it becomes
a recorded question with the work that depends on it attached, instead of an
assumption nobody remembers making.

- Should a note be editable after the shift ends?
- Does anybody other than the next shift need to read these?

---

## A complete example

Everything above, filled in, for a real small product. This is the whole brief.

```markdown
# Kitchen Handover

A tool for restaurant kitchens to hand over between shifts, so the incoming
chef knows what is prepped and what ran out without finding the outgoing chef.

## Problem

Handover happens verbally, at the busiest moment of the day, between two people
who overlap for about four minutes. What is prepped and what ran out gets lost,
so the incoming shift either duplicates prep or discovers a gap during service.

## Users

- **Outgoing chef.** Wants to record what happened in under a minute, at the end
  of a long shift, without leaving the kitchen.
- **Incoming chef.** Wants to know what to start first, before service begins.

## Goals

- An incoming chef can see the last handover within ten seconds of picking up
  the tablet.
- A handover takes under sixty seconds to record.

## Features

- Record a handover note at the end of a shift.
- Read the previous shift's handover.
- Flag an item as out of stock so the next shift sees it first.

## Out of scope

- Inventory counts and stock levels.
- Anything that needs a keyboard.
- Sharing between restaurants.

## Constraints

- Runs on one tablet mounted in the kitchen.
- Works with no network connection.
- Wet hands, so touch targets are large and there is no drag interaction.

## Assumptions

- One tablet per kitchen, so no account system is needed.
- Two shifts a day, so history stays small.

## Risks

- A note recorded and not saved before the tablet sleeps would be lost silently.

## Open questions

- Should a note be editable after the shift ends, or is it a record?
```

That brief produces three features, a project named from its own title, and the
questions it did not answer, recorded rather than assumed.

## What happens next

```bash
superdev init --brief requirement.md --apply
superdev status        # what was recorded, and what is still open
superdev question list # what it needs from you, with a recommendation each
superdev ui --apply    # see all of it
```

From there, each feature is specified to a depth Superdev picks from its risk,
accepted through a gate that refuses anything too thin to build, and turned into
tasks that cannot complete without evidence.
