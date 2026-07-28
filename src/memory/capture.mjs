// Capture memory from the events worth remembering.
//
// Section 15.6 lists when capture should happen: task start, task completion,
// decision acceptance and supersession, blocker creation and resolution, a
// failed approach, successful verification, session handoff, documentation
// acceptance, material product change. remember() existed and nothing called
// it, so after a night of work the memory system held nothing and section 12.8's
// memory show and memory verify had nothing to show or verify.
//
// What is captured is deliberately narrow. Section 15.2 says memory must avoid
// storing an agent's own unverified output as fact, so an outcome is only
// recorded when evidence backs it, and its epistemic status says which: a
// completion with passing evidence is confirmed, everything else is inferred.
//
// Capture is idempotent because section 15.6 requires it. Every entry carries a
// dedupe key built from the event it came from, so a hook that fires twice, a
// retried command and a replayed session all produce one memory.

import { remember, linkMemory } from "./index.mjs";
import { query } from "../db/store.mjs";

/** What each lifecycle moment becomes, in the vocabulary the schema allows. */
const KIND = {
  task_completed: "outcome",
  task_blocked: "blocker",
  task_unblocked: "outcome",
  decision_recorded: "decision",
  decision_superseded: "decision",
  verification_passed: "outcome",
  verification_failed: "learned_fact",
  question_answered: "learned_fact",
  change_recorded: "learned_fact",
  assumption_recorded: "unresolved_question",
};

/**
 * Record one moment, once.
 *
 * Failure never propagates. Memory is recall, not authority, and losing a
 * recall entry must not fail the work that produced it: a task that completed
 * has completed whether or not anything remembered it.
 */
export async function capture(root, event = {}) {
  try {
    const kind = KIND[event.type];
    if (!kind) return null;
    const title = String(event.title ?? "").trim();
    const content = String(event.content ?? "").trim();
    if (!title || !content) return null;

    const entry = await remember(root, {
      kind,
      title: title.slice(0, 200),
      content: content.slice(0, 2000),
      // Confirmed only when something was observed. An agent saying a thing
      // happened is inferred, and section 15.2 forbids treating that as fact.
      epistemicStatus: event.confirmed ? "confirmed" : "inferred",
      sourceRef: event.sourceRef ?? null,
      // The event identity, not the wording. Two different observations can be
      // worded alike and collapsing those would lose real information.
      dedupeKey: event.dedupeKey ?? `${event.type}:${event.subjectId ?? title}`,
      taskId: event.taskId ?? null,
      featureId: event.featureId ?? null,
      sessionId: event.sessionId ?? null,
    });

    // Section 15.4 says long-term memory must use stable links to the records
    // it concerns, and 14.2 says a memory link cannot reference a missing one.
    for (const link of event.links ?? []) {
      if (!link?.type || !link?.id) continue;
      await linkMemory(root, entry.id, link.type, link.id, link.relationship ?? "concerns").catch(() => {});
    }
    return entry;
  } catch {
    return null;
  }
}

/**
 * Sweep the activity trail for moments that were never remembered.
 *
 * Capture is wired into the lifecycle from here on, but a project that ran
 * before it existed has a history full of moments and no memory of any of them.
 * This reads that history and records what it finds, which is also the recovery
 * path if capture is ever switched off and back on.
 *
 * Only events that carry a claim are taken. An activity trail holds every file
 * touch and every regeneration, and remembering those would bury the handful of
 * things worth recalling.
 */
export async function captureFromHistory(root, { limit = 500, apply = false } = {}) {
  const events = await query(root, (db) => db.all(
    `SELECT e.*, t.name AS task_name, t.status AS task_status
       FROM activity_events e
       LEFT JOIN tasks t ON t.id = e.task_id
      WHERE e.event_type IN ('task_completed', 'task_blocked', 'decision_recorded',
                             'verification_attached', 'question_answered', 'scope_changed')
      ORDER BY e.sequence DESC LIMIT ?`, limit));

  const worth = [];
  for (const e of events) {
    const summary = String(e.summary ?? "");
    if (e.event_type === "verification_attached" && !/^Passing/.test(summary)) continue;
    // A scope change is only worth remembering when it says what moved, and
    // most of them are routine record writes during setup.
    if (e.event_type === "scope_changed" && !/decision|superseded|cancelled|removed/i.test(summary)) continue;
    worth.push(e);
  }

  const plan = { found: events.length, worthRemembering: worth.length, recorded: 0 };
  if (!apply) return plan;

  for (const e of worth) {
    const type = e.event_type === "verification_attached" ? "verification_passed" : e.event_type;
    const made = await capture(root, {
      type,
      title: String(e.summary ?? "").slice(0, 120),
      content: String(e.summary ?? ""),
      // Read from the trail rather than asserted now: the event is the record
      // that it happened, which is what makes this confirmed rather than
      // inferred.
      confirmed: type === "verification_passed" || type === "task_completed",
      sourceRef: e.id,
      dedupeKey: `event:${e.id}`,
      taskId: e.task_id ?? null,
      featureId: e.feature_id ?? null,
      links: [
        e.task_id ? { type: "task", id: e.task_id } : null,
        e.feature_id ? { type: "feature", id: e.feature_id } : null,
      ].filter(Boolean),
    });
    if (made) plan.recorded += 1;
  }
  return plan;
}
