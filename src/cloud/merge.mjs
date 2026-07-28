// The merge, the conflict, and the lease. DEC-TBD-006.
//
// Local first means the local database is always the authority: nothing here
// ever overwrites a local record without either a clear reason or an explicit
// resolution. A remote change to a record nobody touched locally is applied. A
// remote change to a record that also changed locally is refused and recorded
// as a conflict, because the alternative, last writer wins, loses somebody's
// work silently. Silence is the failure this product exists to prevent.
//
// Three-way, not two-way. Comparing local against remote can only say they
// differ; it cannot say who moved. The base, what both sides agreed at the end
// of the last successful sync, is what turns a difference into a fact: changed
// there, changed here, or changed in both places.
//
// Append only history is never merged. Activity does not cross the boundary at
// all under DEC-TBD-007, and nothing here rewrites a sequence.

import { rowHash } from "./crypto.mjs";
import { isShared, project } from "./policy.mjs";

/** What a comparison can conclude. */
export const OUTCOME = {
  UNCHANGED: "unchanged",
  REMOTE_ONLY: "remote_only",
  LOCAL_ONLY: "local_only",
  BOTH: "both",
  NEW_REMOTE: "new_remote",
  NEW_LOCAL: "new_local",
};

/**
 * Compare one record across the three points.
 *
 * `base` is what both sides last agreed, and its absence means this record has
 * never synced: it is new to one side or the other rather than conflicted. A
 * record present on both sides with no base and the same content is treated as
 * unchanged, which happens whenever two copies come from the same export.
 */
export function compare({ local, remote, base }) {
  const localHash = local ? rowHash(local) : null;
  const remoteHash = remote ? rowHash(remote) : null;

  if (!local && !remote) return { outcome: OUTCOME.UNCHANGED };
  if (!local) return { outcome: OUTCOME.NEW_REMOTE, hash: remoteHash };
  if (!remote) {
    // No base means this side made it and the other has not seen it. A base
    // means the other side deleted it, and deletion does not cross: a record
    // removed elsewhere stays here until somebody removes it here too, because
    // an accidental deletion that propagates is unrecoverable.
    return { outcome: OUTCOME.LOCAL_ONLY, hash: localHash };
  }
  if (localHash === remoteHash) return { outcome: OUTCOME.UNCHANGED, hash: localHash };

  if (!base) {
    // Both sides have it, they differ, and nothing says what they agreed on.
    // Treating that as a conflict is the honest answer: neither side can claim
    // the other's version is stale.
    return { outcome: OUTCOME.BOTH, localHash, remoteHash };
  }
  const localMoved = localHash !== base.base_hash;
  const remoteMoved = remoteHash !== base.base_hash;
  if (localMoved && remoteMoved) return { outcome: OUTCOME.BOTH, localHash, remoteHash };
  if (remoteMoved) return { outcome: OUTCOME.REMOTE_ONLY, hash: remoteHash };
  if (localMoved) return { outcome: OUTCOME.LOCAL_ONLY, hash: localHash };
  return { outcome: OUTCOME.UNCHANGED, hash: localHash };
}

/**
 * Which fields actually differ, so a conflict names the disagreement rather
 * than two opaque blobs. A reader deciding between two versions of a feature
 * wants to know that the purpose moved, not that something did.
 */
export function differingFields(local, remote) {
  const keys = [...new Set([...Object.keys(local ?? {}), ...Object.keys(remote ?? {})])].sort();
  const out = [];
  for (const key of keys) {
    // A version number differs by definition once anything else does, and
    // saying so tells a reader nothing.
    if (key === "version" || key === "updated_at") continue;
    const a = local?.[key] ?? null;
    const b = remote?.[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: key, local: a, remote: b });
  }
  return out;
}

/**
 * Merge two versions field by field, taking the side that moved.
 *
 * Only usable when the two sides changed different fields, which is the common
 * case for records with many independent columns. Where both moved the same
 * field there is nothing to merge and the caller has to choose, so this reports
 * what it could not settle rather than picking.
 */
export function mergeFields({ local, remote, base }) {
  const merged = { ...local };
  const unsettled = [];
  for (const { field, local: mine, remote: theirs } of differingFields(local, remote)) {
    const original = base?.row?.[field] ?? undefined;
    const localMoved = original === undefined || JSON.stringify(mine) !== JSON.stringify(original);
    const remoteMoved = original === undefined || JSON.stringify(theirs) !== JSON.stringify(original);
    if (localMoved && remoteMoved) {
      unsettled.push(field);
      continue;
    }
    if (remoteMoved) merged[field] = theirs;
  }
  return { merged, unsettled };
}

// ------------------------------------------------------------------- leases

/** How long a claim holds without being renewed. */
export const LEASE_MINUTES = 60;

export const leaseExpiry = (fromIso, minutes = LEASE_MINUTES) =>
  new Date(Date.parse(fromIso) + minutes * 60 * 1000).toISOString();

/**
 * Whether a remote lease still holds a task here.
 *
 * An expired lease is not a claim. A machine that crashed holding a task must
 * not hold it forever, and asking a person to release it by hand is asking them
 * to clean up after a failure they did not cause.
 */
export function leaseHolds(lease, now = new Date().toISOString()) {
  if (!lease?.lease_holder) return false;
  if (!lease.lease_expires_at) return true;
  return Date.parse(lease.lease_expires_at) > Date.parse(now);
}

/**
 * Decide what a bundle's leases mean for this side.
 *
 * Returns the tasks this machine must not claim, each with the alias holding it
 * and when that hold lapses, so a refusal can say who and until when instead of
 * only no.
 */
export function foreignLeases(bundle, selfAlias, now = new Date().toISOString()) {
  return (bundle?.leases ?? [])
    .filter((lease) => lease.holder !== selfAlias && leaseHolds(
      { lease_holder: lease.holder, lease_expires_at: lease.expiresAt }, now))
    .map((lease) => ({ taskId: lease.taskId, holder: lease.holder, expiresAt: lease.expiresAt }));
}

// ------------------------------------------------------------------- bundles

/**
 * Everything this side is willing to send, already projected.
 *
 * The policy decides what is included; this only assembles it. Keeping those
 * apart means a change to what may be shared is a change to one list, and the
 * assembly cannot quietly disagree with it.
 */
export async function buildBundle(db, { projectId, alias, tables }) {
  const records = {};
  for (const table of tables) {
    if (!isShared(table)) continue;
    let rows;
    try {
      rows = await db.all(`SELECT * FROM ${table}`);
    } catch {
      // A table this schema version does not have is not an error: two copies
      // of a project can be one migration apart and still exchange everything
      // they both understand.
      continue;
    }
    records[table] = rows.map((row) => project(table, row));
  }

  const leases = await db.all(
    `SELECT a.task_id, a.lease_holder, a.lease_expires_at
       FROM task_assignments a
      WHERE a.active = 1 AND a.lease_holder IS NOT NULL`).catch(() => []);

  return {
    format: 1,
    project: projectId,
    alias,
    writtenAt: new Date().toISOString(),
    records,
    leases: leases.map((l) => ({
      taskId: l.task_id, holder: l.lease_holder, expiresAt: l.lease_expires_at,
    })),
  };
}
