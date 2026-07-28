// Import boundaries. Superdev runs from a plugin directory on someone else's
// machine with no install step, so a module that imports a package which is not
// there fails at load time, in their session, with a stack trace instead of a
// product. Node builtins and relative paths always resolve. One runtime
// dependency is allowed, and only the single module that owns the connection
// may reach for it, so swapping the engine stays a one file change.

import { join, relative, sep } from "node:path";
import { ERROR, finding, importSpecifiers, isDirectory, readText, rel, walk } from "./common.mjs";

export const name = "imports";

/** The one runtime dependency, and the only module permitted to import it. */
export const RUNTIME_DEPENDENCY = "@tursodatabase/database";
const DEPENDENCY_OWNER = "src/db/connect.mjs";

const SCANNED_ROOTS = ["src", "scripts"];

const isRelative = (spec) => spec.startsWith("./") || spec.startsWith("../");
const isBuiltin = (spec) => spec.startsWith("node:");

export async function run(root) {
  const findings = [];
  const present = SCANNED_ROOTS.filter((dir) => isDirectory(join(root, dir)));
  if (!present.length) {
    findings.push(finding("IM-000", ERROR, SCANNED_ROOTS.join(", "),
      "neither src/ nor scripts/ exists; there are no modules to check"));
    return { name, findings };
  }

  const files = present
    .flatMap((dir) => walk(join(root, dir)))
    .filter((file) => file.endsWith(".mjs") || file.endsWith(".js"));

  if (!files.length) {
    findings.push(finding("IM-000", ERROR, present.join(", "), "no modules found under src/ or scripts/"));
    return { name, findings };
  }

  for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    const path = rel(root, file);
    const owner = relative(root, file).split(sep).join("/") === DEPENDENCY_OWNER;

    for (const spec of new Set(importSpecifiers(text))) {
      if (isBuiltin(spec) || isRelative(spec)) continue;
      if (spec === RUNTIME_DEPENDENCY) {
        if (!owner) {
          findings.push(finding("IM-002", ERROR, path,
            `imports ${RUNTIME_DEPENDENCY} directly; only ${DEPENDENCY_OWNER} may, so the engine stays replaceable in one place`));
        }
        continue;
      }
      findings.push(finding("IM-001", ERROR, path,
        `imports "${spec}", which is neither a node builtin, a relative path, nor the one allowed runtime dependency`));
    }
  }

  return { name, findings };
}
