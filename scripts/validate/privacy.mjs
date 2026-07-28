// Confidentiality. This project is developed against private material that must
// never reach the public repository: no absolute home path, no credential, no
// private project identifier, in source, comments, generated artifacts or
// examples.
//
// The screening rules are the ones the storage boundary already enforces, so a
// string refused on write cannot arrive through a file instead. The private
// identifier list lives outside the repository by design and is supplied at run
// time through SUPERDEV_DENYLIST; findings carry rule ids and locations only,
// never the matched value, because echoing a denylist entry into a report is
// itself the leak.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasHomePath, looksSecret } from "../../src/model/screening.mjs";
import { ERROR, finding, ownedFiles, readText } from "./common.mjs";

export const name = "privacy";

const DENYLIST_ENV = "SUPERDEV_DENYLIST";

/** Registry integrity hashes are the point of a lockfile, not a leak. */
const LOCKFILES = new Set([
  "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-lock.yml",
  "yarn.lock", "bun.lock", "Cargo.lock", "Gemfile.lock", "poetry.lock",
  "Pipfile.lock", "uv.lock", "go.sum", "composer.lock",
]);

/**
 * One file is exempt from the credential heuristic, by name and for one reason:
 * `src/model/screening.mjs` is where that heuristic is defined, so it contains
 * the shapes it looks for and the refusal codes it raises. A scanner that
 * reports its own rule book teaches people to skim its output, which costs more
 * than the finding is worth.
 *
 * Deliberately not a mechanism. There is no wildcard, no directory, no comment
 * pragma and no environment override: adding a second exempt file means editing
 * this line and justifying it here. The exemption covers this rule only; the
 * home-path rule and the denylist still judge the file in full, and the storage
 * boundary still refuses the same strings at run time.
 */
const DEFINES_THE_CREDENTIAL_RULE = "src/model/screening.mjs";

/**
 * The compiled control center, exempt from the credential heuristic for the same
 * narrow reason and no broader one: it is a build artifact, and its source in
 * `ui/src` is scanned in full by this same validator. Minified vendor code trips
 * the heuristic without holding a credential; the observed case was a framework
 * lookup table mapping HTML input type names to booleans, one of which is the
 * name of a credential field followed by a separator and a value, which is the
 * shape the rule looks for.
 *
 * The home-path rule and the denylist still judge this file, because those catch
 * a real leak that minification would carry through unchanged.
 */
const COMPILED_BUNDLE = "src/service/assets/control-center.html";

/** Case-insensitive substrings, one per line, # comments. Never echoed. */
export function loadDenylist(file) {
  const text = readText(file);
  if (text === null) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((pattern, index) => ({ id: `PV-DL-${index + 1}`, pattern: pattern.toLowerCase() }));
}

export async function run(root) {
  const findings = [];
  const files = ownedFiles(root);
  if (!files.length) {
    findings.push(finding("PV-000", ERROR, ".", "no project-owned text files found; there is nothing to scan"));
    return { name, findings };
  }

  // The private identifier list is external by design. When it is configured it
  // must load: a denylist that quietly fails to read is worse than none, because
  // the run then claims a check it did not perform.
  const denylistFile = process.env[DENYLIST_ENV];
  let denylist = [];
  if (denylistFile && !existsSync(denylistFile)) {
    findings.push(finding("PV-003", ERROR, ".",
      `${DENYLIST_ENV} points at a file that does not exist, so private identifiers were not checked`));
  } else if (denylistFile) {
    denylist = loadDenylist(denylistFile);
  }

  for (const path of files) {
    const text = readText(join(root, path));
    if (text === null) continue;
    const isLockfile = LOCKFILES.has(path.split("/").pop());
    const lower = denylist.length ? text.toLowerCase() : "";

    text.split("\n").forEach((line, index) => {
      const where = `${path}:${index + 1}`;
      if (hasHomePath(line)) {
        findings.push(finding("PV-001", ERROR, where,
          "absolute home path; it names a machine and it points nowhere on anyone else's"));
      }
      if (!isLockfile && path !== DEFINES_THE_CREDENTIAL_RULE && path !== COMPILED_BUNDLE && looksSecret(line)) {
        findings.push(finding("PV-002", ERROR, where,
          "secret-shaped string; store a reference, never the value"));
      }
    });

    for (const { id, pattern } of denylist) {
      if (lower.includes(pattern)) {
        findings.push(finding(id, ERROR, path, "matches a private identifier from the external denylist"));
      }
    }
  }

  return { name, findings };
}
