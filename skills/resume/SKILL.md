---
name: resume
description: Rebuild working context from the Superdev database after a break, a new session, a handoff, or a compaction. Use for "continue where we left off", "pick up yesterday's work", "resume", "what was I doing?", or at the start of any session where a lifecycle hook did not run. Loads the active task, its feature and contract, governing decisions, blockers, pending documentation proposals and the recorded next action, searches local memory for the session outcome and handoff, verifies all of it against the live repository, and proposes the exact next action. Reads from records rather than from a memory of the previous conversation.
---

# Resume

The next agent resumes from the database, not from the conversation. Anything
you cannot trace to a record or to live repository evidence is a guess, and it
gets labeled as one.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Recall from earlier sessions

Superdev's own memory is the authority: `SD memory search "<what you are looking
for>"` reads what earlier sessions recorded, with the provenance of each entry.

**claude-mem** is a recall cache on top of that, not a second authority. When it is
ready, use it to find prior work faster; when `SD doctor` says it is not, say that
cross-session recall was unavailable and proceed from the project record and the
session summaries alone. Never treat what it returns as the record: if the two
disagree, the database is right.

## Steps

1. **Load the handoff.** `SD resume --json`. It carries the current objective,
   the active task and feature, the last verified result, branch and HEAD,
   decisions encountered, blockers, scope changes, pending documentation
   updates, and the exact next action.
2. **Load the surrounding state.** `SD status --json` for progress and open
   work. `SD task show <TASK-id>` for the active task's contract links,
   dependencies, activity and evidence.
3. **Search memory for context the records do not carry.**
   `SD memory search "<topic>"` returns session outcomes, facts,
   blockers, questions and handoffs, with their links. Memory is recall, not
   authority: verify a recalled fact against the current specification,
   decision, code or evidence before acting on it, and say which check you ran.
4. **Verify against live reality.** Does HEAD match what the record says was
   verified? Are the files a completion claimed present? Did anything change
   outside Superdev (new commits, dirty worktree, a dependency bump)? Report
   every discrepancy as drift. Never reconcile it silently.
5. **Check what accumulated while you were away.** `SD docs diff` for pending
   proposals, blocked tasks, and owner questions answered or still open.
6. **Reconstruct the working frame** out loud: objective, active task, the
   contract it implements, the decisions that govern it, what is blocked, and
   what verification the task requires.
7. **Propose the next action**: the recorded one, revalidated. If it no longer
   applies, say why and propose the corrected step.
8. **Confirm before implementing** when anything material drifted since the
   record was written.

## If there is no active assignment

Do not invent one. Report what the project's next action is, offer the ready
work from `SD task list --status ready`, and let the person choose. Then run the
before-implementation sequence from the `task` skill before touching code.

## Harness reality

- On Claude Code, the session-start hook already shows the active task. Running
  `SD resume` is still correct; it is cheap and it is the same source.
- On Codex, hooks fire only if the user has trusted them, so assume they did
  not and run `SD resume` explicitly.
- On skills.sh there is no lifecycle hook at all. `SD resume` is the only way
  the context arrives.

Correctness never depends on a hook having fired. Say which command you ran.

## Providers

Claude Mem, when installed, may supplement recall of earlier conversations. It
is a cache and never project authority: every recalled fact is verified against
the database or the repository before consequential use, and recall-sourced
claims carry their verification status. If it is not installed, resume from the
database alone and say so. Do not credit it when it did not run.

## Boundaries

- Read only until the person confirms the resumed direction.
- Everything asserted must trace to a named record or a named piece of live
  evidence. Fresh-session accuracy is this skill's whole job.
- Never reconstruct state by re-reading old conversation summaries when a record
  exists that answers the same question.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
