// Plugin manifests and the hook table. These are the files a host reads before
// any Superdev code runs, so a broken one fails at install time on someone
// else's machine rather than here.
//
// Absolute paths are the recurring defect: a manifest written on the author's
// machine points nowhere once installed, and it leaks a home directory.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ERROR, WARNING, finding, isKebab, readJson, rel } from "./common.mjs";

export const name = "manifests";

const ABSOLUTE_HOME = /(?:\/(?:Users|home)\/[A-Za-z0-9._-]+|[A-Z]:\\Users\\[A-Za-z0-9._-]+)/;
// A command may reference the plugin root, never a rooted filesystem path.
const ROOTED_COMMAND = /(?:^|\s)"?\/(?!\/)[A-Za-z0-9._-]+\//;

const CLAUDE_REQUIRED = ["name", "version", "description"];
const CODEX_INTERFACE_REQUIRED = [
  "displayName", "shortDescription", "longDescription", "developerName", "category",
];

function portability(path, text, findings) {
  if (ABSOLUTE_HOME.test(text)) {
    findings.push(finding("MF-010", ERROR, path,
      "contains an absolute home path, which points nowhere once the plugin is installed elsewhere"));
  }
  if (text.includes("../")) {
    findings.push(finding("MF-011", ERROR, path,
      "contains a path escape (../), which resolves outside the plugin root"));
  }
}

export async function run(root) {
  const findings = [];

  const claudeManifest = join(root, ".claude-plugin", "plugin.json");
  if (!existsSync(claudeManifest)) {
    findings.push(finding("MF-001", ERROR, ".claude-plugin/plugin.json",
      "the Claude plugin manifest is missing; there is nothing to validate"));
  } else {
    const path = rel(root, claudeManifest);
    const { value, error } = readJson(claudeManifest);
    if (error) {
      findings.push(finding("MF-002", ERROR, path, `manifest is not valid JSON: ${error}`));
    } else {
      for (const field of CLAUDE_REQUIRED) {
        if (typeof value[field] !== "string" || !value[field].trim()) {
          findings.push(finding("MF-003", ERROR, path, `required field "${field}" is missing or empty`));
        }
      }
      if (!isKebab(value.name)) {
        findings.push(finding("MF-004", ERROR, path,
          `name "${value.name ?? ""}" is not kebab-case; a host derives directory and command names from it`));
      }
      portability(path, JSON.stringify(value), findings);
    }
  }

  const marketplace = join(root, ".claude-plugin", "marketplace.json");
  if (existsSync(marketplace)) {
    const path = rel(root, marketplace);
    const { value, error } = readJson(marketplace);
    if (error) findings.push(finding("MF-002", ERROR, path, `marketplace manifest is not valid JSON: ${error}`));
    else portability(path, JSON.stringify(value), findings);
  }

  const codexManifest = join(root, ".codex-plugin", "plugin.json");
  if (!existsSync(codexManifest)) {
    findings.push(finding("MF-005", ERROR, ".codex-plugin/plugin.json",
      "the Codex plugin manifest is missing; Codex distribution is a supported surface"));
  } else {
    const path = rel(root, codexManifest);
    const { value, error } = readJson(codexManifest);
    if (error) {
      findings.push(finding("MF-002", ERROR, path, `manifest is not valid JSON: ${error}`));
    } else {
      if (!value.author || typeof value.author !== "object" || typeof value.author.name !== "string" || !value.author.name.trim()) {
        findings.push(finding("MF-006", ERROR, path, "author must be an object carrying a non-empty name"));
      }
      const iface = value.interface;
      if (!iface || typeof iface !== "object") {
        findings.push(finding("MF-007", ERROR, path, "interface object is missing"));
      } else {
        for (const field of CODEX_INTERFACE_REQUIRED) {
          if (typeof iface[field] !== "string" || !iface[field].trim()) {
            findings.push(finding("MF-007", ERROR, path, `interface.${field} must be a non-empty string`));
          }
        }
        if (!("defaultPrompt" in iface) && !("default_prompt" in iface)) {
          findings.push(finding("MF-007", ERROR, path, "interface.defaultPrompt is missing"));
        }
        if (!Array.isArray(iface.capabilities) || !iface.capabilities.every((c) => typeof c === "string" && c.trim())) {
          findings.push(finding("MF-007", ERROR, path, "interface.capabilities must be an array of non-empty strings"));
        }
      }
      portability(path, JSON.stringify(value), findings);
    }
  }

  const hooksFile = join(root, "hooks", "hooks.json");
  if (!existsSync(hooksFile)) {
    findings.push(finding("MF-008", ERROR, "hooks/hooks.json",
      "hooks.json is missing; the agent lifecycle hooks have no declaration"));
  } else {
    const path = rel(root, hooksFile);
    const { value, error } = readJson(hooksFile);
    if (error) {
      findings.push(finding("MF-002", ERROR, path, `hooks.json is not valid JSON: ${error}`));
    } else if (!value.hooks || typeof value.hooks !== "object") {
      findings.push(finding("MF-009", ERROR, path, "hooks.json must carry a hooks object"));
    } else {
      for (const [event, groups] of Object.entries(value.hooks)) {
        if (!Array.isArray(groups)) {
          findings.push(finding("MF-009", ERROR, path, `hooks.${event} must be an array`));
          continue;
        }
        for (const group of groups) {
          for (const hook of group?.hooks ?? []) {
            if (hook.type !== "command" || typeof hook.command !== "string" || !hook.command.trim()) {
              findings.push(finding("MF-009", ERROR, path, `hooks.${event} carries a hook without a command`));
              continue;
            }
            if (ROOTED_COMMAND.test(hook.command)) {
              findings.push(finding("MF-010", ERROR, path,
                `hooks.${event} runs an absolute path; use \${CLAUDE_PLUGIN_ROOT}`));
            }
            if (!hook.command.includes("${CLAUDE_PLUGIN_ROOT}")) {
              findings.push(finding("MF-012", WARNING, path,
                `hooks.${event} does not anchor its command to \${CLAUDE_PLUGIN_ROOT}, so it depends on the working directory`));
            }
          }
        }
      }
      portability(path, JSON.stringify(value).replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, ""), findings);
    }
  }

  // Every manifest that carries a version must carry the SAME version. Three
  // manifests sat at 0.1.1 while package.json said 0.2.0, and nothing noticed,
  // because this validator only checked that a version field was present. A
  // version that disagrees with itself across distribution surfaces means an
  // install instruction is wrong for at least one of them.
  const pkg = readJson(join(root, "package.json")).value;
  if (pkg?.version) {
    const declared = [
      [".claude-plugin/plugin.json", readJson(join(root, ".claude-plugin", "plugin.json")).value?.version],
      [".codex-plugin/plugin.json", readJson(join(root, ".codex-plugin", "plugin.json")).value?.version],
      [".claude-plugin/marketplace.json metadata",
        readJson(join(root, ".claude-plugin", "marketplace.json")).value?.metadata?.version],
      ...(readJson(join(root, ".claude-plugin", "marketplace.json")).value?.plugins ?? [])
        .map((plugin, i) => [`.claude-plugin/marketplace.json plugins[${i}]`, plugin?.version]),
      // The CLI the plugin says it needs. The two ship separately now, so this
      // is the one number that could sensibly lag, and it is also the one that
      // would silently warn every user that their tools are mismatched if it
      // were left behind a release. One version for both halves means this
      // field moves with the rest.
      [".claude-plugin/plugin.json requires.cli",
        readJson(join(root, ".claude-plugin", "plugin.json")).value?.requires?.cli],
      [".codex-plugin/plugin.json requires.cli",
        readJson(join(root, ".codex-plugin", "plugin.json")).value?.requires?.cli],
    ];
    for (const [where, version] of declared) {
      if (version === undefined || version === null) continue;
      if (version !== pkg.version) {
        findings.push(finding("MF-013", ERROR, where,
          `declares version "${version}" while package.json declares "${pkg.version}"`));
      }
    }
  }

  return { name, findings };
}
