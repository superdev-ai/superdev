// Every path the published package's own code reaches must be inside the
// published package.
//
// scripts/providers/detect.mjs was imported by src/cli.mjs and src/init/index.mjs
// and was not listed in package.json's files array. So on every npm install of
// superdev-cli, provider readiness reported "could not be determined: Cannot find
// module", the init skill's step about checking readiness before relying on it
// could never succeed, and doctor printed Pass beside the failure. It worked
// everywhere except where users install it, because the plugin copy carries the
// whole repository and the npm package carries an allowlist.
//
// Nothing caught it because nothing compared what the code imports against what
// the package ships. The files array is edited by hand, and a missing entry is
// invisible locally and fatal remotely, which is the exact shape of defect a
// validator is for.

import { join, posix, relative, sep } from "node:path";

import { ERROR, WARNING, finding, importSpecifiers, isDirectory, readJson, readText, walk } from "./common.mjs";

export const name = "packaging";

const SCANNED_ROOTS = ["src", "scripts", "hooks"];

const slash = (path) => path.split(sep).join("/");

/**
 * Would `npm pack` include this path, given the files array?
 *
 * Deliberately stricter than npm's own matching. A false finding costs somebody
 * a reading; a missed one costs a release that fails in a stranger's terminal.
 */
export function packaged(patterns, path) {
  // npm includes these whatever the files array says.
  if (path === "package.json" || /^(README|LICENSE|LICENCE|NOTICE|CHANGELOG)/i.test(path)) return true;

  let included = false;
  for (const raw of patterns) {
    const negated = raw.startsWith("!");
    const pattern = negated ? raw.slice(1) : raw;
    if (matches(pattern, path)) included = !negated;
  }
  return included;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matches(pattern, path) {
  if (pattern.endsWith("/")) return path.startsWith(pattern);
  if (pattern.includes("*")) {
    const source = pattern
      .split("**").map((part) => part.split("*").map(escape).join("[^/]*"))
      .join(".*");
    return new RegExp(`^${source}$`).test(path);
  }
  return path === pattern || path.startsWith(`${pattern}/`);
}

export async function run(root) {
  const findings = [];
  const read = readJson(join(root, "package.json"));
  if (read.error) {
    findings.push(finding("PK-000", ERROR, "package.json", `cannot be read: ${read.error}`));
    return { name, findings };
  }
  const manifest = read.value;
  const patterns = manifest?.files;

  if (!Array.isArray(patterns) || !patterns.length) {
    findings.push(finding("PK-000", ERROR, "package.json",
      "there is no files array, so the package would ship whatever happens to be in the directory"));
    return { name, findings };
  }

  // The bin entry has to be in the package before anything else matters.
  const bin = typeof manifest.bin === "string" ? manifest.bin : Object.values(manifest.bin ?? {})[0];
  if (bin) {
    const target = posix.normalize(String(bin).replace(/^\.\//, ""));
    if (!packaged(patterns, target)) {
      findings.push(finding("PK-001", ERROR, "package.json",
        `bin points at ${target}, which the files array does not include, so the installed command would not exist`));
    }
  }

  const files = SCANNED_ROOTS
    .filter((dir) => isDirectory(join(root, dir)))
    .flatMap((dir) => walk(join(root, dir)))
    .filter((file) => file.endsWith(".mjs") || file.endsWith(".js"))
    .map((file) => slash(relative(root, file)))
    // Only shipped code can fail at runtime in somebody's install. A script that
    // is deliberately repository-only may import whatever it likes.
    .filter((path) => packaged(patterns, path) && !path.endsWith(".test.mjs"));

  for (const path of files) {
    const from = posix.dirname(path);
    const seen = new Set();
    for (const spec of importSpecifiers(readText(join(root, path)))) {
      if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
      const target = posix.normalize(posix.join(from, spec));
      if (seen.has(target)) continue;
      seen.add(target);

      if (!/\.(mjs|js|json|css|md)$/.test(target)) {
        findings.push(finding("PK-003", WARNING, path,
          `imports ${spec}, which names no file extension, so whether the package ships it cannot be decided here`));
        continue;
      }
      if (!packaged(patterns, target)) {
        findings.push(finding("PK-002", ERROR, path,
          `imports ${target}, which package.json files does not include, so the published package cannot resolve it`));
      }
    }
  }

  return { name, findings };
}
