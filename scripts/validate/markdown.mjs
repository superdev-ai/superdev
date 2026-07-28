// Generated Markdown under talks/.
//
// Markdown here is a projection of accepted database content, never a second
// writable source of truth. Three things make that claim checkable: the marker
// says which record and revision produced the file, the hash says the body is
// still the body that was generated, and a relative link that resolves says the
// projection is internally consistent rather than merely well formed.
//
// A file whose hash no longer matches is not a defect in this validator: it is
// a pending edit proposal, and it is reported so that it gets reviewed rather
// than silently overwritten.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { ERROR, finding, isDirectory, readText, rel, walk } from "./common.mjs";

export const name = "markdown";

// <!-- superdev:generated source=FEAT-0007 revision=42 hash=<sha256-of-body> -->
const MARKER = /^<!--\s*superdev:generated\s+source=(\S+)\s+revision=(\d+)\s+hash=([0-9a-f]{64})\s*-->\s*$/;

const INLINE_LINK = /!?\[[^\]]*\]\(\s*<?([^)<>\s]+)(?:\s+"[^"]*")?\s*>?\s*\)/g;
const REFERENCE_LINK = /^\s{0,3}\[[^\]]+\]:\s*<?([^\s<>]+)>?/gm;

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * The body the hash covers: everything after the marker line, LF line endings,
 * no trailing whitespace on any line, exactly one terminal newline. Stated in
 * the module contract, restated here because a renderer and a validator that
 * disagree about normalization produce a permanent false proposal.
 */
export function normalizeBody(body) {
  const normalized = String(body)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
  return normalized.replace(/\n+$/, "") + "\n";
}

export const bodyHash = (body) => createHash("sha256").update(normalizeBody(body)).digest("hex");

/** Every relative link target in a document, deduplicated, anchors removed. */
export function linkTargets(text) {
  const targets = new Set();
  for (const pattern of [INLINE_LINK, REFERENCE_LINK]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const raw = match[1];
      if (!raw || EXTERNAL.test(raw)) continue;
      const target = raw.split("#")[0].split("?")[0];
      if (target) targets.add(target);
    }
  }
  return [...targets].sort();
}

export async function run(root) {
  const findings = [];
  const talks = join(root, "talks");

  // A repository that has never been initialized as a Superdev project has no
  // generated Markdown, and that is not a defect: there is no database, so
  // nothing has been generated and nothing is missing. This is distinct from the
  // absent-input case ADR-0019 requires a validator to fail on, which is when a
  // project DOES exist and its documents are gone. Superdev's own repository is
  // exactly this case: its documentation is docs/ and README, and it is not
  // itself managed as a Superdev project.
  const initialized = existsSync(join(root, ".superdev", "superdev.db"));

  if (!isDirectory(talks)) {
    if (!initialized) return { name, findings, note: "no project here, so no generated Markdown to inspect" };
    findings.push(finding("MD-000", ERROR, "talks",
      "this project has a database but no talks directory; run superdev docs generate"));
    return { name, findings };
  }

  const files = walk(talks).filter((file) => extname(file) === ".md");
  if (!files.length) {
    if (!initialized) return { name, findings, note: "no project here, so no generated Markdown to inspect" };
    findings.push(finding("MD-000", ERROR, "talks",
      "this project has a database but talks/ holds no documents; run superdev docs generate"));
    return { name, findings };
  }

  for (const file of files) {
    const path = rel(root, file);
    const text = readText(file);
    if (text === null) {
      findings.push(finding("MD-005", ERROR, path, "document is unreadable"));
      continue;
    }

    const newline = text.indexOf("\n");
    const firstLine = newline === -1 ? text : text.slice(0, newline);
    const marker = firstLine.match(MARKER);
    if (!marker) {
      findings.push(finding("MD-001", ERROR, path,
        "carries no superdev:generated marker, so nothing records which record and revision produced it"));
    } else {
      const [, source, , recordedHash] = marker;
      if (!/^[A-Z]{1,5}-\d{4,}$/.test(source)) {
        findings.push(finding("MD-002", ERROR, path, `marker source "${source}" is not a Superdev identifier`));
      }
      const actual = bodyHash(newline === -1 ? "" : text.slice(newline + 1));
      if (actual !== recordedHash) {
        findings.push(finding("MD-003", ERROR, path,
          "body does not match the hash in its marker; this is a pending edit proposal, not a file to overwrite"));
      }
    }

    for (const target of linkTargets(text)) {
      const resolved = resolve(dirname(file), target);
      if (!existsSync(resolved)) {
        findings.push(finding("MD-004", ERROR, path, `relative link "${target}" does not resolve`));
      }
    }
  }

  return { name, findings };
}
