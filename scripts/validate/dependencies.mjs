// Dependency policy. Every package declared here has to exist on a machine
// Superdev did not install anything on, so the list stays at exactly what the
// database engine needs. Versions are pinned rather than ranged, because a
// caret range means the plugin someone installed last month and the plugin they
// install today are not the same software.

import { join } from "node:path";
import { ERROR, finding, readJson } from "./common.mjs";
import { RUNTIME_DEPENDENCY } from "./imports.mjs";

export const name = "dependencies";

export const ALLOWED_RUNTIME = new Set([RUNTIME_DEPENDENCY]);

/** The Node floor the module contract states. */
const MINIMUM_NODE_MAJOR = 20;

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export async function run(root) {
  const findings = [];
  const file = join(root, "package.json");
  const { value: pkg, error } = readJson(file);
  if (error) {
    findings.push(finding("DP-000", ERROR, "package.json",
      error === "unreadable" ? "package.json is missing; there is no dependency declaration to check" : `package.json is not valid JSON: ${error}`));
    return { name, findings };
  }

  for (const [dependency, version] of Object.entries(pkg.dependencies ?? {})) {
    if (!ALLOWED_RUNTIME.has(dependency)) {
      findings.push(finding("DP-001", ERROR, "package.json",
        `runtime dependency "${dependency}" is not on the allowlist; the plugin ships without an install step`));
      continue;
    }
    if (!EXACT_VERSION.test(String(version))) {
      findings.push(finding("DP-002", ERROR, "package.json",
        `dependency "${dependency}" is declared as "${version}"; pin an exact version so every install is the same software`));
    }
  }

  // A dev dependency is still a dependency someone has to resolve, and this
  // repository deliberately has no build or test toolchain to justify one.
  for (const dependency of Object.keys(pkg.devDependencies ?? {})) {
    findings.push(finding("DP-003", ERROR, "package.json",
      `dev dependency "${dependency}" is declared; the plugin repository carries no toolchain of its own`));
  }

  const engine = pkg.engines?.node;
  if (typeof engine !== "string" || !engine.trim()) {
    findings.push(finding("DP-004", ERROR, "package.json",
      "engines.node is not declared, so nothing states which Node the plugin requires"));
  } else {
    const major = Number((engine.match(/(\d+)/) ?? [])[1]);
    if (!Number.isFinite(major)) {
      findings.push(finding("DP-004", ERROR, "package.json", `engines.node "${engine}" names no version`));
    } else if (major !== MINIMUM_NODE_MAJOR) {
      findings.push(finding("DP-005", ERROR, "package.json",
        `engines.node "${engine}" does not pin the Node ${MINIMUM_NODE_MAJOR} floor the module contract states`));
    }
  }

  if (pkg.type !== "module") {
    findings.push(finding("DP-006", ERROR, "package.json",
      `type is "${pkg.type ?? "(absent)"}"; the source is ESM and a .mjs entry point should not depend on that`));
  }

  return { name, findings };
}
