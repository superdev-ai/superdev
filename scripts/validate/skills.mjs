// Skill packaging rules. A skill is loaded by name from its directory and its
// body is read into a context window, so the name has to match the directory,
// the description has to fit the field a host reserves for it, and every path
// the prose names has to exist inside the installed plugin.

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ERROR, finding, isDirectory, parseFrontmatter, readText, rel } from "./common.mjs";

export const name = "skills";

const MAX_DESCRIPTION = 1024;
const MAX_LINES = 500;

// `node some/path.mjs` in skill prose silently depends on the working
// directory. Installed under a plugin root, that path points nowhere.
const CWD_DEPENDENT = /node\s+(?!"?\$\{CLAUDE_PLUGIN_ROOT\})"?[A-Za-z_.][^"\s]*\.mjs/;
// Backticked paths a skill claims to ship. Templated examples are not claims.
const RESOURCE_MENTION = /`(\$\{CLAUDE_PLUGIN_ROOT\}\/)?((?:skills|references|assets|scripts)\/[A-Za-z0-9._/{}-]+\.(?:md|mjs|json|sql))`/g;

function markdownFiles(dir) {
  if (!isDirectory(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(dir, entry.name))
    .sort();
}

function lintOne(root, skillDir, findings) {
  const directory = basename(skillDir);
  const skillFile = join(skillDir, "SKILL.md");
  const path = rel(root, skillFile);

  const text = readText(skillFile);
  if (text === null) {
    findings.push(finding("SK-001", ERROR, path, "SKILL.md is missing or unreadable"));
    return;
  }

  const lines = text.split("\n").length;
  if (lines > MAX_LINES) {
    findings.push(finding("SK-002", ERROR, path,
      `SKILL.md is ${lines} lines, over the ${MAX_LINES} line budget; move detail into references/`));
  }

  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    findings.push(finding("SK-003", ERROR, path, "frontmatter is missing or does not parse"));
    return;
  }
  if ((frontmatter.name ?? "") !== directory) {
    findings.push(finding("SK-004", ERROR, path,
      `frontmatter name "${frontmatter.name ?? ""}" does not match directory "${directory}"`));
  }
  const description = frontmatter.description ?? "";
  if (!description.trim()) {
    findings.push(finding("SK-005", ERROR, path, "description is missing; a host cannot decide when to load this skill"));
  } else if (description.length > MAX_DESCRIPTION) {
    findings.push(finding("SK-005", ERROR, path,
      `description is ${description.length} characters, over the ${MAX_DESCRIPTION} character limit`));
  }

  // A bare `references/...` mention only resolves when the skill bundles its own.
  if (/`references\//.test(text) && !isDirectory(join(skillDir, "references"))) {
    findings.push(finding("SK-006", ERROR, path,
      "names a bare references/ path but ships no references/ directory; use ${CLAUDE_PLUGIN_ROOT}/references/"));
  }

  const bodies = [skillFile, ...markdownFiles(join(skillDir, "references"))];
  for (const file of bodies) {
    const body = readText(file);
    if (body === null) continue;
    const bodyPath = rel(root, file);
    body.split("\n").forEach((line, index) => {
      if (CWD_DEPENDENT.test(line)) {
        findings.push(finding("SK-007", ERROR, `${bodyPath}:${index + 1}`,
          "runs a script by working-directory-relative path; anchor it to ${CLAUDE_PLUGIN_ROOT}"));
      }
    });
    for (const match of body.matchAll(RESOURCE_MENTION)) {
      const [, pluginRoot, mentioned] = match;
      if (mentioned.includes("{{")) continue;
      const target = pluginRoot ? join(root, mentioned) : join(skillDir, mentioned);
      if (!existsSync(target)) {
        findings.push(finding("SK-008", ERROR, bodyPath, `names ${mentioned}, which does not exist`));
      }
    }
  }
}

export async function run(root) {
  const findings = [];
  const skillsDir = join(root, "skills");
  if (!isDirectory(skillsDir)) {
    findings.push(finding("SK-000", ERROR, "skills", "there is no skills directory; the skill validator has nothing to inspect"));
    return { name, findings };
  }

  const directories = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsDir, entry.name))
    .sort();

  if (!directories.length) {
    findings.push(finding("SK-000", ERROR, "skills", "the skills directory is empty; the skill validator has nothing to inspect"));
    return { name, findings };
  }

  for (const dir of directories) lintOne(root, dir, findings);

  return { name, findings };
}
