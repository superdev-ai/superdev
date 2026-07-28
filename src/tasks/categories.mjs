// Task categories as data.
//
// The seeded set is a starting vocabulary, not a closed list: brief section 7.3
// says a project may add its own, and a category nobody can add is a constant
// wearing a table's clothes.
//
// Nothing here deletes. A category names work already filed under it, so
// removing the row would quietly rewrite that history; retiring keeps the name
// readable while taking it out of the pickable list.

import { mutate, query, create, recordActivity, currentProject, DbError } from "../db/store.mjs";
import { slugify } from "../model/ids.mjs";

export const E = {
  DUPLICATE: "E_CATEGORY_EXISTS",
  NOT_FOUND: "E_CATEGORY_NOT_FOUND",
  SYSTEM: "E_CATEGORY_IS_SYSTEM",
  IN_USE: "E_CATEGORY_IN_USE",
};

const norm = (name) => String(name ?? "").trim();

/** Every category, with how many tasks currently carry it. */
export async function listCategories(root, { includeRetired = true } = {}) {
  return query(root, async (db) => {
    const project = await currentProject(db);
    if (!project) return [];
    const rows = await db.all(
      `SELECT c.*, (SELECT count(*) FROM tasks t WHERE t.category_id = c.id) AS task_count
         FROM task_categories c
        WHERE c.project_id = ?${includeRetired ? "" : " AND c.active = 1"}
        ORDER BY c.active DESC, c.sequence, c.name`,
      project.id,
    );
    return rows;
  });
}

export async function createCategory(root, { name, description = null, actor = "superdev" } = {}) {
  const clean = norm(name);
  if (!clean) {
    throw new DbError("E_INVALID", "A category needs a name. Say what kind of work it describes.");
  }
  return mutate(root, async (db) => {
    const project = await currentProject(db);
    if (!project) throw new DbError("E_NOT_FOUND", "This directory has no Superdev project yet. Run superdev init first.");

    const clash = await db.get(
      "SELECT id, active FROM task_categories WHERE project_id = ? AND lower(name) = lower(?)",
      project.id, clean,
    );
    if (clash) {
      throw new DbError(
        E.DUPLICATE,
        clash.active
          ? `This project already has a category called ${clean}.`
          : `This project has a retired category called ${clean}. Restore it rather than creating a second one.`,
        { categoryId: clash.id },
      );
    }

    const next = (await db.value(
      "SELECT max(sequence) FROM task_categories WHERE project_id = ?", project.id,
    )) ?? -1;

    return create(db, "task_category", {
      project_id: project.id,
      name: clean,
      description: description ? String(description).trim() : null,
      color_token: `category-${slugify(clean)}`,
      // A category the project added is not a system one, so it can be renamed
      // and retired freely.
      system: 0,
      active: 1,
      sequence: next + 1,
    }, {
      projectId: project.id,
      actor,
      activitySummary: `Added task category ${clean}`,
    });
  });
}

export async function updateCategory(root, categoryId, { name, description, actor = "superdev" } = {}) {
  return mutate(root, async (db) => {
    const row = await db.get("SELECT * FROM task_categories WHERE id = ?", categoryId);
    if (!row) throw new DbError(E.NOT_FOUND, `There is no category ${categoryId}.`);

    const values = {};
    if (name !== undefined && name !== null && norm(name) && norm(name) !== row.name) {
      if (row.system) {
        throw new DbError(
          E.SYSTEM,
          `${row.name} is one of the categories Superdev seeds, so renaming it would make this project's vocabulary disagree with every other one. Add your own category instead.`,
        );
      }
      const clash = await db.get(
        "SELECT id FROM task_categories WHERE project_id = ? AND lower(name) = lower(?) AND id <> ?",
        row.project_id, norm(name), categoryId,
      );
      if (clash) throw new DbError(E.DUPLICATE, `This project already has a category called ${norm(name)}.`);
      values.name = norm(name);
      values.color_token = `category-${slugify(norm(name))}`;
    }
    // A description is editable on any category, including a seeded one: saying
    // what a category means in this project's words is the point.
    if (description !== undefined) {
      values.description = description === null ? null : String(description).trim() || null;
    }
    if (!Object.keys(values).length) return row;

    // task_categories carries no version column, so the optimistic path does not
    // apply here. A category is a short label owned by one project; the write is
    // still inside this transaction and still records its activity.
    const columns = Object.keys(values);
    await db.run(
      `UPDATE task_categories SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
      ...columns.map((c) => values[c]), categoryId,
    );
    await recordActivity(db, row.project_id, {
      type: "specification_changed",
      actor,
      summary: `Renamed task category ${row.name} to ${values.name ?? row.name}`,
      metadata: { categoryId, changed: columns },
    });
    return db.get("SELECT * FROM task_categories WHERE id = ?", categoryId);
  });
}

/**
 * Retire or restore. Retiring takes a category out of the pickable list and
 * leaves every task that already carries it alone, which is why it is a status
 * change rather than a delete.
 */
export async function setCategoryActive(root, categoryId, active, actor = "superdev") {
  return mutate(root, async (db) => {
    const row = await db.get("SELECT * FROM task_categories WHERE id = ?", categoryId);
    if (!row) throw new DbError(E.NOT_FOUND, `There is no category ${categoryId}.`);
    if (Boolean(row.active) === Boolean(active)) return row;

    const inUse = await db.value("SELECT count(*) FROM tasks WHERE category_id = ?", categoryId);
    await db.run("UPDATE task_categories SET active = ? WHERE id = ?", active ? 1 : 0, categoryId);

    await recordActivity(db, row.project_id, {
      type: "specification_changed",
      actor,
      summary: active
        ? `Restored task category ${row.name}`
        : `Retired task category ${row.name}${inUse ? `, still carried by ${inUse} task(s)` : ""}`,
      metadata: { categoryId, active: Boolean(active), taskCount: inUse },
    });
    return db.get("SELECT * FROM task_categories WHERE id = ?", categoryId);
  });
}
