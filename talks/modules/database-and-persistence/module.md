<!-- superdev:generated source=MOD-0006 revision=3969 hash=84d29d225403bdbce5f0abd6d561d38d40206bfcbe4df52a3208d537d193cfdf -->
# Module: Database and Persistence

- **Status:** Planned
- **Purpose:** Stores normalized project records, enforces data invariants such as one active assignment per task and immutable history, manages versioned migrations, backups, and portable export and import.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| #/data | Data | What the product stores, its fields and its migrations | - | Data |
| - | Schema | Required area of the control center. Listed as a required area with no further content specified. Also appears as one of the entity types on the Blueprint canvas, there called Schemas. | - | Schema |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev db backup --apply superdev db backup --apply | Create a backup of the database. | superdev db backup --apply |
| superdev db migrate --apply superdev db migrate --apply | Apply a versioned schema migration to the database. | superdev db migrate --apply |
| superdev db restore <backup> --apply superdev db restore <backup> --apply | Restore the database from a named backup. | superdev db restore <backup> --apply |
| superdev db status superdev db status | Report the current database status. | superdev db status |
| superdev export <file> --apply superdev export <file> --apply | Export product data from the database to a file. Reads the database and writes an external file, it does not alter stored product state. | superdev export <file> --apply |
| superdev import <file> --apply superdev import <file> --apply | Import data from a file into the database. | superdev import <file> --apply |
| superdev schema show superdev schema show | Show the data schema. | superdev schema show |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| data_entities | owner | data_entities |

## Wiring (key actions end to end)

| Action | Path |
|---|---|
| Open an entity | Data -> no handler recorded -> no side effects recorded |

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | if the directory has no Superdev database yet, it prints that this directory has no database yet and to run init, and exits 1, instead of a blank status table; when the schema is already current, both the dry run and the --apply run report that it is already up to date and do nothing further; when no backups exist yet, listBackups returns an empty array and the dry run reports 0 backups already there, with no error; if there are no backups at all and no file is given, the command refuses with 'There is no backup to restore from' instead of suggesting a newest one that does not exist; a table with zero rows is still counted in the header's table list but is filtered out of the printed summary table, so the report only shows tables that actually have data | Check database status, Apply versioned migrations, Back up the database, Restore the database from backup, Export project data |
| Invalid Input | if the named file does not exist, restore throws 'There is no backup file named <name>' rather than attempting the copy; a file that is not JSON, missing the export format header, or with a malformed {table, row} line on any given line number is refused with a specific message naming the problem and the line | Restore the database from backup, Import project data |
| State Machine Violations | Applying on a repository with existing, undetected documentation and no --adopt flag throws before the database is created or migrated, so no partial project is left behind.; if the local service is running or still starting, --apply refuses and names the port and pid, telling the caller to run stop first; the dry run is not blocked since it only reads; restoring with --apply while the local service is running is refused up front rather than allowed to corrupt the sidecar files a live process is using | Create the project database on acceptance, Apply versioned migrations, Restore the database from backup |
| Concurrent Actions | N/A - VACUUM INTO takes an exclusive lock on the source database for the duration of the copy, so a concurrent writer cannot produce a torn backup, it just waits for the lock | Back up the database |
| Duplication | Re-running --apply on the same project finds the existing project row by its creation order and reuses it, reporting that step as already existed rather than inserting a second project.; re-running the same import twice inserts zero new rows the second time, since every row's primary key is already present; the operation is idempotent | Create the project database on acceptance, Import project data |
| Dependency Failure | exporting a project with no database at all throws a clear refusal naming that this project has no Superdev database yet, rather than writing an empty file | Export project data |
| Slow Paths | the whole snapshot is built in memory before being written, which is a known ceiling for very large projects; the code marks this with a comment noting it should stream if a project grows past thousands of rows | Export project data |
| Data Migration States | pending migration count and drift (an applied migration whose file changed or disappeared) are reported as two separate signals rather than folded into one | Check database status |
| Recovery | the database is copied aside into a timestamped backup file before any migration runs, so a bad migration leaves a pre-migration snapshot to restore from; if there is no existing database to replace (fresh project), the plan says so and skips taking a pre-restore safety copy since there is nothing to lose | Apply versioned migrations, Restore the database from backup |
| Limits And Quotas | KEEP_BACKUPS is fixed at 10; the moment a new backup pushes the count past that, the oldest files are deleted automatically, oldest first by timestamp | Back up the database |
| Versioning | schema version is reported as current-of-latest against the migrations directory on disk, so a directory with newer migration files than the database immediately shows a version gap; the header always records the exact schema version at export time, so a later import can compare it against the destination database's version; an export whose schema version is newer than the current database is refused with an instruction to migrate the database first, rather than attempting a partial load | Check database status, Export project data, Import project data |
| Consistency | Documentation generation and task derivation run in their own transactions outside the project-creation transaction; a failure there is caught and recorded as failed without undoing the project that was already created.; each migration commits in its own transaction and rolls back only itself on failure, so a multi-migration run that fails partway leaves the schema at whichever version the last successful migration reached, not back at the start; an export tagged for a different project id than what is already in a non-empty database is refused, naming both project ids, so two unrelated projects cannot be merged by accident | Create the project database on acceptance, Apply versioned migrations, Import project data |
| Auditability | the exit code reflects actual health, zero only when integrity is sound and no drift exists, so other tooling can gate on it without parsing text | Check database status |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | One live surface, Data at #/data. The Schema surface is retired. |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Filled | One recorded action on the Data surface; every write to the store is a command. |
| 4 | API surface | Filled | Seven operations: db status, db migrate, db backup, db restore, export, import and schema show. |
| 5 | Data | Filled | The module owns the store itself, and its recorded entity is the catalogue of what is stored. |
| 6 | End-to-end wiring | Filled | Proven by journey: a migration applies forward-only against a checksum, db status reports fifteen of fifteen, and the Data view reads the resulting schema. |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Filled | Each applied migration is recorded with its checksum, and every write appends an activity event. |
| 9 | Edge cases | Filled | Twenty-six across the seven features, including a checksum that no longer matches, a restore from a backup of an older schema, and an append-only history refusing an edit. |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Filled | The store translates a constraint failure into a sentence: a foreign key, check or not-null violation is reported as what was wrong with the value, not as the constraint that caught it. |
| 17 | URL state and deep links | Open | Not recorded |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | Migrations are forward-only and checksummed, and the schema validator plus db status are re-run before every release. |
