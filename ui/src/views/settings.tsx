/**
 * Settings: what this installation is, on this machine, right now.
 *
 * Section 16.1 requires a Settings area, and every fact on it is read only.
 * The project's identity, the schema version, where things live on disk and
 * what the database holds are all owned by CLI commands and migrations, never
 * by a form in the browser. So the page teaches the command surface instead
 * of pretending to be an editor: each fact that has a command which moves it
 * names that command beside the fact.
 */

import { useMemo } from "react";

import {
  CountStrip,
  Facts,
  FreshnessLine,
  Panel,
  Tag,
  Value,
  useResource,
} from "@/components/diagrams/view-kit";
import { ViewBody, ViewHeader } from "@/components/shell/app-shell";
import {
  Empty,
  ErrorState,
  Loading,
  Offline,
  Stale,
} from "@/components/shell/states";
import { Status } from "@/components/shell/status";
import { Markdown } from "@/components/ui/markdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSettings } from "@/lib/api";
import { absoluteTime, countPhrase, formatNumber, titleCase } from "@/lib/format";
import { useLive } from "@/lib/live";

/** A machine value inline in a sentence: a command, never prose. */
function Cmd({ children }: { children: string }) {
  return (
    <code className="rounded-sd-sm bg-inset px-1 py-0.5 font-chassis text-chassis-sm text-ink-2">
      {children}
    </code>
  );
}

export function SettingsView() {
  const { revision } = useLive();
  const settings = useResource(getSettings, revision);
  const payload = settings.data;

  const migrations = useMemo(
    () =>
      (payload?.schema.migrations ?? [])
        .slice()
        .sort((a, b) => a.version - b.version),
    [payload],
  );

  const storageEntries = useMemo(
    () => Object.entries(payload?.storage ?? {}),
    [payload],
  );

  // Sorted by size so the largest holdings read first, which is usually the
  // more useful order for "how much is in here" than alphabetical.
  const censusEntries = useMemo(
    () => Object.entries(payload?.counts ?? {}).sort((a, b) => b[1] - a[1]),
    [payload],
  );

  const totalRecords = useMemo(
    () => censusEntries.reduce((sum, [, count]) => sum + count, 0),
    [censusEntries],
  );

  if (settings.pending && settings.loading) {
    return (
      <>
        <ViewHeader view="settings" />
        <ViewBody>
          <Loading
            title="Loading the installation settings"
            explanation="Reading the schema version, the storage locations and the record counts from the project database on this machine."
          />
        </ViewBody>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <ViewHeader view="settings" />
        <ViewBody>
          {settings.offline ? (
            <Offline onReconnect={settings.reload} state="offline" />
          ) : (
            <ErrorState
              title="The installation settings did not load"
              error={settings.error}
              onRetry={settings.reload}
            />
          )}
        </ViewBody>
      </>
    );
  }

  const { project, schema, categories } = payload;

  const counts = [
    {
      label: "Records held",
      value: totalRecords,
      unit: "across every kind",
    },
    {
      label: "Migrations applied",
      value: schema.applied,
      unit: schema.applied === 1 ? "migration" : "migrations",
    },
    {
      label: "Task categories",
      value: categories.length,
      unit: categories.length === 1 ? "category" : "categories",
    },
    {
      label: "Storage locations",
      value: storageEntries.length,
      unit: storageEntries.length === 1 ? "path recorded" : "paths recorded",
    },
  ];

  return (
    <>
      <ViewHeader view="settings">
        <p className="font-prose text-small text-ink-2 prose-measure">
          Nothing below can be changed from the browser. Every fact here is
          set by a command, a migration or the discovery interview, so this
          page reads what already happened rather than offering a form.
        </p>
        <CountStrip items={counts} className="-mx-1" />
        <FreshnessLine
          meta={settings.meta}
          loading={settings.loading}
          onRefresh={settings.reload}
        />
      </ViewHeader>

      <ViewBody>
        {settings.meta?.stale ? (
          <Stale
            meta={settings.meta}
            onRefresh={settings.reload}
            showing="the current settings"
          />
        ) : null}

        {settings.error && settings.data ? (
          <ErrorState
            density="inline"
            title="The last refresh failed"
            explanation={`${settings.error.message} Everything below is the last reading that arrived.`}
            onRetry={settings.reload}
          />
        ) : null}

        <Panel
          title="Project"
          description="Set when the project was initialized and refined since through the discovery interview."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-prose text-subtitle text-ink">
                {project.name}
              </h4>
              <Status value={project.status} size="sm" />
            </div>

            {project.statement ? (
              <Markdown measure={false}>{project.statement}</Markdown>
            ) : (
              <p className="font-prose text-small text-ink-3">
                No statement has been written for this project yet.
              </p>
            )}

            <Facts
              columns={2}
              items={[
                {
                  label: "Identifier",
                  value: (
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {project.id}
                    </span>
                  ),
                },
                {
                  label: "Slug",
                  value: (
                    <span className="font-chassis text-chassis-sm text-ink-2">
                      {project.slug}
                    </span>
                  ),
                },
                {
                  label: "Working mode",
                  value: (
                    <Value missing="Not recorded">
                      {titleCase(project.working_mode)}
                    </Value>
                  ),
                },
                {
                  label: "Docs profile",
                  value: (
                    <Value missing="Not recorded">
                      {titleCase(project.docs_profile)}
                    </Value>
                  ),
                },
                {
                  label: "Created",
                  value: (
                    <span title={absoluteTime(project.created_at)}>
                      {absoluteTime(project.created_at)}
                    </span>
                  ),
                },
                {
                  label: "Last updated",
                  value: (
                    <span title={absoluteTime(project.updated_at)}>
                      {absoluteTime(project.updated_at)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Panel>

        <Panel
          title="Schema"
          description="The database structure this installation is running, and every migration that got it there, in order."
          actions={<Tag>Version {formatNumber(schema.version)}</Tag>}
        >
          <div className="flex flex-col gap-3">
            <p className="font-prose text-small text-ink-2 prose-measure">
              {countPhrase(schema.applied, "migration")} applied so far. The
              schema moves forward by running <Cmd>superdev db migrate --apply</Cmd>,
              never from this page.
            </p>

            {migrations.length === 0 ? (
              <Empty
                density="inline"
                className="rounded-none border-0"
                title="No migration has been applied yet"
                explanation="This installation is running the schema it was created with. Run superdev db migrate --apply to bring it forward once a migration exists."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Version</TableHead>
                    <TableHead>Migration</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migrations.map((migration) => (
                    <TableRow key={migration.version}>
                      <TableCell className="font-chassis text-ink-3">
                        {migration.version}
                      </TableCell>
                      <TableCell className="font-prose text-ink">
                        {migration.name}
                      </TableCell>
                      <TableCell
                        className="text-ink-2"
                        title={absoluteTime(migration.applied_at)}
                      >
                        {absoluteTime(migration.applied_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Panel>

        <Panel
          title="Storage"
          description="Where this installation keeps its files on disk. Moving any of it is a filesystem operation, not something this page does."
        >
          {storageEntries.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No storage location recorded"
              explanation="The service did not report where anything is kept on disk for this installation."
            />
          ) : (
            <Facts
              columns={1}
              items={storageEntries.map(([key, path]) => ({
                label: titleCase(key),
                value: (
                  <span className="break-all font-chassis text-chassis-sm text-ink-2">
                    {path}
                  </span>
                ),
              }))}
            />
          )}
        </Panel>

        <Panel
          title="Database census"
          description="One row per record kind, and how many of it this installation currently holds."
          bodyClassName="p-0"
        >
          {censusEntries.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="Nothing has been recorded yet"
              explanation="This database holds no records of any kind on this installation."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record kind</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {censusEntries.map(([kind, count]) => (
                  <TableRow key={kind}>
                    <TableCell className="font-prose text-ink">
                      {titleCase(kind)}
                    </TableCell>
                    <TableCell className="text-right font-chassis text-ink-2">
                      {formatNumber(count)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-prose font-semibold text-ink">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-chassis font-semibold text-ink">
                    {formatNumber(totalRecords)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Task categories"
          description="The kinds of work this project's tasks are sorted into. Seeded when the project was set up; there is no in-browser editor for the list."
          bodyClassName="p-0"
        >
          {categories.length === 0 ? (
            <Empty
              density="inline"
              className="rounded-none border-0"
              title="No task category recorded"
              explanation="This project has no task categories yet, so a task cannot be filed under one until the taxonomy is seeded."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-rule">
              {categories.map((category) => (
                <li key={category.id} className="flex flex-col gap-1 px-3 py-2">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="font-prose text-body text-ink">
                      {category.name}
                    </span>
                    <span className="font-chassis text-chassis-sm text-ink-3">
                      {category.id}
                    </span>
                  </span>
                  {category.meaning ? (
                    <Markdown measure={false}>{category.meaning}</Markdown>
                  ) : (
                    <span className="font-prose text-small text-ink-3">
                      No meaning has been recorded for this category.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </ViewBody>
    </>
  );
}
