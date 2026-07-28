#!/usr/bin/env node
// Compile the control center into the one committed bundle the plugin ships.
//
// ADR-0020: `ui/` is the only source, its output lands at exactly one path, and
// a manifest records the hash of the sources that produced it. `check` rebuilds
// and fails on drift, which is what makes the committed file a deterministic
// build artifact rather than a second copy someone edits by hand.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, renameSync, statSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UI = join(ROOT, "ui");
const DIST = join(UI, "dist");
const OUT_DIR = join(ROOT, "src", "service", "assets");
const OUT_HTML = join(OUT_DIR, "control-center.html");
const OUT_MANIFEST = join(OUT_DIR, "control-center.manifest.json");

const DATA_PLACEHOLDER = "/*__SUPERDEV_DATA__*/null";

/** Every file that can change the build output, hashed in a stable order. */
function sourceFingerprint() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(UI);
  const h = createHash("sha256");
  for (const f of files) {
    h.update(relative(ROOT, f).replace(/\\/g, "/"));
    h.update(readFileSync(f));
  }
  return { hash: h.digest("hex"), fileCount: files.length };
}

/**
 * Exactly one CSS and one JS chunk. `build.modulePreload: false` in the Vite
 * config is what guarantees this; if that setting is lost the assertion fires
 * here rather than silently shipping half an application.
 */
function onlyAsset(dir, ext) {
  const matches = readdirSync(dir).filter((f) => f.endsWith(ext));
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one ${ext} in ${dir}, found ${matches.length}: ${matches.join(", ")}. ` +
      `Check that build.modulePreload is false in ui/vite.config.ts.`,
    );
  }
  return join(dir, matches[0]);
}

/** A closing tag inside inlined content would end the element early. */
const inlineSafe = (text) =>
  text.replace(/<\/(style|script)/gi, "<\\/$1");

function compose() {
  const css = inlineSafe(readFileSync(onlyAsset(join(DIST, "assets"), ".css"), "utf8"));
  const js = inlineSafe(readFileSync(onlyAsset(join(DIST, "assets"), ".js"), "utf8"));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Superdev</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script id="superdev-bootstrap" type="application/json">${DATA_PLACEHOLDER}</script>
<script type="module">${js}</script>
</body>
</html>
`;
}

function build() {
  if (!existsSync(UI)) throw new Error(`no control center source at ${UI}`);
  execFileSync("npm", ["run", "build"], { cwd: UI, stdio: "inherit" });

  const html = compose();
  const fingerprint = sourceFingerprint();
  mkdirSync(OUT_DIR, { recursive: true });

  const tmp = `${OUT_HTML}.tmp`;
  writeFileSync(tmp, html);
  renameSync(tmp, OUT_HTML);

  writeFileSync(
    OUT_MANIFEST,
    JSON.stringify(
      {
        source: "ui/",
        sourceHash: fingerprint.hash,
        sourceFileCount: fingerprint.fileCount,
        bundleHash: createHash("sha256").update(html).digest("hex"),
        bundleBytes: Buffer.byteLength(html),
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`control center written to ${relative(ROOT, OUT_HTML)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
  return 0;
}

function check() {
  if (!existsSync(OUT_HTML) || !existsSync(OUT_MANIFEST)) {
    console.error("no committed control-center bundle. Run: npm run ui:build");
    return 1;
  }
  const manifest = JSON.parse(readFileSync(OUT_MANIFEST, "utf8"));
  const current = sourceFingerprint();
  if (current.hash !== manifest.sourceHash) {
    console.error(
      "the control-center source changed but the committed bundle was not rebuilt.\n" +
      `  manifest source hash: ${manifest.sourceHash.slice(0, 16)}\n` +
      `  current source hash:  ${current.hash.slice(0, 16)}\n` +
      "Run: npm run ui:build",
    );
    return 1;
  }
  const bundleHash = createHash("sha256").update(readFileSync(OUT_HTML, "utf8")).digest("hex");
  if (bundleHash !== manifest.bundleHash) {
    console.error("the committed bundle does not match its manifest. Run: npm run ui:build");
    return 1;
  }
  console.log("control-center bundle matches its source");
  return 0;
}

const mode = process.argv[2] ?? "build";
try {
  if (mode === "build") process.exit(build());
  else if (mode === "check") process.exit(check());
  else {
    console.error("usage: build-ui.mjs [build|check]");
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
