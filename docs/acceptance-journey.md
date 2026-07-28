# Acceptance journey

What this records: one disposable product built end to end with Superdev, on
2026-07-27, on darwin arm64 with Node 22.23.1, entirely offline. The product was
a reading list application called Readlist, created outside this repository in a
temporary directory and deleted afterwards. Nothing from it is committed here.

This exists because the brief refuses self-issued proof. A count of validators
passing says only that the validators ran. What follows is the sixteen steps of
brief section 18.3, each with what actually happened, including the four defects
the journey found in Superdev itself.

## The sixteen steps

| # | Step | Outcome |
|---|------|---------|
| 1 | Initialize from a plain-language idea | `init` from one sentence produced a project, 51 capability areas, 21 task categories, 10 material questions, 9 discovery items and 3 documents |
| 2 | Brainstorming and discovery | 10 questions raised and answered through `question answer`; discovery items recorded with provenance |
| 3 | Store foundations, goals, milestones, modules, features | Goal, module and feature created from discovery items through the service write surface |
| 4 | Generate Markdown from the database | 14 documents written under `talks/`, each carrying a generation marker |
| 5 | Generate workflows, APIs, data, UI actions, tasks | Workflow with 2 steps, 1 data entity, 2 surfaces, 2 acceptance criteria, 2 edge cases; `derive` produced 5 tasks |
| 6 | Start the local control center | Started on 127.0.0.1:4317, instance token held locally and not printed |
| 7 | Claim a task from an agent session | Claimed with resolved identity; developer, agent, branch and session recorded |
| 8 | Observe developer, agent, branch, task, activity | All five present in `resume` and in the read model |
| 9 | Change scope, observe specification and task deltas | Adding one surface caused `derive` to create exactly 1 task and leave the 5 existing ones, including in-flight work, untouched |
| 10 | Complete a task with evidence | Refused with no evidence, naming the outstanding requirement; accepted once passing evidence existed |
| 11 | Observe parent progress update live | Feature progress moved to 11 percent of 19 contract items, with a nine-line breakdown of what counts |
| 12 | Interrupt and resume from database memory | `resume` reconstructed project, session, developer, agent and recent scope changes, stating it read from the database and not from conversation |
| 13 | Edit generated Markdown, get a reviewable proposal | The hand edit became a proposal; regeneration left the file alone and said so; `docs reject` restored the generated text |
| 14 | Back up, migrate, export, restore, compare | Backup, export, then restore: project identity and every row count identical afterwards, with the replaced database kept |
| 15 | Shut down and restart services | Stopped, restarted on the same port, records intact |
| 16 | Run with no cloud credentials or external services | Every step above ran with no credential configured and no outbound request |

## Gates that refused, which is the point

- **Spec depth.** `feature accept` refused a feature declared at standard depth
  while 9 of the 11 things that depth promises were missing, and named all nine
  in one refusal rather than sending the person back nine times. It accepted the
  same feature once the specification was real.
- **Evidence.** `task complete` refused a task stating one verification
  requirement and carrying zero passing results, and named the requirement.
- **Status transition.** A task in `ready` could not jump to `complete`, and the
  refusal listed the states it could reach.
- **Live database.** `db restore` refused while the control centre held the
  database open, naming the port and the command that frees it.
- **Unknown column.** Writing a misspelled column threw `E_UNKNOWN_COLUMN` with
  the table and the offending names, rather than silently dropping the value.
- **Schema constraints.** CHECK constraints refused an invalid applicability, an
  invalid requirement status and an invalid evidence status.

## Defects this journey found in Superdev

These were found by using the product, not by reading it, and all four are fixed.

1. **A foreign key violation was reported as a phantom competing claim.**
   `task claim` caught any error whose message contained "constraint" and told
   the person the task "was claimed by another session a moment before this
   claim. Pick up another task." The real cause was an unknown developer. Two
   fixes: the catch now only treats a uniqueness failure as a lost race, and
   only when re-reading the assignment table actually finds a holder; and the
   claim now checks each identifier up front and says which one does not exist.
2. **The progress bar recomputed its own percentage.** The service applies an
   honest rule, never 100 while anything is outstanding, and the bar rounded
   again from raw counts, so it could fill completely while its own caption read
   99 percent. The bar now uses the value the service computed.
3. **`Progress.stale` was sent by the service and missing from the interface
   type**, so no meter could show that its number came from records that had
   since moved. The field is typed and shown.
4. **The documentation report disagreed with its own count**, reporting "1 file
   were already correct".

## What was not proven here

- Real trackpad, pinch and touch gestures. Wheel behaviour was measured; pinch
  was not.
- Actual screen reader output. Accessible names, roles, states and screen
  reader text were verified in the DOM, not through VoiceOver or NVDA.
- Data shapes this canary never produced: runtime pieces, sync peers, conflicts,
  handoffs, multi-developer presence.
- Cloud synchronisation, which is not built and is not claimed.

## Reproducing it

Every step used the ordinary command surface (`init`, `question answer`,
`derive`, `task claim`, `task complete`, `docs generate`, `docs diff`,
`docs reject`, `db backup`, `db restore`, `export`, `start`, `stop`, `restart`,
`resume`, `status`) or the service write surface the control centre itself uses.
Nothing needed a private helper, and no test harness or fixture project was
committed, per ADR-0019 and brief section 18.3.
