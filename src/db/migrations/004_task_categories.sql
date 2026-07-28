-- More task categories, and a place for a category to say what it means.
--
-- The original twelve came from brief section 7.3, but derivation produces work
-- the twelve could not describe: proving rollout and rollback was filed under
-- Infrastructure, and a surface with its actions under Feature. A category that
-- does not describe the work is worse than no category, because it is a label
-- people learn to ignore.
--
-- The descriptions are written out here rather than read from the vocabulary
-- module because a migration cannot import application code. The module stays
-- the source for newly created projects; this is the one-time backfill for
-- projects that already exist.

ALTER TABLE task_categories ADD COLUMN description TEXT;

-- Meanings for the categories already seeded.
UPDATE task_categories SET description = 'New product behavior somebody asked for.' WHERE name = 'Feature' AND description IS NULL;
UPDATE task_categories SET description = 'Existing behavior made better without changing what it is.' WHERE name = 'Improvement' AND description IS NULL;
UPDATE task_categories SET description = 'Behavior that does not match what was accepted.' WHERE name = 'Bug' AND description IS NULL;
UPDATE task_categories SET description = 'Internal change with no change in behavior.' WHERE name = 'Refactor' AND description IS NULL;
UPDATE task_categories SET description = 'Finding something out before deciding what to build.' WHERE name = 'Investigation' AND description IS NULL;
UPDATE task_categories SET description = 'Keeping the written record in step with the product.' WHERE name = 'Documentation' AND description IS NULL;
UPDATE task_categories SET description = 'Work at the boundary with something outside this product.' WHERE name = 'Integration' AND description IS NULL;
UPDATE task_categories SET description = 'Moving data or schema from one shape to another.' WHERE name = 'Migration' AND description IS NULL;
UPDATE task_categories SET description = 'The ground the product runs on.' WHERE name = 'Infrastructure' AND description IS NULL;
UPDATE task_categories SET description = 'Protecting the product, its data and the people in it.' WHERE name = 'Security' AND description IS NULL;
UPDATE task_categories SET description = 'Work that raises confidence rather than adding behavior.' WHERE name = 'Quality' AND description IS NULL;
UPDATE task_categories SET description = 'Agreed as worth doing, not yet scheduled.' WHERE name = 'Backlog' AND description IS NULL;

-- The nine additions, seeded for every project that already exists. Sequence
-- continues from whatever that project already had, so a project that added its
-- own categories does not have them reordered underneath it.
INSERT INTO task_categories (id, project_id, name, description, system, active, sequence)
SELECT
  'TC-' || substr('0000' || CAST(
    (SELECT count(*) FROM task_categories x WHERE x.project_id = p.id) + n.ord AS TEXT
  ), -4),
  p.id, n.name, n.description, 1, 1,
  (SELECT coalesce(max(x.sequence), -1) FROM task_categories x WHERE x.project_id = p.id) + n.ord
FROM projects p
CROSS JOIN (
  SELECT 1 AS ord, 'Design' AS name, 'Surfaces, actions and how the product presents itself.' AS description
  UNION ALL SELECT 2, 'Testing', 'Product tests derived from the accepted test plan.'
  UNION ALL SELECT 3, 'Performance', 'Meeting a declared speed or capacity target.'
  UNION ALL SELECT 4, 'Accessibility', 'Making the product operable by everyone who uses it.'
  UNION ALL SELECT 5, 'Observability', 'Signals that prove the product is working in the open.'
  UNION ALL SELECT 6, 'Data', 'Modelling the entities and relationships the product owns.'
  UNION ALL SELECT 7, 'Release', 'Getting the work out, and being able to take it back.'
  UNION ALL SELECT 8, 'Compliance', 'Obligations under a regime this project has declared.'
  UNION ALL SELECT 9, 'Chore', 'Routine upkeep that keeps the project healthy.'
) n
WHERE NOT EXISTS (
  SELECT 1 FROM task_categories e WHERE e.project_id = p.id AND e.name = n.name
);

-- A category a project added itself is never silently removed, so retiring one
-- has to be a status change rather than a delete. `active` already carries that;
-- this index makes the common read, the pickable list, cheap.
CREATE INDEX task_categories_active ON task_categories(project_id, active, sequence);
