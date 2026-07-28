// Connect, synchronize, preview and resolve. Section 12.9.
//
// The four commands refused for as long as DEC-TBD-006, 007 and 008 were open,
// which was correct: a merge policy invented by whoever wrote the code is a
// policy nobody agreed to. Those decisions are now recorded and this implements
// them, and nothing more than them.
//
// Local first, throughout. A pull never overwrites a record this machine also
// changed; it records a conflict and leaves the local value in place. Nothing
// leaves the machine unencrypted, and nothing leaves it that DEC-TBD-007 keeps
// local. The only transport is a directory, so nothing reaches the network.
//
// The offline queue is the cursor, not a second table. Every change is already
// in the record with its version, and a sync compares against the base agreed
// last time, so work done with no remote reachable is simply work the next sync
// finds. There is nothing to drain and nothing to lose if the queue itself were
// lost, which is the strongest form a queue can take.

import { create, mutate, query, recordActivity } from "../db/store.mjs";
import { ensureKey, fingerprint, keyExists, loadKey, open, rowHash, seal } from "./crypto.mjs";
import {
  OUTCOME, buildBundle, compare, differingFields, foreignLeases, leaseExpiry, mergeFields,
} from "./merge.mjs";
import { SHARED_TABLES, WITHHELD, isShared, project } from "./policy.mjs";
import { transportFor } from "./transport.mjs";

export const E = {
  NOT_CONNECTED: "E_NOT_CONNECTED",
  NO_PEER: "E_NO_PEER",
  CONFLICTS_OPEN: "E_CONFLICTS_OPEN",
  UNKNOWN_CONFLICT: "E_UNKNOWN_CONFLICT",
  LEASE_HELD: "E_LEASE_HELD",
};

export class SyncError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const nowIso = () => new Date().toISOString();

/** The peer this project syncs with, or nothing. */
async function peerOf(db) {
  return db.get("SELECT * FROM sync_peers ORDER BY connected_at DESC LIMIT 1");
}

// ------------------------------------------------------------------ connect

/**
 * Point this project at a remote and create its key.
 *
 * Connecting writes nothing to the remote and reads nothing from it beyond
 * checking it is there. Somebody connecting is saying where their copy lives,
 * not agreeing to send it, and the first send is a separate act.
 */
export async function connect(root, { location, alias = null, transport = "directory", apply = false } = {}) {
  if (!location) {
    throw new SyncError(E.NO_PEER,
      "Say where the remote is: superdev cloud connect <directory>. The only transport implemented is a directory on this machine, which may be a shared or mounted volume.");
  }
  const existingKey = keyExists(root);
  const plan = { location, alias, transport, createsKey: !existingKey };
  if (!apply) return { applied: false, plan };

  const key = ensureKey(root);
  const print = fingerprint(key);

  return mutate(root, async (db) => {
    const project_ = await db.get("SELECT id, slug, name FROM projects LIMIT 1");
    const name = alias ?? `${project_.slug}-${print.slice(0, 6)}`;
    const carrier = transportFor({ transport, location });
    carrier.open();

    const existing = await peerOf(db);
    if (existing) {
      await db.run(
        `UPDATE sync_peers SET transport = ?, location = ?, alias = ?, key_fingerprint = ?,
                               status = 'connected', connected_at = ? WHERE id = ?`,
        transport, location, name, print, nowIso(), existing.id,
      );
    } else {
      await create(db, "sync_peer", {
        project_id: project_.id,
        peer_type: transport,
        transport,
        location,
        alias: name,
        key_fingerprint: print,
        status: "connected",
        connected_at: nowIso(),
        local_priority: 1,
      }, { projectId: project_.id, activity: false });
    }

    await recordActivity(db, project_.id, {
      type: "scope_changed",
      actor: "superdev",
      summary: `Connected to a ${transport} remote as ${name}. Nothing has been sent yet.`,
      metadata: { transport, keyFingerprint: print },
    });

    return {
      applied: true,
      alias: name,
      keyFingerprint: print,
      createdKey: !existingKey,
      location,
      transport,
    };
  });
}

// ------------------------------------------------------------------- status

export async function status(root) {
  return query(root, async (db) => {
    const peer = await peerOf(db);
    const conflicts = await db.all(
      "SELECT * FROM sync_conflicts WHERE status = 'open' ORDER BY detected_at").catch(() => []);
    const held = await db.all(
      `SELECT task_id, lease_holder, lease_expires_at FROM task_assignments
        WHERE active = 1 AND lease_holder IS NOT NULL`).catch(() => []);

    if (!peer) {
      return {
        connected: false,
        why: "No remote is configured for this project. Everything works without one: section 12.9 says synchronization is not required for the local plugin to function.",
        conflicts: [],
        leases: [],
        shared: SHARED_TABLES.length,
        withheld: Object.keys(WITHHELD).length,
      };
    }

    let reachable = false;
    try {
      reachable = transportFor(peer).reachable();
    } catch {
      reachable = false;
    }

    const tracked = await db.get(
      "SELECT COUNT(*) AS n FROM sync_base WHERE peer_id = ?", peer.id).catch(() => ({ n: 0 }));

    return {
      connected: peer.status === "connected",
      reachable,
      transport: peer.transport,
      location: peer.location,
      alias: peer.alias,
      keyFingerprint: peer.key_fingerprint,
      lastSyncedAt: peer.last_synced_at,
      trackedRecords: Number(tracked?.n ?? 0),
      conflicts: conflicts.map((c) => ({
        id: c.id, recordType: c.record_type, recordId: c.record_id, detectedAt: c.detected_at,
      })),
      leases: held,
      shared: SHARED_TABLES.length,
      withheld: Object.keys(WITHHELD).length,
    };
  });
}

// --------------------------------------------------------------------- sync

/** Read every bundle the remote holds that this side did not write. */
function readPeerBundles(carrier, key, selfAlias) {
  const out = [];
  for (const entry of carrier.list(selfAlias)) {
    const bytes = carrier.get(entry.name);
    if (!bytes) continue;
    // A bundle that cannot be opened is reported, never skipped in silence: a
    // reader needs to know their colleague's copy is unreadable.
    try {
      out.push({ name: entry.name, bundle: open(key, bytes) });
    } catch (error) {
      out.push({ name: entry.name, error: error.message });
    }
  }
  return out;
}

/**
 * Plan and optionally perform one synchronization.
 *
 * Without `apply` this is `sync --dry-run`: everything is read, compared and
 * reported, and nothing is written locally or remotely. The two paths share
 * every line that decides anything, so the preview cannot describe a different
 * sync from the one that would run.
 */
export async function synchronize(root, { apply = false, alias = null } = {}) {
  const peer = await query(root, (db) => peerOf(db));
  if (!peer) {
    throw new SyncError(E.NOT_CONNECTED,
      "This project is not connected to a remote. Run superdev cloud connect <directory> first. Nothing local depends on it.");
  }
  const key = loadKey(root);
  const carrier = transportFor(peer);
  if (!carrier.reachable()) {
    throw new SyncError(E.NOT_CONNECTED,
      `The remote at ${peer.location} cannot be reached, so there is nothing to synchronize with. Local work is unaffected and the next sync will find it.`);
  }
  const self = alias ?? peer.alias;

  const plan = await query(root, async (db) => {
    const project_ = await db.get("SELECT id FROM projects LIMIT 1");
    const bundles = readPeerBundles(carrier, key, self);
    const unreadable = bundles.filter((b) => b.error);

    const bases = new Map();
    for (const row of await db.all("SELECT * FROM sync_base WHERE peer_id = ?", peer.id)) {
      bases.set(`${row.record_type}:${row.record_id}`, row);
    }

    const incoming = [];
    const agreed = [];
    const conflicts = [];
    const leases = [];

    for (const { bundle } of bundles.filter((b) => !b.error)) {
      for (const [table, rows] of Object.entries(bundle.records ?? {})) {
        if (!isShared(table)) continue;
        for (const remote of rows) {
          if (!remote?.id) continue;
          const local = await db.get(`SELECT * FROM ${table} WHERE id = ?`, remote.id).catch(() => null);
          const localProjected = local ? project(table, local) : null;
          const base = bases.get(`${table}:${remote.id}`);
          const verdict = compare({ local: localProjected, remote, base });

          if (verdict.outcome === OUTCOME.NEW_REMOTE || verdict.outcome === OUTCOME.REMOTE_ONLY) {
            incoming.push({ table, id: remote.id, row: remote, kind: verdict.outcome });
          } else if (verdict.outcome === OUTCOME.UNCHANGED) {
            // Both sides hold the same value, so this is what they agree on and
            // the base may safely move to it.
            agreed.push({ table, id: remote.id, row: remote });
          } else if (verdict.outcome === OUTCOME.BOTH) {
            conflicts.push({
              table, id: remote.id,
              local: localProjected, remote,
              fields: differingFields(localProjected, remote).map((f) => f.field),
            });
          }
        }
      }
      leases.push(...foreignLeases(bundle, self));
    }

    // What this side would send. Counted rather than listed: a bundle is every
    // shared record, and a list of two thousand ids helps nobody.
    const outgoing = await buildBundle(db, { projectId: project_.id, alias: self, tables: SHARED_TABLES });
    const outgoingCount = Object.values(outgoing.records).reduce((n, rows) => n + rows.length, 0);

    return {
      projectId: project_.id, self, incoming, agreed, conflicts, leases, unreadable,
      outgoing, outgoingCount,
      peers: bundles.map((b) => b.name),
    };
  });

  const summary = {
    peer: peer.alias,
    location: peer.location,
    transport: peer.transport,
    peersFound: plan.peers.length,
    incoming: plan.incoming.length,
    conflicts: plan.conflicts.length,
    agreed: plan.agreed.length,
    outgoing: plan.outgoingCount,
    leases: plan.leases,
    unreadable: plan.unreadable.map((u) => `${u.name}: ${u.error}`),
    withheldTables: Object.keys(WITHHELD).length,
  };

  if (!apply) return { applied: false, ...summary };

  // Conflicts are recorded before anything is applied, so a run that stops
  // halfway leaves the disagreement visible rather than invisible.
  const applied = await mutate(root, async (db) => {
    const at = nowIso();
    let written = 0;

    for (const conflict of plan.conflicts) {
      const already = await db.get(
        `SELECT id FROM sync_conflicts WHERE record_type = ? AND record_id = ? AND status = 'open'`,
        conflict.table, conflict.id);
      if (already) continue;
      await create(db, "sync_conflict", {
        project_id: plan.projectId,
        record_type: conflict.table,
        record_id: conflict.id,
        local_version: conflict.local?.version ?? null,
        remote_version: conflict.remote?.version ?? null,
        local_value_json: JSON.stringify(conflict.local),
        remote_value_json: JSON.stringify(conflict.remote),
        detected_at: at,
        status: "open",
      }, { projectId: plan.projectId, activity: false });
    }

    // Only what nobody here touched. A conflicted record keeps its local value
    // until somebody resolves it deliberately.
    for (const change of plan.incoming) {
      const columns = Object.keys(change.row);
      const marks = columns.map(() => "?").join(",");
      await db.run(
        `INSERT OR REPLACE INTO ${change.table} (${columns.join(",")}) VALUES (${marks})`,
        ...columns.map((c) => change.row[c]),
      );
      await db.run(
        `INSERT OR REPLACE INTO sync_base
           (id, project_id, peer_id, record_type, record_id, base_version, base_hash, synced_at)
         VALUES (
           (SELECT id FROM sync_base WHERE peer_id = ? AND record_type = ? AND record_id = ?),
           ?, ?, ?, ?, ?, ?, ?)`,
        peer.id, change.table, change.id,
        plan.projectId, peer.id, change.table, change.id,
        change.row.version ?? null, rowHash(change.row), at,
      );
      written += 1;
    }

    // Leases the other side holds, so a claim here is refused with a name.
    for (const lease of plan.leases) {
      const assignment = await db.get(
        "SELECT id FROM task_assignments WHERE task_id = ? AND active = 1", lease.taskId);
      if (assignment) continue;
      const task = await db.get("SELECT id, project_id FROM tasks WHERE id = ?", lease.taskId);
      if (!task) continue;
      await create(db, "task_assignment", {
        task_id: lease.taskId,
        assigned_at: at,
        active: 1,
        lease_holder: lease.holder,
        lease_expires_at: lease.expiresAt,
        origin_peer: peer.id,
      }, { projectId: plan.projectId, activity: false });
    }

    // Records both sides already hold identically. The base may move to these
    // and to nothing else.
    //
    // Writing this side's own outgoing state as the agreed base is wrong and
    // was the first bug this engine had: a drop-box transport carries no
    // acknowledgement, so a record only this side changed has not been agreed
    // by anyone. Marking it agreed made the next incoming change look like the
    // only movement, and the local edit was overwritten without a conflict.
    // That is precisely the silent loss DEC-TBD-006 refuses, produced by the
    // code meant to prevent it.
    for (const row of plan.agreed) {
      await db.run(
        `INSERT OR REPLACE INTO sync_base
           (id, project_id, peer_id, record_type, record_id, base_version, base_hash, synced_at)
         VALUES (
           (SELECT id FROM sync_base WHERE peer_id = ? AND record_type = ? AND record_id = ?),
           ?, ?, ?, ?, ?, ?, ?)`,
        peer.id, row.table, row.id,
        plan.projectId, peer.id, row.table, row.id,
        row.row.version ?? null, rowHash(row.row), at,
      );
    }

    await db.run(
      "UPDATE sync_peers SET last_synced_at = ?, status = 'connected' WHERE id = ?", at, peer.id);

    await recordActivity(db, plan.projectId, {
      type: "scope_changed",
      actor: "superdev",
      summary: `Synchronized with ${peer.alias}: ${written} records taken in, ${plan.outgoingCount} offered, ${plan.conflicts.length} conflicts recorded.`,
      metadata: { incoming: written, outgoing: plan.outgoingCount, conflicts: plan.conflicts.length },
    });

    return { written };
  });

  // Sending happens after the local transaction commits, so a failure to write
  // to the remote never leaves the local database claiming a sync that did not
  // finish. The bundle is sealed here and nowhere else.
  carrier.put(self, seal(key, plan.outgoing));

  return { applied: true, ...summary, taken: applied.written };
}

// ------------------------------------------------------------------ resolve

/** Every disagreement still waiting for somebody to settle it. */
export async function openConflicts(root) {
  return query(root, (db) => db.all(
    "SELECT * FROM sync_conflicts WHERE status = 'open' ORDER BY detected_at, id").catch(() => []));
}

/**
 * Settle one conflict, or report what cannot be settled without a person.
 *
 * `merge` takes each side's change where only one side moved the field, and
 * refuses when both moved the same one: there is no correct answer to that and
 * inventing one is how a merge quietly loses an edit.
 */
export async function resolveConflict(root, conflictId, { choice = "local", apply = false, actor = "superdev" } = {}) {
  if (!["local", "remote", "merged"].includes(choice)) {
    throw new SyncError(E.UNKNOWN_CONFLICT,
      `A conflict is settled by keeping local, keeping remote, or merging. ${choice} is none of those.`);
  }
  const conflict = await query(root, (db) =>
    db.get("SELECT * FROM sync_conflicts WHERE id = ?", conflictId));
  if (!conflict) throw new SyncError(E.UNKNOWN_CONFLICT, `There is no conflict ${conflictId}.`);
  if (conflict.status === "resolved") {
    throw new SyncError(E.UNKNOWN_CONFLICT, `${conflictId} was already settled by keeping ${conflict.resolution}.`);
  }

  const local = JSON.parse(conflict.local_value_json ?? "null");
  const remote = JSON.parse(conflict.remote_value_json ?? "null");

  let row = local;
  let unsettled = [];
  if (choice === "remote") row = remote;
  if (choice === "merged") {
    const merged = mergeFields({ local, remote, base: null });
    row = merged.merged;
    unsettled = merged.unsettled;
    if (unsettled.length) {
      throw new SyncError(E.CONFLICTS_OPEN,
        `${conflictId} cannot be merged: both sides changed ${unsettled.join(", ")}. Keep one side with --keep local or --keep remote, or edit the record and sync again.`,
        { unsettled });
    }
  }

  const plan = {
    conflictId, choice,
    recordType: conflict.record_type,
    recordId: conflict.record_id,
    fields: differingFields(local, remote).map((f) => f.field),
  };
  if (!apply) return { applied: false, plan };

  return mutate(root, async (db) => {
    if (choice !== "local") {
      const columns = Object.keys(row);
      await db.run(
        `INSERT OR REPLACE INTO ${conflict.record_type} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
        ...columns.map((c) => row[c]),
      );
    }
    await db.run(
      "UPDATE sync_conflicts SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?",
      choice, actor, nowIso(), conflictId,
    );
    const peer = await peerOf(db);
    if (peer) {
      // The settled value becomes the new agreed base, so the next sync sees
      // agreement rather than reporting the same conflict again.
      await db.run(
        `INSERT OR REPLACE INTO sync_base
           (id, project_id, peer_id, record_type, record_id, base_version, base_hash, synced_at)
         VALUES (
           (SELECT id FROM sync_base WHERE peer_id = ? AND record_type = ? AND record_id = ?),
           ?, ?, ?, ?, ?, ?, ?)`,
        peer.id, conflict.record_type, conflict.record_id,
        conflict.project_id, peer.id, conflict.record_type, conflict.record_id,
        row?.version ?? null, rowHash(row ?? {}), nowIso(),
      );
    }
    await recordActivity(db, conflict.project_id, {
      type: "scope_changed",
      actor,
      summary: `Conflict on ${conflict.record_type} ${conflict.record_id} settled by keeping ${choice}.`,
      metadata: { conflict: conflictId, choice },
    });
    return { applied: true, plan };
  });
}

// ------------------------------------------------------------------- leases

/**
 * Take a lease on a task so other machines are refused.
 *
 * Called when a task is claimed while a peer is configured. Without a peer this
 * does nothing: a lease is a statement to somebody else, and with nobody to
 * hear it the local unique index is already the whole answer.
 */
export async function takeLease(root, taskId, { holder = null, minutes } = {}) {
  return mutate(root, async (db) => {
    const peer = await peerOf(db);
    if (!peer) return null;
    const at = nowIso();
    await db.run(
      `UPDATE task_assignments SET lease_holder = ?, lease_expires_at = ?
        WHERE task_id = ? AND active = 1`,
      holder ?? peer.alias, leaseExpiry(at, minutes), taskId,
    );
    return { taskId, holder: holder ?? peer.alias, expiresAt: leaseExpiry(at, minutes) };
  });
}

/** Whoever holds this task from elsewhere, or nothing. */
export async function heldElsewhere(root, taskId) {
  return query(root, async (db) => {
    const peer = await peerOf(db);
    if (!peer) return null;
    const row = await db.get(
      `SELECT lease_holder, lease_expires_at, origin_peer FROM task_assignments
        WHERE task_id = ? AND active = 1 AND lease_holder IS NOT NULL AND origin_peer IS NOT NULL`,
      taskId);
    if (!row) return null;
    if (row.lease_expires_at && Date.parse(row.lease_expires_at) <= Date.now()) return null;
    return { holder: row.lease_holder, expiresAt: row.lease_expires_at };
  });
}
