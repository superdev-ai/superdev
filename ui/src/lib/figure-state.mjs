// Which of the six state tokens a status reads as.
//
// Kept as plain JavaScript rather than inside the component, for one reason: it is
// the only part of a chart that can be wrong in a way a reader cannot see. A bar at
// the wrong length is obvious; a finished thing tinted as blocked is not, and the
// person looking has no way to tell. So it is asserted, and node's test runner
// cannot import a .tsx file.
//
// DESIGN_DIRECTION section 7 defines the six states and section 2 forbids the
// signal colour from carrying any of them. Anything unrecognised falls to idle,
// never to complete: an unknown status must not read as finished.

/** @typedef {"complete" | "active" | "attention" | "blocked" | "idle" | "retired"} FigureState */

const COMPLETE = ["complete", "verified", "specified", "met", "accepted", "passed"];
const ACTIVE = ["in_progress", "in_review", "verifying", "live", "active"];
// Distinct from blocked on purpose. At risk is not stopped, and colouring them
// alike overstates every one of them.
const ATTENTION = ["at_risk", "awaiting_decision", "stale", "reconnecting", "unmet"];
const BLOCKED = ["blocked", "failed", "conflict", "offline"];
const RETIRED = ["superseded", "deprecated", "deferred", "retired"];

/** @returns {FigureState} */
export function stateOf(status) {
  const s = String(status ?? "").toLowerCase();
  if (COMPLETE.includes(s)) return "complete";
  if (ACTIVE.includes(s)) return "active";
  if (ATTENTION.includes(s)) return "attention";
  if (BLOCKED.includes(s)) return "blocked";
  if (RETIRED.includes(s)) return "retired";
  return "idle";
}
