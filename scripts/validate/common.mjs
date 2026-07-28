// Shared plumbing for the deterministic validators: the finding shape, the
// directories that are never project-owned, and how to list the files this
// project actually authors.
//
// Kept deliberately thin. A validator that needs a rule of its own keeps that
// rule in its own module, so reading one validator tells the whole story.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, sep, extname } from "node:path";

export const ERROR = "error";
export const WARNING = "warning";

/** A finding is data, not a sentence: the runner formats, the validator states. */
export const finding = (code, severity, path, message) => ({ code, severity, path, message });

/** Repo-relative, forward slashes. Absolute machine paths never reach output. */
export const rel = (root, abs) => relative(root, abs).split(sep).join("/") || ".";

/**
 * Directories whose contents this project does not author. Build output and
 * caches are excluded because rewriting or judging them says nothing about the
 * source they came from.
 */
export const SKIP_DIRS = new Set([
  ".git", "node_modules", ".superdev", ".impeccable", ".playwright-mcp",
  "dist", "build", "coverage", ".next", ".turbo", ".cache", ".venv",
]);

/** Extensions whose content this project authors or generates. */
export const TEXT_EXTENSIONS = new Set([
  ".md", ".mjs", ".cjs", ".js", ".ts", ".tsx", ".jsx", ".json", ".jsonc",
  ".html", ".css", ".txt", ".yml", ".yaml", ".sql", ".sh", ".toml",
]);

/** Every file under `dir`, depth first, skipping directories nobody authors. */
export function walk(dir, { skip = SKIP_DIRS } = {}) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = join(current, entry.name);
      // Symlinks are followed by neither walker: a link can leave the tree.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out.sort();
}

export function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export function readJson(file) {
  const text = readText(file);
  if (text === null) return { error: "unreadable" };
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return { error: String(err.message ?? err) };
  }
}

export const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();

/**
 * Text files this project owns, repo-relative. Git decides ownership when the
 * root is a repository: tracked files plus untracked ones git is not ignoring.
 * Tracked alone would let a file authored this minute escape every content rule
 * until someone committed it, which is exactly when the rule matters. Otherwise
 * the tree is walked with the same exclusions.
 */
export function ownedFiles(root) {
  let listed = [];
  try {
    listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    listed = walk(root).map((abs) => rel(root, abs));
  }
  return listed
    .filter((path) => TEXT_EXTENSIONS.has(extname(path)))
    .filter((path) => !path.split("/").some((segment) => SKIP_DIRS.has(segment)))
    .filter((path) => existsSync(join(root, path)))
    .sort();
}

/** kebab-case, the only shape a plugin or skill name may take. */
export const isKebab = (value) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(value ?? ""));

/**
 * Minimal frontmatter reader, scoped to the key/value frontmatter this project
 * writes. Not a general YAML parser, and deliberately not one: a validator that
 * needs a parser dependency stops being deterministic plumbing.
 */
export function parseFrontmatter(text) {
  const match = String(text ?? "").match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  let currentKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      fields[currentKey] = kv[2];
    } else if (currentKey && /^\s+\S/.test(line)) {
      fields[currentKey] += " " + line.trim();
    }
  }
  return fields;
}

/** Import specifiers in an ESM module: static, re-export, and literal dynamic. */
export function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g,
    /(?:^|\n)\s*import\s+["']([^"']+)["']/g,
    /(?:^|\n)\s*export\s[^;]*?from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of String(text).matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}
