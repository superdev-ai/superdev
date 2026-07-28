// Writing style. Superdev never generates or persists em dash characters or
// emoji, and the rule is enforced at the storage boundary so nothing new can
// land. This validator covers what is already on disk, and proves a clean tree
// stays clean.
//
// Scope is files this project owns. Vendored material, build output and the
// append-only ledgers are excluded: rewriting someone else's prose is not this
// tool's business, and editing a record of what actually happened so it reads
// as compliant is the dishonest reading of a policy about honesty.

import { join } from "node:path";
import { ERROR, finding, ownedFiles, readText } from "./common.mjs";
import { EMOJI_PATTERN } from "../../src/model/screening.mjs";

export const name = "style";

// Written as an escape on purpose. A literal here would make this file fail its
// own rule and every scan of the repository would report the scanner.
const EM_DASH = "\u2014";
// Imported, never restated. This validator once carried its own narrower idea
// of emoji, so an arrow or a check mark passed the scan and was then refused by
// the storage boundary: a file could be clean by the tool that judges the tree
// and unstorable by the code that judges a record. One definition, one verdict.
const EMOJI = new RegExp(EMOJI_PATTERN, "gu");

// Build output only.
//
// The four talks/ ledger paths that used to sit here were left over from the
// file-based architecture: history lives in the database now, and talks/ is a
// generated projection whose content came through the storage boundary, so it
// is already clean and stays in scope as proof.
//
// The compiled control centre is different. It is build output that embeds
// third party code, and a minified Markdown parser carries a packed HTML entity
// table whose index bytes land in Unicode blocks with emoji presentation. Those
// are not emoji any reader will ever see; they are offsets in someone else's
// lookup table. Rewriting a vendored library to satisfy a rule about the prose
// this project writes would be the tail wagging the dog. The authored text in
// that bundle is scanned at its source under ui/src, which is where a real
// breach would be introduced and where it will still fail.
const EXCLUDED = [/^dist\//, /^src\/service\/assets\/control-center\.html$/];

export const isExcluded = (path) => EXCLUDED.some((pattern) => pattern.test(path));

export function inspect(path, text) {
  const findings = [];
  text.split("\n").forEach((line, index) => {
    let at = line.indexOf(EM_DASH);
    while (at !== -1) {
      findings.push(finding("ST-001", ERROR, `${path}:${index + 1}:${at + 1}`,
        "em dash character; use a comma, colon, semicolon, parentheses or a hyphen"));
      at = line.indexOf(EM_DASH, at + 1);
    }
    EMOJI.lastIndex = 0;
    let match;
    while ((match = EMOJI.exec(line)) !== null) {
      findings.push(finding("ST-002", ERROR, `${path}:${index + 1}:${match.index + 1}`,
        "emoji, which Superdev never generates"));
      if (match.index === EMOJI.lastIndex) EMOJI.lastIndex++;
    }
  });
  return findings;
}

export async function run(root) {
  const findings = [];
  const files = ownedFiles(root).filter((path) => !isExcluded(path));
  if (!files.length) {
    findings.push(finding("ST-000", ERROR, ".", "no project-owned text files found; there is nothing to scan"));
    return { name, findings };
  }
  for (const path of files) {
    const text = readText(join(root, path));
    if (text === null) continue;
    findings.push(...inspect(path, text));
  }
  return { name, findings };
}
