/**
 * Sync: what is shared with another copy, what never leaves, and what disagrees.
 *
 * Two questions decide whether somebody trusts this, and only one of them is
 * about synchronizing. The first is what would go: a page that showed a
 * connection and a record count would let a reader assume the answer to the
 * second, and section 18 makes that the expensive assumption. So the withheld
 * list is not a footnote here. It is half the page, and every entry says why.
 *
 * A conflict is the other thing worth showing plainly. DEC-TBD-006 refuses last
 * writer wins because it loses an edit silently, and the visible consequence of
 * that refusal is that disagreements queue up here waiting for a person. That
 * queue is a feature, so it reads as one rather than as an error state.
 */

import { CountStrip, FreshnessLine, Panel, Tag, useResource } from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import { Empty, ErrorState, Loading, Offline, Stale } from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSync } from "@/lib/api";
import { absoluteTime, countPhrase } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { SyncConflictRecord } from "@/types";

export function SyncView() {
  const { revision } = useLive();
  const resource = useResource(getSync, revision);
  const payload = resource.data;

  if (resource.pending && resource.loading) {
    return (
      <>
        <ViewHeader view="sync" />
        <ViewBody>
          <Loading
            title="Reading the synchronization state"
            explanation="Reading the peer, the conflicts and the leases from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="sync" />
        <ViewBody>
          {resource.offline ? (
            <Offline onReconnect={resource.reload} state="offline" />
          ) : (
            <ErrorState
              title="The synchronization state did not load"
              error={resource.error}
              onRetry={resource.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const { peer, conflicts, leases, trackedRecords, shared, withheld, counts } = payload;
  const open = conflicts.filter((c: SyncConflictRecord) => c.status === "open");
  const settled = conflicts.filter((c: SyncConflictRecord) => c.status !== "open");

  const counters = [
    { label: "Shared", value: counts.shared, unit: "kinds of record" },
    { label: "Withheld", value: counts.withheld, unit: "never leave" },
    { label: "Conflicts", value: counts.openConflicts, unit: "waiting" },
    { label: "Leases", value: counts.leases, unit: "tasks held" },
  ];

  return (
    <>
      <ViewHeader view="sync">
        <CountStrip items={counters} className="-mx-1" />
        <p className="font-prose text-small text-ink-2 prose-measure">
          The local database is always the authority. A record changed in both copies since they
          last agreed is never overwritten: it is recorded as a conflict and the local value
          stands until somebody settles it. Everything that leaves is encrypted with a key held
          on this machine and never transmitted.
        </p>
        <FreshnessLine meta={resource.meta} loading={resource.loading} onRefresh={resource.reload} />
      </ViewHeader>

      <ViewBody>
        {resource.meta?.stale ? (
          <Stale meta={resource.meta} onRefresh={resource.reload} showing="the synchronization state" />
        ) : null}

        {peer === null ? (
          <Empty
            title="No remote is configured"
            explanation="This project syncs with nothing, and everything works that way: section 12.9 of the requirements document says synchronization is not required for the local plugin to function. Connect one with superdev cloud connect, giving it a directory. Connecting sends nothing; the first sync is a separate command."
          />
        ) : (
          <Panel
            title={peer.alias ?? "The remote"}
            description="Where this copy synchronizes, and when it last did."
            actions={<Status value={peer.status} />}
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact label="Transport">{peer.transport}</Fact>
              <Fact label="Location">{peer.location ?? "Not recorded"}</Fact>
              <Fact label="Key fingerprint">
                {peer.key_fingerprint ?? "None"}
                <span className="block font-prose text-small text-ink-3 prose-measure">
                  The key itself stays on this machine. A remote copy cannot be read without it,
                  and losing it costs the remote copy rather than the project.
                </span>
              </Fact>
              <Fact label="Last synced">
                {peer.last_synced_at ? absoluteTime(peer.last_synced_at) : "Never"}
                <span className="block font-prose text-small text-ink-3 prose-measure">
                  {countPhrase(trackedRecords, "record")} tracked, meaning both copies agree on
                  what they last held.
                </span>
              </Fact>
            </dl>
          </Panel>
        )}

        <Panel
          title={`Disagreements, ${countPhrase(open.length, "waiting")}`}
          description="A record changed in both copies since they last agreed. Nothing is overwritten: the local value stands until somebody chooses, which is what refusing last writer wins actually looks like."
          bodyClassName="p-0"
        >
          {conflicts.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="Nothing disagrees"
              explanation="No conflict has been recorded between this copy and any other."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conflict</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Found</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...open, ...settled].map((conflict) => (
                  <TableRow key={conflict.id}>
                    <TableCell className="font-chassis text-chassis-sm">{conflict.id}</TableCell>
                    <TableCell>
                      {conflict.record_type} {conflict.record_id}
                    </TableCell>
                    <TableCell>{absoluteTime(conflict.detected_at)}</TableCell>
                    <TableCell>
                      {conflict.status === "open" ? (
                        <span className="font-prose text-small text-ink-2">
                          Waiting. Settle it with superdev sync --resolve {conflict.id}.
                        </span>
                      ) : (
                        <span className="font-prose text-small text-ink-2">
                          Settled by keeping {conflict.resolution}
                          {conflict.resolved_at ? `, ${absoluteTime(conflict.resolved_at)}` : ""}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel
          title={`Tasks held elsewhere, ${countPhrase(leases.length, "lease")}`}
          description="A lease names the copy holding a task and when the hold lapses, so a second machine is refused with a name rather than a bare no. It is an alias, never a person: section 18 forbids disclosing who works where."
          bodyClassName="p-0"
        >
          {leases.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No task is held from another copy"
              explanation="Every claim on this project was made here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Held by</TableHead>
                  <TableHead>Until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease) => (
                  <TableRow key={lease.task_id}>
                    <TableCell>
                      <span className="font-chassis text-chassis-sm">{lease.task_id}</span>
                      {lease.task_name ? (
                        <span className="block font-prose text-small text-ink-2">
                          {lease.task_name}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {lease.lease_holder}
                      {lease.origin_peer ? null : (
                        <Tag title="Claimed on this machine.">this copy</Tag>
                      )}
                    </TableCell>
                    <TableCell>
                      {lease.lease_expires_at ? absoluteTime(lease.lease_expires_at) : "No expiry"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel
          title="What crosses, and what does not"
          description="The list of what may be shared is what is allowed rather than what is forbidden, so a table added tomorrow stays local until somebody adds it deliberately."
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h4 className="font-chassis text-label text-ink-3 uppercase">
                Shared, {countPhrase(shared.length, "kind of record", "kinds of record")}
              </h4>
              <p className="font-prose text-small text-ink-2 prose-measure">
                Accepted specifications, decisions and evidence, and the tasks that implement
                them. Personal columns are stripped from each row before it leaves.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {shared.map((table) => (
                  <li key={table}>
                    <Tag>{table}</Tag>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2 xl:border-l xl:border-rule xl:pl-4">
              <h4 className="font-chassis text-label text-ink-3 uppercase">
                Never leaves, {countPhrase(withheld.length, "kind of record", "kinds of record")}
              </h4>
              <ul className="flex flex-col gap-2">
                {withheld.map((entry) => (
                  <li key={entry.table} className="flex flex-col gap-0.5">
                    <span className="font-chassis text-chassis-sm text-ink-1">{entry.table}</span>
                    <span className="font-prose text-small text-ink-2 prose-measure">
                      {entry.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      </ViewBody>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-chassis text-label text-ink-3 uppercase">{label}</dt>
      <dd className="font-prose text-small text-ink-1 prose-measure">{children}</dd>
    </div>
  );
}
