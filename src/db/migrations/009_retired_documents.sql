-- A document whose record no longer exists.
--
-- docs generate already noticed these and skipped them, which left them in the
-- table marked generated at whatever revision they were last written. Freshness
-- then counted them behind forever and no later run could clear it: five
-- documents from an earlier schema sat at revision 681 while the documentation
-- check confirmed all 295 files matched the database. Two checks disagreeing
-- about the same files is worse than either being wrong.
--
-- retired says what is true. The row stays queryable so what was once
-- documented is still answerable, and freshness stops counting it as work
-- outstanding, because a document for a deleted record is not behind. It is
-- finished with.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt. Columns are
-- listed explicitly rather than copied with a wildcard, because a silent column
-- mismatch here would lose documentation state.

CREATE TABLE documents_next (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  kind                TEXT NOT NULL,
  scope_type          TEXT NOT NULL,
  scope_id            TEXT,
  path                TEXT NOT NULL,
  template            TEXT,
  database_revision   INTEGER NOT NULL DEFAULT 0,
  generated_body      TEXT,
  generated_hash      TEXT,
  manual_hash         TEXT,
  sync_status         TEXT NOT NULL DEFAULT 'generated'
    CHECK (sync_status IN ('generated', 'manual_edit_pending', 'accepted',
                           'rejected', 'missing', 'retired')),
  generated_at        TEXT,
  regeneration_mode   TEXT NOT NULL DEFAULT 'authored_projection',
  source_fingerprint  TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, path)
);

INSERT INTO documents_next (
  id, project_id, kind, scope_type, scope_id, path, template, database_revision,
  generated_body, generated_hash, manual_hash, sync_status, generated_at,
  regeneration_mode, source_fingerprint)
SELECT
  id, project_id, kind, scope_type, scope_id, path, template, database_revision,
  generated_body, generated_hash, manual_hash, sync_status, generated_at,
  regeneration_mode, source_fingerprint
FROM documents;

DROP TABLE documents;
ALTER TABLE documents_next RENAME TO documents;

CREATE INDEX IF NOT EXISTS idx_documents_sync ON documents (sync_status);
