// What a lifecycle hook can actually drive, per harness, and what to run when it
// cannot. Brief section 12.6.
//
// This file exists because the failure it prevents is silent. A harness that
// looks like it is tracking work and is not leaves a project whose records stop
// matching reality without anyone being told. So every entry below states what
// was verified rather than what would be convenient, and every lifecycle point
// names the explicit command that achieves the same outcome with no hook at all.
//
// The governing rule: correctness never depends on a hook firing. A hook is an
// accelerator. The command is the contract.

/**
 * Events Superdev wires in hooks/hooks.json. Kept here so the matrix and the
 * wiring cannot drift apart: anything claimed as hook-driven below must appear
 * in this list.
 */
export const WIRED_EVENTS = [
  "SessionStart", "UserPromptSubmit", "PostToolUse", "PreCompact", "SessionEnd",
];

/**
 * Named in Claude Code's own event registry but deliberately not wired.
 * PreToolUse is omitted because Superdev never blocks a tool call: hooks here
 * are development automation, never a permission boundary, and paying a process
 * launch before every tool call buys nothing.
 */
export const AVAILABLE_BUT_UNWIRED = [
  { event: "PreToolUse", why: "Superdev never blocks or rewrites a tool call, so there is nothing for it to do." },
  { event: "Stop", why: "A completion nag is not verification. Completion runs through superdev task complete, which checks evidence." },
  { event: "SubagentStop", why: "Same as Stop, and a subagent shares the parent session's records." },
  { event: "Notification", why: "Nothing in the lifecycle depends on a notification." },
];

/**
 * Events referenced by earlier Superdev versions with no first-party source.
 * `PostToolBatch` was Superdev's only canonical-write path for a while, which
 * means that path may never have fired. Nothing may depend on it again.
 */
export const UNVERIFIED_EVENTS = [
  {
    event: "PostToolBatch",
    finding: "Not in Claude Code's documented event list (re-verified 2026-07-27, CLI 2.1.220). Found only in Superdev's own files and one third-party plugin.",
    consequence: "src/runtime/hooks.mjs still answers post-tool-batch so that a harness which does emit it behaves correctly, but hooks.json does not wire it and no lifecycle point is credited to it.",
  },
];

const HARNESSES = [
  {
    harness: "claude-code",
    mechanism: "hooks/hooks.json in the plugin, per-hook timeout field, loaded without further approval",
    hooks: "supported",
    note: "Lifecycle hooks fire. Superdev still verifies state from the database rather than trusting that a hook ran.",
  },
  {
    harness: "codex",
    mechanism: "hooks/hooks.json in a plugin is discovered, but each hook needs per-hook hash trust before it runs",
    hooks: "partial",
    note: "Only PreToolUse for shell commands has been verified to fire. No session-lifecycle event has been observed, and a freshly installed Superdev has no trusted hooks at all, so every lifecycle point below is treated as command-driven on Codex until a first-party source says otherwise.",
  },
  {
    harness: "skills-sh",
    mechanism: "none",
    hooks: "none",
    note: "skills.sh has no hook mechanism at all. There is nothing to install a hook into, so a Superdev skill installed there gets no session context, no dirty marking and no handoff persistence. Every lifecycle point is driven by an explicit command run by the orchestrator.",
  },
];

/**
 * Coverage states, strongest first.
 *
 * `hook`    the hook performs the work and the record is written without a person.
 * `prompt`  a hook can inject the requirement into context, but the work is a
 *           judgement call and the command still has to run. Reminding is not doing.
 * `command` no hook contributes anything. The command is the only path.
 */
const HOOK = (event, note) => ({ state: "hook", event, note });
const PROMPT = (event, note) => ({ state: "prompt", event, note });
const COMMAND = (note) => ({ state: "command", event: null, note });

const CODEX_UNTRUSTED =
  "Untrusted or unverified on Codex. Run the command.";
const SKILLS_NONE =
  "No hook mechanism exists here. Run the command.";

const codex = () => COMMAND(CODEX_UNTRUSTED);
const skills = () => COMMAND(SKILLS_NONE);

/** The sixteen points a tracked unit of work passes through. Brief 12.1 to 12.5. */
const LIFECYCLE = [
  {
    id: "session-start",
    point: "Session start",
    what: "Detect the root, verify the schema revision, identify developer, agent, branch and worktree, find any active assignment, and inject the context report.",
    command: "superdev resume",
    detail: "Prints the same report the hook injects and starts or rejoins the work session.",
    claudeCode: HOOK("SessionStart", "Runs on startup, resume, clear and compact."),
  },
  {
    id: "task-lookup",
    point: "Task lookup or creation",
    what: "Find an existing task for the requested work, or open a draft one.",
    command: "superdev task create",
    detail: "Search first with superdev status; create only when nothing matches.",
    claudeCode: PROMPT("UserPromptSubmit", "The hook can state the requirement, but matching a request to a task is judgement. No hook can do it."),
  },
  {
    id: "contract-mapping",
    point: "Feature and contract mapping",
    what: "Link the task to a feature and to a workflow step or contract, or mark it enabling against a named feature.",
    command: "superdev task update",
    detail: "A task with no contract link is refused at claim time with E_TASK_WITHOUT_CONTRACT, so this cannot be skipped quietly.",
    claudeCode: PROMPT("UserPromptSubmit", "The hook injects the rule. The link is a modelling decision and stays with the command."),
  },
  {
    id: "decision-check",
    point: "Decision check",
    what: "Read the accepted and time-boxed decisions that constrain this work before writing code.",
    command: "superdev resume",
    detail: "Governing decisions are part of the resume context; superdev status shows them project wide.",
    claudeCode: PROMPT("SessionStart", "Session start injects the decisions in force. Applying one to the work at hand is not hookable."),
  },
  {
    id: "claim",
    point: "Claim",
    what: "Take the task for this developer, agent, branch and session.",
    command: "superdev task claim",
    detail: "A partial unique index makes a second active claim impossible, hook or no hook.",
    claudeCode: COMMAND("No Claude Code event corresponds to taking ownership of work."),
  },
  {
    id: "start",
    point: "Start",
    what: "Move the claimed task to in progress and stamp started_at.",
    command: "superdev task update",
    detail: "Set the status to in_progress. The transition is written to status_history either way.",
    claudeCode: COMMAND("No event marks the moment implementation begins."),
  },
  {
    id: "activity",
    point: "Activity update",
    what: "Record meaningful progress at natural boundaries, and refresh branch HEAD and dirty state.",
    command: "superdev task update",
    detail: "Records one activity event with a summary a human would want to read.",
    claudeCode: HOOK("PostToolUse", "Fires after Write, Edit and NotebookEdit. It accumulates touched paths and appends at most one activity event per interval, never one per file."),
  },
  {
    id: "scope-change",
    point: "Scope-change correction",
    what: "When the work outgrows the accepted scope, update the specification first, then regenerate the task delta.",
    command: "superdev plan",
    detail: "Edit the feature, run superdev plan for the delta, then superdev task update to accept it. Never widen a task silently.",
    claudeCode: COMMAND("Detecting that work has left its accepted scope needs the specification, not a tool call."),
  },
  {
    id: "block",
    point: "Block and unblock",
    what: "Record a blocker the moment it appears, with a reason, and clear it when it is gone.",
    command: "superdev task block",
    detail: "Blocking needs a reason. Unblock with superdev task update by setting the status back to ready or in_progress.",
    claudeCode: COMMAND("A failing command is not a blocker. Only the agent knows which is which."),
  },
  {
    id: "verification",
    point: "Verification",
    what: "Run the product's required verification and attach the evidence to the task.",
    command: "superdev task update",
    detail: "Attach the evidence type, summary, reference and result. Completion reads this, so an unverified task cannot be completed.",
    claudeCode: COMMAND("A Stop hook could nag, which is not the same as verifying. It is deliberately not wired."),
  },
  {
    id: "completion",
    point: "Completion",
    what: "Complete the task, check acceptance criteria, mark changed contracts and recalculate parent progress.",
    command: "superdev task complete",
    detail: "Refuses on open subtasks (E_OPEN_SUBTASKS) or missing evidence, hook or no hook.",
    claudeCode: COMMAND("No event means done. Done is a claim that has to be checked against evidence."),
  },
  {
    id: "release",
    point: "Release",
    what: "Give up the claim so the task is available again.",
    command: "superdev task release",
    detail: "Needed mid-session. At session end the claim is released automatically by the session-end path.",
    claudeCode: HOOK("SessionEnd", "Only covers release at the end of a session. A mid-session release is command-only."),
  },
  {
    id: "compaction",
    point: "Compaction",
    what: "Persist objective, active task and feature, last verified result, branch and HEAD, decisions, blockers, scope changes, pending documentation and the exact next action before context is discarded.",
    command: "superdev task update",
    detail: "The command surface in brief 14.1 has no session-boundary verb. Record the outcome and next action on the active task, then call compactSession in src/runtime/session.mjs directly.",
    claudeCode: HOOK("PreCompact", "Writes the whole 12.5 packet to the database before the transcript is compacted."),
  },
  {
    id: "handoff",
    point: "Handoff",
    what: "Close the session with a note for whoever picks the work up, and release what it held.",
    command: "superdev task release",
    detail: "Release the claim and record the next action on the task. handoffSession in src/runtime/session.mjs writes the full packet when a named handoff is wanted.",
    claudeCode: HOOK("SessionEnd", "Persists the packet and releases the claim. A handoff addressed to a named person still needs the explicit call."),
  },
  {
    id: "resume",
    point: "Resume",
    what: "Rebuild working context for a new agent from records rather than from conversation.",
    command: "superdev resume",
    detail: "Reads everything from the database. It never needs a previous transcript.",
    claudeCode: HOOK("SessionStart", "Also fires with source compact, so context returns immediately after compaction."),
  },
  {
    id: "session-end",
    point: "Session end",
    what: "Close the session, write its outcome and next action, release assignments and mark the agent ended.",
    command: "superdev task release",
    detail: "Releases the claim. endSession in src/runtime/session.mjs closes the session record itself.",
    claudeCode: HOOK("SessionEnd", "Fires on clear, logout and normal exit. It is not guaranteed on a killed process, which is why nothing depends on it alone."),
  },
];

/**
 * The honest coverage matrix.
 *
 * Read it as: for this lifecycle point, on this harness, does a hook do the work
 * (`hook`), does a hook only remind (`prompt`), or is the command the only path
 * (`command`)? Every row carries a command, including the rows a hook covers,
 * because a hook that did not fire has to be indistinguishable from one that
 * never existed.
 */
export function harnessMatrix() {
  const lifecycle = LIFECYCLE.map((entry) => ({
    id: entry.id,
    point: entry.point,
    what: entry.what,
    fallback: { command: entry.command, detail: entry.detail },
    coverage: {
      "claude-code": entry.claudeCode,
      codex: codex(),
      "skills-sh": skills(),
    },
  }));

  return {
    rule: "Correctness must not depend solely on a hook firing. Every lifecycle point below names the explicit command that achieves the same thing when no hook is available, and the database is the authority in both cases.",
    harnesses: HARNESSES.map((h) => ({
      ...h,
      // Counted rather than asserted, so the headline can never claim more
      // coverage than the rows underneath it actually carry.
      hookDriven: lifecycle.filter((l) => l.coverage[h.harness].state === "hook").length,
      promptOnly: lifecycle.filter((l) => l.coverage[h.harness].state === "prompt").length,
      commandOnly: lifecycle.filter((l) => l.coverage[h.harness].state === "command").length,
      of: lifecycle.length,
    })),
    lifecycle,
    wiredEvents: WIRED_EVENTS,
    availableButUnwired: AVAILABLE_BUT_UNWIRED,
    unverifiedEvents: UNVERIFIED_EVENTS,
    gaps: [
      "Brief 14.1 lists no session-boundary command. Compaction, handoff and session end are hook-driven on Claude Code and are otherwise called directly through compactSession, handoffSession and endSession in src/runtime/session.mjs. Naming that here is better than implying a command that does not exist.",
      "Claim, start, verification and completion have no corresponding event on any harness. They are decisions, not observable side effects, so no hook could drive them honestly.",
      "Codex hook trust is per-hook and hash-based, so a Superdev upgrade invalidates it. Assume no Codex hook is running until the doctor reports otherwise.",
    ],
  };
}
