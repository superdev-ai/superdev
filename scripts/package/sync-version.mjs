// Carry one version across every manifest that declares one.
//
// The CLI and the plugin ship separately and share a single version, which is
// only true if something makes it true. Six places declare it: package.json,
// both plugin manifests, the marketplace metadata and its plugin entry, and the
// CLI version each plugin says it needs. A release bumps the first one, and this
// carries it to the rest.
//
// A validator already refuses a mismatch, so forgetting to run this fails the
// build rather than shipping a plugin that warns every user their tools are out
// of step. This is the thing that stops that happening in the first place.
//
// Run by release-it after it bumps, and by hand when a version is edited.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const apply = process.argv.includes("--apply");

const read = (relative) => {
  const path = join(ROOT, relative);
  return { path, value: JSON.parse(readFileSync(path, "utf8")) };
};

const version = read("package.json").value.version;
if (!version) {
  process.stderr.write("package.json declares no version, so there is nothing to carry.\n");
  process.exit(2);
}

/** Every place a version lives, and how to set it there. */
const TARGETS = [
  [".claude-plugin/plugin.json", (d, v) => {
    d.version = v;
    if (d.requires) d.requires.cli = v;
  }],
  [".codex-plugin/plugin.json", (d, v) => {
    d.version = v;
    if (d.requires) d.requires.cli = v;
  }],
  [".claude-plugin/marketplace.json", (d, v) => {
    if (d.metadata) d.metadata.version = v;
    for (const plugin of d.plugins ?? []) plugin.version = v;
  }],
];

const changed = [];
for (const [relative, set] of TARGETS) {
  let file;
  try {
    file = read(relative);
  } catch {
    continue;
  }
  const before = JSON.stringify(file.value);
  set(file.value, version);
  const after = JSON.stringify(file.value);
  if (before === after) continue;
  changed.push(relative);
  if (apply) writeFileSync(file.path, `${JSON.stringify(file.value, null, 2)}\n`);
}

process.stdout.write(
  changed.length
    ? `${apply ? "Set" : "Would set"} ${version} in ${changed.join(", ")}.\n`
    : `Every manifest already declares ${version}.\n`,
);
