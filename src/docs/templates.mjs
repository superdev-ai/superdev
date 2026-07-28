// One pure renderer per generated artifact, mapped field by field onto the Docs
// skill templates in skills/docs/assets/templates.
//
// Nothing here touches the database, the clock or the filesystem. Every renderer
// takes a plain data object assembled by render.mjs and returns a Markdown body,
// so the same data always produces the same bytes. Ordering decisions belong to
// the caller: whatever order the arrays arrive in is the order that appears.
//
// Two characters are deliberately absent: U+2014 and the tick mark U+2713 the
// permission matrices use. Both are refused by the storage screener, and a
// generated body is stored, so a template that emitted them could never be
// written down.

import { titleCase } from "../model/vocabulary.mjs";

// ------------------------------------------------------------------ primitives

const NOT_RECORDED = "Not recorded";

const text = (value, fallback = NOT_RECORDED) => {
  const s = String(value ?? "").trim();
  return s || fallback;
};

/** Table cells and inline slots: one line, pipes escaped. */
const inline = (value, fallback = "-") =>
  text(value, fallback).replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "\\|");

const label = (name, value, fallback) => `- **${name}:** ${inline(value, fallback ?? NOT_RECORDED)}`;

const commas = (items, fallback = "none") =>
  items?.length ? items.map((i) => inline(i)).join(", ") : fallback;

const bullets = (items, fallback = "- None recorded.") =>
  items?.length ? items.map((i) => `- ${text(i, "-")}`).join("\n") : fallback;

const numbered = (items, fallback = "None recorded.") =>
  items?.length ? items.map((i, n) => `${n + 1}. ${text(i, "-")}`).join("\n") : fallback;

const table = (headers, rows, fallback = "None recorded.") => {
  if (!rows?.length) return fallback;
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.map((c) => inline(c)).join(" | ")} |`),
  ].join("\n");
};

const fence = (lang, body) => "```" + lang + "\n" + body + "\n" + "```";

const section = (title, body) => `## ${title}\n\n${body}`;

const doc = (...parts) => parts.filter((p) => p !== null && p !== undefined && p !== "").join("\n\n");

const link = (ref) => (ref?.link ? `[${inline(ref.label)}](${ref.link})` : inline(ref?.label));

const links = (refs, fallback = "none") =>
  refs?.length ? refs.map((r) => link(r)).join(", ") : fallback;

const stat = (value) => titleCase(text(value, "unknown"));

/** The provenance line every template wants. The marker above the body carries
 *  the revision and hash, so repeating them here would change the hash on every
 *  unrelated write and churn the file for no reader. */
const VERIFIED = "- **Last verified:** see the generation marker at the top of this file.";

const REGENERATED = "<!-- REGENERATED - do not hand-edit. Rebuild it with `superdev docs generate`. -->";

/** Mermaid node identifier. Stable for a given name, never empty. */
const nodeId = (name, index = 0) => {
  const base = String(name ?? "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base ? `n_${base}`.slice(0, 48) : `n_${index}`;
};

const mermaidLabel = (value, fallback = "unnamed") =>
  text(value, fallback).replace(/\s*\r?\n\s*/g, " ").replace(/["`]/g, "'").slice(0, 80);

const applicability = (row) =>
  row.state === "not_applicable" || row.applicability === "not_applicable"
    ? `N/A - ${text(row.reason ?? row.reason_not_applicable, "no reason recorded")}`
    : text(row.summary ?? row.behavior ?? row.choice, NOT_RECORDED);

// ---------------------------------------------------------------- foundations

export function foundationsProduct(data) {
  const p = data.project;
  return doc(
    `# ${text(p.name, "Project")} - Foundations: Product`,
    [label("Status", stat(p.status)), label("Working mode", stat(p.working_mode)), VERIFIED].join("\n"),
    section("Product", text(p.statement, "No product statement recorded.")),
    section("Problem", text(p.problem, "No problem statement recorded.")),
    section(
      "Non-goals",
      bullets(
        data.nonGoals.map((n) => (n.why ? `${n.statement} (${n.why})` : n.statement)),
        "- None declared. An empty list here is a gap, not a statement.",
      ),
    ),
    section(
      "Goals",
      table(
        ["Goal", "Why it matters", "Priority", "Status"],
        data.goals.map((g) => [`${g.id} ${g.name}`, g.why_it_matters, g.priority, stat(g.status)]),
        "No goals recorded.",
      ),
    ),
    section(
      "Success criteria",
      table(
        ["Goal", "Criterion", "Target", "Measured how", "Status"],
        data.successCriteria.map((c) => [c.goal, c.criterion, c.target, c.measurement_method, stat(c.status)]),
        "No success criteria recorded.",
      ),
    ),
    section(
      "Milestones",
      table(
        ["Milestone", "Outcome", "Entry conditions", "Exit conditions", "Target", "Status"],
        data.milestones.map((m) => [
          `${m.id} ${m.name}`, m.outcome, commas(m.entry, "none"), commas(m.exit, "none"),
          m.target_date, stat(m.status),
        ]),
        "No milestones recorded.",
      ),
    ),
  );
}

export function foundationsUsersAndRoles(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Foundations: Users and Roles`,
    [label("Status", stat(data.project.status)), VERIFIED].join("\n"),
    section(
      "Users and roles",
      table(
        ["Role", "Who", "Primary goals"],
        data.roles.map((r) => [r.name, r.who ?? r.description, r.primary_goals]),
        "No roles recorded.",
      ),
    ),
    section(
      "Users identified in discovery",
      bullets(
        data.users.map((u) => `${u.statement} (${titleCase(u.epistemic_status)})`),
        "- None recorded.",
      ),
    ),
    section("Permission matrices", `The three role matrices live in ${link(data.permissionsDoc)}.`),
  );
}

export function foundationsRolesAndPermissions(data) {
  const roleNames = data.roles.map((r) => r.name);
  return doc(
    `# ${text(data.project.name, "Project")} - Roles and Permissions`,
    [
      label("Status", stat(data.project.status)),
      label("Permission source of truth (code)", commas(data.enforcementPoints, "not declared")),
      VERIFIED,
    ].join("\n"),
    section(
      "1. Role by module visibility",
      table(
        ["Module", ...roleNames],
        data.visibility.map((row) => [row.module, ...roleNames.map((r) => row.access[r] ?? "-")]),
        "No module-scoped permissions recorded.",
      ),
    ),
    section(
      "2. Role by action capability",
      doc(
        table(
          ["Role", "Scope", "Capability", "Access", "Enforced at"],
          data.capabilities.map((c) => [c.role, c.scope, c.capability, c.access_level, c.enforcement_point]),
          "No action-level permissions recorded.",
        ),
        data.moduleDocs.length
          ? `Per-module action matrices: ${links(data.moduleDocs)}.`
          : "No module surface documents to link.",
      ),
    ),
    section(
      "3. Role by field sensitivity",
      table(
        ["Entity.field", "Class", ...roleNames],
        data.sensitiveFields.map((f) => [f.field, f.sensitivity_class, ...roleNames.map((r) => f.access[r] ?? "-")]),
        "No fields carry a sensitivity class above none.",
      ),
    ),
    section(
      "Enforcement",
      doc(
        "Legend: `full` full access, `own` only own records, `read` read only, `redacted` masked, `-` blocked.",
        bullets(data.enforcementPoints, "- No enforcement points recorded. A matrix nobody enforces is drift."),
      ),
    ),
  );
}

export function foundationsScope(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Foundations: Scope`,
    [label("Status", stat(data.project.status)), VERIFIED].join("\n"),
    section(
      "In (current horizon)",
      numbered(
        data.inScope.map((s) => (s.horizon ? `${s.statement} (horizon: ${s.horizon})` : s.statement)),
        "Nothing declared in scope.",
      ),
    ),
    section(
      "Out (deliberate)",
      numbered(
        data.outScope.map((s) => `${s.statement} - ${text(s.why, "no reason recorded")}`),
        "Nothing declared out of scope.",
      ),
    ),
    section(
      "Non-goals",
      numbered(
        data.nonGoals.map((s) => `${s.statement} - ${text(s.why, "no reason recorded")}`),
        "No non-goals declared.",
      ),
    ),
    section(
      "Feature scope by module",
      table(
        ["Feature", "Module", "In", "Out"],
        data.featureScope.map((f) => [link(f.doc), f.module, commas(f.in, "none"), commas(f.out, "none")]),
        "No feature scope recorded.",
      ),
    ),
  );
}

export function foundationsArchitecture(data) {
  const system = nodeId(data.project.name || "system");
  const context = [
    "graph LR",
    ...data.actors.map((a, i) => `  ${nodeId(a, i)}["${mermaidLabel(a)}"] --> ${system}`),
    `  ${system}["${mermaidLabel(data.project.name, "System")}"]`,
    ...data.externals.map((e, i) => `  ${system} --> ${nodeId(`ext_${e}`, i)}["${mermaidLabel(e)}"]`),
  ].join("\n");

  const moduleMap = [
    "graph TD",
    ...data.modules.map((m, i) => `  ${nodeId(m.slug, i)}["${mermaidLabel(m.name)}"]`),
    ...data.moduleEdges.map((e) => `  ${nodeId(e.from)} --> ${nodeId(e.to)}`),
  ].join("\n");

  const critical = data.criticalPath.length
    ? ["sequenceDiagram", ...data.criticalPath.map((s) =>
        `  ${nodeId(s.from, 0)}->>${nodeId(s.to, 1)}: ${mermaidLabel(s.action)}`)].join("\n")
    : "sequenceDiagram\n  note over system: No workflow recorded yet.";

  return doc(
    `# ${text(data.project.name, "Project")} - Architecture`,
    [label("Status", stat(data.project.status)), VERIFIED].join("\n"),
    section("Shape", text(data.shape, "No system shape recorded.")),
    section("System context", `${fence("mermaid", context)}\n\n*Claim: ${text(data.contextClaim)}*`),
    section(
      "Runtime pieces",
      table(
        ["Piece", "Runs where", "Talks to", "Evidence"],
        data.pieces.map((p) => [p.name, p.runs_where, commas(p.talksTo, "nothing recorded"), p.evidence_ref]),
        "No runtime pieces recorded. The module map below is a logical decomposition, not a topology.",
      ),
    ),
    section("Module map", `${fence("mermaid", moduleMap)}\n\n*Claim: ${text(data.moduleClaim)}*`),
    section(
      "Data ownership",
      table(
        ["Entity group", "Owning module", "Consumers"],
        data.ownership.map((o) => [commas(o.entities, "none"), o.module, commas(o.consumers, "none")]),
        "No entities recorded.",
      ),
    ),
    section("Critical path", `${fence("mermaid", critical)}\n\n*Claim: ${text(data.criticalClaim)}*`),
    section(
      "Boundaries and constraints",
      bullets(
        data.boundaries.map((b) => `${b.area}: ${applicability(b)}${b.evidence_ref ? ` (${b.evidence_ref})` : ""}`),
        "- No boundaries recorded.",
      ),
    ),
  );
}

export function foundationsStack(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Foundations: Stack`,
    [label("Status", stat(data.project.status)), VERIFIED].join("\n"),
    "Capability slots are filled by evidence or an accepted decision only. An empty slot is a question, never an assumption.",
    section(
      "Capability slots",
      table(
        ["Capability", "Choice", "State", "Evidence / decision"],
        data.slots.map((s) => [
          s.area,
          s.state === "specified" ? s.choice : applicability(s),
          stat(s.state),
          s.decision_id ? `${s.decision_id} ${text(s.evidence_ref, "")}`.trim() : s.evidence_ref,
        ]),
        "No stack slots recorded.",
      ),
    ),
    section("Design direction", text(data.designDirection, "No design system recorded, and none deliberately declined.")),
  );
}

export function foundationsGlossary(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Foundations: Glossary`,
    VERIFIED,
    "One meaning per term. A term with two meanings is a defect, not a nuance.",
    section(
      "Terms",
      table(
        ["Term", "Meaning", "Source"],
        data.terms.map((t) => [t.term, t.meaning, t.source_ref]),
        "No terms recorded.",
      ),
    ),
  );
}

export function foundationsNfrs(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Non-Functional Requirements`,
    [label("Status", stat(data.project.status)), VERIFIED].join("\n"),
    section(
      "Requirements",
      table(
        ["#", "Requirement", "Target", "Source", "Measured how", "Status", "Scope"],
        data.nfrs.map((n) => [
          n.id, n.requirement, n.target, n.target_source, n.measurement_method, stat(n.status), n.scope,
        ]),
        "No non-functional requirements recorded.",
      ),
    ),
    section(
      "Rules",
      [
        "- A target without a source is a question for the owner, not a requirement. It is listed under Open below.",
        "- A requirement without a measurement method is a draft.",
        "- `unmeasured` is an honest status. Fabricated compliance is drift.",
      ].join("\n"),
    ),
    section(
      "Open (awaiting owner targets)",
      table(
        ["Area", "Why it matters here", "Proposed measurement"],
        data.open.map((o) => [o.category, o.requirement, o.measurement_method]),
        "Every recorded requirement carries a source.",
      ),
    ),
  );
}

export function foundationsCompliance(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Compliance`,
    [
      label("Status", stat(data.project.status)),
      label("Declared regimes", links(data.regimes, "none declared")),
      VERIFIED,
    ].join("\n"),
    "Regimes are only ever declared by a recorded decision. None is inferred from geography or vertical.",
    section(
      "Regulated data inventory",
      table(
        ["Entity.field", "Class", "Modules touching it"],
        data.inventory.map((i) => [i.field, i.sensitivity_class, commas(i.modules, "none")]),
        "No field carries a sensitivity class above none.",
      ),
    ),
    section(
      "Handling rules",
      table(
        ["Concern", "Rule", "Enforced at"],
        data.rules.map((r) => [r.concern, r.rule, r.enforced_at]),
        "No handling rules recorded.",
      ),
    ),
    section(
      "Gaps (open items)",
      table(
        ["Gap", "Risk", "Owner decision needed"],
        data.gaps.map((g) => [g.gap, g.risk, g.question]),
        "No open compliance gaps recorded.",
      ),
    ),
  );
}

// -------------------------------------------------------------------- modules

export function moduleInventory(data) {
  return doc(
    `# ${text(data.project.name, "Project")} - Module Inventory`,
    [
      "- **Status:** living registry, regenerated from the database.",
      VERIFIED,
    ].join("\n"),
    section(
      "Modules",
      table(
        ["Module", "Purpose", "Primary users", "Owns", "Status", "Doc root"],
        data.modules.map((m) => [
          m.name, m.purpose, commas(m.primary_users, "none"), commas(m.owns, "none"),
          stat(m.status), link(m.doc),
        ]),
        "No modules recorded.",
      ),
    ),
    section(
      "Status rules",
      [
        "- `implemented` requires implementation parity to have been verified at least once.",
        "- A deprecated module keeps its row and its doc root. History is never deleted.",
      ].join("\n"),
    ),
    section("Deliberate exclusions", bullets(data.exclusions, "- None recorded.")),
  );
}

export function moduleSpec(data) {
  const m = data.module;
  return doc(
    `# Module: ${text(m.name, "Unnamed module")}`,
    [
      label("Status", stat(m.status)),
      label("Purpose", m.purpose),
      label("Primary users", commas(data.primaryUsers, "none recorded")),
      label("Owns", commas(data.owns, "none recorded")),
      label("Does not own (consumes)", commas(data.consumes, "nothing recorded")),
      VERIFIED,
    ].join("\n"),
    section(
      "Surfaces",
      table(
        ["Route", "Surface", "Purpose", "Primary role", "Doc"],
        data.surfaces.map((s) => [s.route, s.name, s.purpose, s.primary_role, link(s.doc)]),
        "No surfaces recorded.",
      ),
    ),
    section(
      "API surface",
      table(
        ["Operation", "Purpose", "Doc"],
        data.apis.map((a) => [`${text(a.method_or_procedure, "")} ${text(a.path_or_topic, a.name)}`.trim(), a.purpose, link(a.doc)]),
        "No API operations recorded.",
      ),
    ),
    section(
      "Data",
      table(
        ["Entity", "Role in module", "Doc"],
        data.entities.map((e) => [e.name, e.role, link(e.doc)]),
        "No entities recorded.",
      ),
    ),
    section(
      "Wiring (key actions end to end)",
      table(
        ["Action", "Path"],
        data.wiring.map((w) => [w.action, w.path]),
        "No actions recorded, so no end-to-end path can be asserted.",
      ),
    ),
    section(
      "State machines",
      table(
        ["Entity", "Initial state", "States", "Doc"],
        data.stateMachines.map((s) => [s.entity_name, s.initial_state, s.stateCount, link(s.doc)]),
        "None recorded.",
      ),
    ),
    section(
      "Events",
      table(
        ["Event", "Direction", "Payload owner", "Consumers"],
        data.events.map((e) => [e.event, e.direction, e.owner, commas(e.consumers, "none")]),
        "No events recorded.",
      ),
    ),
    section(
      "Edge cases",
      table(
        ["Category", "Outcome", "Features"],
        data.edgeCases.map((e) => [titleCase(e.category), e.outcome, commas(e.features, "none")]),
        "No edge-case walk recorded.",
      ),
    ),
    section(
      "Twenty-step completeness",
      table(
        ["#", "Step", "State", "Outcome"],
        data.steps.map((s) => [s.step, s.step_name, stat(s.state), applicability(s)]),
        "The twenty-step loop has not been started for this module.",
      ),
    ),
  );
}

// -------------------------------------------------------------------- feature

export function featureSpec(data) {
  const f = data.feature;
  const depth = text(f.spec_depth, "standard");
  const parts = [
    `# Feature: ${text(f.name, "Unnamed feature")}`,
    [
      label("Status", stat(f.status)),
      label("Depth", stat(depth)),
      label("Module", link(data.moduleDoc)),
      label("Risk level", f.risk_level),
      label("Milestone", data.milestone ?? "none"),
      label("Goals", links(data.goals, "none linked")),
      VERIFIED,
    ].join("\n"),
    section(
      "Microspec",
      [
        label("Purpose", f.purpose),
        label("User", f.user_statement),
        label("User value", f.user_value),
        `- **Scope:** in: ${commas(data.scopeIn, "not recorded")}; out: ${commas(data.scopeOut, "not recorded")}`,
        label("Affected contracts", links(data.contracts, "none linked")),
      ].join("\n") +
        "\n\n" +
        doc(
          `### Primary flow\n\n${numbered(data.flow, "No flow recorded.")}`,
          `### Acceptance criteria\n\n${table(
            ["Criterion", "Verified how", "Status", "Evidence"],
            data.acceptance.map((a) => [a.criterion, a.verification_method, stat(a.status), a.evidence_id]),
            "No acceptance criteria recorded.",
          )}`,
          `### Error and edge behavior\n\n${table(
            ["Category", "Applicability", "Behavior or reason"],
            data.edgeCases.map((e) => [titleCase(e.category), stat(e.applicability), applicability(e)]),
            "No edge-case walk recorded.",
          )}`,
          `### Test evidence\n\n${table(
            ["Evidence", "Type", "Result", "Reference"],
            data.evidence.map((e) => [e.summary, e.evidence_type, e.result, e.reference]),
            "No verification evidence recorded.",
          )}`,
        ),
    ),
  ];

  if (depth === "standard" || depth === "full") {
    parts.push(
      section(
        "Standard",
        doc(
          `### Surfaces and actions\n\n${table(
            ["Surface", "Route", "Actions", "Doc"],
            data.surfaces.map((s) => [s.name, s.route, s.actionCount, link(s.doc)]),
            "No surfaces recorded.",
          )}`,
          `### API and data impact\n\n${table(
            ["Kind", "Name", "Purpose", "Doc"],
            data.apiAndData.map((a) => [a.kind, a.name, a.purpose, link(a.doc)]),
            "No API operations or entities recorded.",
          )}`,
          `### Roles and permissions delta\n\n${table(
            ["Role", "Capability", "Access", "Enforced at"],
            data.permissions.map((p) => [p.role, p.capability, p.access_level, p.enforcement_point]),
            "No permission changes recorded.",
          )}`,
          `### Workflow and states\n\n${table(
            ["Workflow or machine", "Trigger or entity", "Doc"],
            data.workflows.map((w) => [w.name, w.trigger, link(w.doc)]),
            "No workflows or state machines recorded.",
          )}`,
          `### Non-happy paths\n\n${table(
            ["Workflow", "Step", "Condition", "Behavior"],
            data.failurePaths.map((p) => [p.workflow, p.step, p.condition, p.behavior]),
            "No failure branches recorded.",
          )}`,
          `### Observability\n\n${bullets(data.observability, "- No signals recorded that would prove this works.")}`,
          `### Rollout\n\n${text(data.rollout, "No rollout approach recorded.")}`,
          `### Test plan\n\n${link(data.testPlanDoc)}`,
        ),
      ),
    );
  }

  if (depth === "full") {
    parts.push(
      section(
        "Full",
        doc(
          `### Alternatives and decisions\n\n${table(
            ["Decision", "Status", "Choice"],
            data.decisions.map((d) => [link(d.doc), stat(d.status), d.decision]),
            "No decision records linked.",
          )}`,
          `### Architecture\n\n${text(data.architectureNote, "No architecture note recorded.")}`,
          `### Migrations\n\n${table(
            ["Migration", "Forward", "Rollback", "Status"],
            data.migrations.map((m) => [m.name, m.forward_plan, m.rollback_plan, stat(m.status)]),
            "No schema migrations recorded.",
          )}`,
          `### Security, privacy and compliance\n\n${table(
            ["Entity.field", "Class", "Retention"],
            data.sensitive.map((s) => [s.field, s.sensitivity_class, s.retention_rule]),
            "No sensitive data recorded for this feature.",
          )}`,
          `### Performance and capacity\n\n${table(
            ["Requirement", "Target", "Source", "Status"],
            data.nfrs.map((n) => [n.requirement, n.target, n.target_source, stat(n.status)]),
            "No non-functional requirements scoped to this feature.",
          )}`,
          `### Failure recovery and rollback\n\n${bullets(data.recovery, "- No recovery behavior recorded.")}`,
          `### Compatibility\n\n${bullets(data.compatibility, "- No public contract impact recorded.")}`,
        ),
      ),
    );
  }

  parts.push(
    section(
      "Delivery state",
      [
        label("What works now", f.what_works_now),
        label("What remains", f.what_remains),
        label("Next action", f.next_action),
      ].join("\n"),
    ),
  );

  return doc(...parts);
}

// --------------------------------------------------- workflow and state machine

export function workflowSpec(data) {
  const w = data.workflow;
  const heading = w ? text(w.name, "Unnamed workflow") : text(data.machines[0]?.machine.entity_name, "State machine");

  const head = [
    label("Status", stat(w?.status ?? data.machines[0]?.machine.status)),
    label("Module", link(data.moduleDoc)),
    label("Feature", data.featureDoc ? link(data.featureDoc) : "none"),
    VERIFIED,
  ].join("\n");

  const parts = [`# ${heading}`, head];

  if (w) {
    const actors = data.actors.map((a) => a.actor);
    const sequence = data.steps.length
      ? [
          "sequenceDiagram",
          ...actors.map((a, i) => `  participant ${nodeId(a, i)} as ${mermaidLabel(a)}`),
          ...data.steps.map((s, i) => {
            const from = nodeId(s.owner_ref || s.owner_type, i);
            const to = nodeId(data.steps[i + 1]?.owner_ref || data.steps[i + 1]?.owner_type || s.owner_ref || s.owner_type, i + 1);
            return `  ${from}->>${to}: ${mermaidLabel(s.action)}`;
          }),
        ].join("\n")
      : null;

    parts.push(
      section(
        "Workflow",
        doc(
          [
            label("Purpose", w.purpose),
            label("Actors", commas(actors, "none recorded")),
            label("Trigger", w.trigger),
            label("Preconditions", commas(data.preconditions, "none recorded")),
          ].join("\n"),
          table(
            ["Step", "Owner", "Action", "Input", "Expected result", "On failure"],
            data.steps.map((s) => [
              s.sequence, `${text(s.owner_ref, s.owner_type)}`, s.action, s.input_contract,
              s.expected_result, s.failure_behavior,
            ]),
            "No steps recorded.",
          ),
          [label("Completion", w.completion_criteria), label("Observability", w.observability)].join("\n"),
          table(
            ["From step", "Condition", "Goes to", "Type", "Failure policy"],
            data.branches.map((b) => [b.from, b.condition, b.to, b.branch_type, b.failure_policy]),
            "No branches recorded. A workflow with no alternate path is either trivial or unfinished.",
          ),
          sequence ? fence("mermaid", sequence) : "No steps recorded, so no sequence diagram is drawn.",
        ),
      ),
    );
  }

  for (const m of data.machines) {
    const diagram = [
      "stateDiagram-v2",
      ...m.states.map((s) => `  state "${mermaidLabel(s.name)}" as ${nodeId(s.name, s.sequence)}`),
      m.initialState ? `  [*] --> ${nodeId(m.initialState)}` : null,
      ...m.transitions.map((t) => `  ${nodeId(t.from)} --> ${nodeId(t.to)}: ${mermaidLabel(t.event)}`),
      ...m.states.filter((s) => s.terminal).map((s) => `  ${nodeId(s.name, s.sequence)} --> [*]`),
    ].filter(Boolean).join("\n");

    parts.push(
      section(
        `State machine: ${text(m.machine.entity_name, "entity")}`,
        doc(
          table(
            ["State", "Meaning", "Permits", "Terminal"],
            m.states.map((s) => [s.name, s.meaning, commas(s.permitted, "nothing recorded"), s.terminal ? "yes" : "no"]),
            "No states recorded.",
          ),
          table(
            ["From", "Event", "Guard", "To", "Actor", "Enforced at"],
            m.transitions.map((t) => [t.from, t.event, t.guard, t.to, t.actor, t.enforcement_point]),
            "No transitions recorded.",
          ),
          [
            `- **Illegal transitions:** rejected at ${commas(m.enforcementPoints, "no enforcement point recorded, which is drift")}.`,
            `- **Terminal states:** ${commas(m.terminalStates, "none recorded")}`,
            `- **Timeouts and expiry:** ${commas(m.timeouts, "none recorded")}`,
          ].join("\n"),
          m.states.length ? fence("mermaid", diagram) : "No states recorded, so no diagram is drawn.",
        ),
      ),
    );
  }

  if (!w && !data.machines.length) parts.push("No workflow or state machine content recorded.");
  return doc(...parts);
}

// -------------------------------------------------------- surfaces and actions

const ACTION_FIELDS = [
  ["Trigger", "trigger"],
  ["Who", "who"],
  ["Precondition", "precondition"],
  ["Effect", "effect"],
  ["Input and validation", "input"],
  ["Side effects", "side_effects"],
  ["Confirmation", "confirmation"],
  ["Loading", "loading_behavior"],
  ["Disabled", "disabled_behavior"],
  ["Success", "success_behavior"],
  ["Empty", "empty"],
  ["Error", "error_behavior"],
  ["Offline", "offline"],
  ["Keyboard", "keyboard"],
  ["Accessible name", "accessible_name"],
  ["Focus behavior", "focus_behavior"],
  ["Responsive", "responsive"],
  ["Telemetry", "telemetry"],
  ["Acceptance test", "acceptance"],
];

export function surfaceSpec(data) {
  const s = data.surface;
  const roleNames = data.roles.map((r) => r.name);

  const inventories = data.actions.map((a) =>
    doc(
      `### Action: ${text(a.label ?? a.name, "unnamed action")}`,
      table(["Field", "Value"], ACTION_FIELDS.map(([name, key]) => [name, a[key]]), "Nothing recorded."),
    ),
  );

  return doc(
    `# Surface: ${text(s.name, "Unnamed surface")}`,
    [
      label("Status", stat(s.status)),
      label("Module", link(data.moduleDoc)),
      label("Feature", data.featureDoc ? link(data.featureDoc) : "none"),
      VERIFIED,
    ].join("\n"),
    section(
      "Page or surface",
      table(
        ["Route", "Surface", "Type", "Purpose", "Primary role", "Key components", "Entities shown"],
        [[s.route, s.name, s.surface_type, s.purpose, s.primary_role, commas(data.components, "none"), commas(data.entities, "none")]],
      ),
    ),
    section("Action inventory", inventories.length ? inventories.join("\n\n") : "No actions recorded."),
    section(
      "Role by action matrix",
      doc(
        table(
          ["Action", ...roleNames],
          data.matrix.map((row) => [row.action, ...roleNames.map((r) => row.access[r] ?? "-")]),
          "No actions or no roles recorded.",
        ),
        "Legend: `full` full access, `own` only own records, `read` read only, `-` blocked. The matrix must agree with the enforcement points above.",
      ),
    ),
    section(
      "State completeness",
      doc(
        table(
          ["State", "Behavior", "Copy"],
          data.states.map((st) => [titleCase(st.state_type), st.behavior, st.copy]),
          "No surface states recorded.",
        ),
        data.missingStates.length
          ? `Undocumented states: ${commas(data.missingStates)}. Each is a gap until it is described or deliberately declined.`
          : "Loading, empty, error and success are all documented.",
        [
          label("Responsive behavior", s.responsive_behavior),
          label("Accessibility notes", s.accessibility_notes),
        ].join("\n"),
      ),
    ),
  );
}

// ------------------------------------------------------------------------ api

export function apiSpec(data) {
  const a = data.api;
  return doc(
    `# API: ${text(a.name, "Unnamed operation")}`,
    [
      label("Status", stat(a.status)),
      label("Module", link(data.moduleDoc)),
      label("Feature", data.featureDoc ? link(data.featureDoc) : "none"),
      label("Style", a.style),
      label("Address", `${text(a.method_or_procedure, "")} ${text(a.path_or_topic, "not recorded")}`.trim()),
      label("Implemented at", a.implementation_path),
      VERIFIED,
    ].join("\n"),
    section(
      "Contract",
      [
        label("Purpose", a.purpose),
        label("Callers", links(data.callers, "none recorded")),
        `- **Auth:** ${inline(a.auth_requirement, NOT_RECORDED)}, permission ${inline(a.permission, "not recorded")}, enforced at ${inline(a.enforcement_point, "no enforcement point recorded")}`,
        label("Idempotency", a.idempotency, "no idempotency declared"),
        label("Limits", a.limits, "none declared"),
        label("Side effects", commas(data.sideEffects, "none recorded")),
        label("Versioning", a.versioning),
      ].join("\n"),
    ),
    section(
      "Request",
      table(["Field", "Type", "Required", "Rules"],
        data.request.map((f) => [f.name, f.type, f.required, f.rules]),
        "No request contract recorded."),
    ),
    section(
      "Response",
      table(["Field", "Type", "Notes"],
        data.response.map((f) => [f.name, f.type, f.notes]),
        "No response contract recorded."),
    ),
    section(
      "Errors",
      table(["Code", "Meaning", "User-facing behavior"],
        data.errors.map((e) => [e.code, e.meaning, e.behavior]),
        "No error contract recorded. An operation with no declared failure mode is unfinished."),
    ),
    section(
      "Tests",
      table(["Evidence", "Type", "Result", "Reference"],
        data.tests.map((t) => [t.summary, t.evidence_type, t.result, t.reference]),
        "No test evidence recorded."),
    ),
  );
}

// ---------------------------------------------------------------- data entity

const CARDINALITY = { "1:1": "||--||", "1:n": "||--o{", "n:1": "}o--||", "n:m": "}o--o{" };

export function dataEntitySpec(data) {
  const e = data.entity;
  const erName = (n) => String(n ?? "ENTITY").replace(/[^A-Za-z0-9_]+/g, "_").toUpperCase().slice(0, 40) || "ENTITY";
  const diagram = [
    "erDiagram",
    ...data.relationships.map((r) =>
      `  ${erName(r.fromName)} ${CARDINALITY[r.cardinality] ?? "||--o{"} ${erName(r.toName)} : ${erName(r.name)}`),
    data.relationships.length ? null : `  ${erName(e.name)} {`,
    data.relationships.length ? null : `    string id`,
    data.relationships.length ? null : `  }`,
  ].filter(Boolean).join("\n");

  return doc(
    `# Entity: ${text(e.name, "Unnamed entity")}`,
    [
      label("Status", stat(e.status)),
      label("Owning module", link(data.moduleDoc)),
      label("Store", e.store),
      label("Schema source", e.schema_source),
      label("Sensitivity", e.sensitivity_class),
      VERIFIED,
    ].join("\n"),
    section("Purpose", text(e.purpose, "No purpose recorded.")),
    section(
      "Fields",
      table(
        ["Field", "Type", "Null", "Default", "Constraints", "Sensitivity"],
        data.fields.map((f) => [
          f.name, f.type, f.nullable ? "y" : "n", f.default_value, commas(f.constraints, "none"), f.sensitivity_class,
        ]),
        "No fields recorded.",
      ),
    ),
    section(
      "Relationships",
      doc(
        table(
          ["Relation", "Direction", "Target", "Cardinality", "On delete", "Ownership"],
          data.relationships.map((r) => [r.name, r.direction, r.target, r.cardinality, r.on_delete, r.ownership_note]),
          "No relationships recorded.",
        ),
        fence("mermaid", diagram),
      ),
    ),
    section(
      "Lifecycle",
      [
        label("Created by", links(data.createdBy, "no operation recorded")),
        label("Read or updated by", links(data.updatedBy, "no operation recorded")),
        label("Deleted", e.deletion_semantics),
        label("Retention", e.retention_rule, "none declared"),
      ].join("\n"),
    ),
    section("Indexes and uniqueness", bullets(data.constraints, "- None recorded. The schema source outranks this prose.")),
    section(
      "Migration notes",
      table(
        ["Migration", "Forward", "Rollback", "Compatibility", "Status"],
        data.migrations.map((m) => [m.name, m.forward_plan, m.rollback_plan, m.compatibility_notes, stat(m.status)]),
        "No migrations affect this entity.",
      ),
    ),
  );
}

// ---------------------------------------------------------------- integration

export function integrationSpec(data) {
  const i = data.integration;
  return doc(
    `# Integration: ${text(i.name, "Unnamed integration")}`,
    [
      label("Status", stat(i.status)),
      label("Module", link(data.moduleDoc)),
      label("Feature", data.featureDoc ? link(data.featureDoc) : "none"),
      label("Provider", i.provider),
      label("Configuration", stat(i.configuration_status)),
      label("Verification", stat(i.verification_status)),
      VERIFIED,
    ].join("\n"),
    section("Purpose", text(i.purpose, "No purpose recorded.")),
    section(
      "Configuration",
      [
        label("Environments", commas(data.environments, "none recorded")),
        label("Auth approach", i.auth_approach),
        label("Contract references", commas(data.contractRefs, "none recorded")),
      ].join("\n") +
        "\n\nEnvironment names only. A credential value never appears in a generated file.",
    ),
    section("Failure behavior", text(i.failure_behavior, "No failure behavior recorded. An integration with no declared failure mode is unfinished.")),
    section(
      "Verification",
      table(
        ["Evidence", "Type", "Result", "Reference"],
        data.evidence.map((e) => [e.summary, e.evidence_type, e.result, e.reference]),
        `Status is ${stat(i.verification_status)} with no evidence recorded.`,
      ),
    ),
  );
}

// ----------------------------------------------------------- jobs and webhooks

export function asyncSpec(data) {
  const j = data.job;
  const w = data.webhook;
  const head = [
    label("Status", stat((j ?? w).status)),
    label("Module", link(data.moduleDoc)),
    label("Feature", data.featureDoc ? link(data.featureDoc) : "none"),
    label("Mechanism", data.mechanism, "none declared"),
    VERIFIED,
  ].join("\n");

  if (j) {
    return doc(
      `# Job: ${text(j.name, "Unnamed job")}`,
      head,
      section(
        "Async job",
        [
          label("Trigger", j.trigger),
          label("Input", commas(data.input, "no contract recorded")),
          label("Idempotency", j.idempotency, "not declared, so re-running is unsafe until it is"),
          label("Retry", j.retry_policy),
          label("Failure destination", j.failure_destination),
          label("Timeout", j.timeout),
          label("Concurrency", j.concurrency),
          label("Observability", j.observability, "no way to notice a stuck run is recorded"),
          label("Delivery guarantee", j.delivery_guarantee, "undeclared"),
        ].join("\n"),
      ),
    );
  }

  const incoming = w.direction === "incoming";
  return doc(
    `# Webhook: ${text(w.name, "Unnamed webhook")}`,
    head,
    section(
      incoming ? "Incoming webhook" : "Outgoing webhook",
      incoming
        ? [
            label("Endpoint", w.endpoint_or_registration),
            label("Sender verification", w.identity_verification),
            label("Replay protection", w.replay_protection),
            label("Ordering", w.ordering_behavior),
            label("Failure semantics", w.retry_behavior),
            label("Payload versioning", w.payload_version),
          ].join("\n")
        : [
            label("Registration", w.endpoint_or_registration),
            label("Delivery", w.retry_behavior),
            label("Signing", w.signing),
            label("Failure visibility", w.failure_visibility),
            label("Payload versioning", w.payload_version),
          ].join("\n"),
    ),
  );
}

// -------------------------------------------------------------- observability

export function observabilitySpec(data) {
  return doc(
    `# ${text(data.scopeName, "Project")} - Observability`,
    [
      label("Tooling in use", commas(data.tooling, "none declared")),
      VERIFIED,
    ].join("\n"),
    section(
      "Signals that prove it works",
      table(
        ["Capability", "Signal", "Where emitted"],
        data.signals.map((s) => [s.capability, s.signal, s.where]),
        "No signals recorded. Nothing here proves the module works in production.",
      ),
    ),
    section(
      "Operator views",
      table(["View", "Shows", "Exists at"], data.views.map((v) => [v.view, v.shows, v.where]), "No operator views recorded."),
    ),
    section(
      "Alerts",
      table(
        ["Condition", "Threshold", "Who is notified"],
        data.alerts.map((a) => [a.condition, a.threshold, a.destination]),
        "No alerts recorded.",
      ),
    ),
    section(
      "First-response pointers",
      bullets(
        data.firstResponse.map((f) => `When ${f.failure}, look at ${f.signal} first.`),
        "- None recorded.",
      ),
    ),
  );
}

// ------------------------------------------------------------------ test plan

export function testPlan(data) {
  return doc(
    `# ${text(data.module.name, "Module")} - Test Plan`,
    [label("Test tooling in use", commas(data.tooling, "not recorded")), VERIFIED].join("\n"),
    section(
      "What must be true",
      table(
        ["Feature", "Criterion", "Verified how", "Status"],
        data.acceptance.map((a) => [a.feature, a.criterion, a.verification_method, stat(a.status)]),
        "No acceptance criteria recorded for this module.",
      ),
    ),
    section(
      "Coverage map",
      table(
        ["Area", "Level", "Cases", "Status"],
        data.coverage.map((c) => [c.area, c.level, c.cases, c.status]),
        "No coverage recorded.",
      ),
    ),
    section(
      "Evidence conventions",
      doc(
        "A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.",
        table(
          ["Evidence", "Type", "Result", "Reference", "State"],
          data.evidence.map((e) => [e.summary, e.evidence_type, e.result, e.reference, stat(e.status)]),
          "No verification evidence recorded.",
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------------ adr

export function adr(data) {
  const d = data.decision;
  return doc(
    `# ${d.id}: ${text(d.title, "Untitled decision")}`,
    [
      label("Status", stat(d.status)),
      label("Date", data.date, "not recorded"),
      label("Owner or approver", d.accepted_by),
      label("Scope", `${text(d.scope_type, "project")} ${text(d.scope_id, "")}`.trim()),
      label("Supersedes", links(data.supersedes, "none")),
      label("Superseded by", links(data.supersededBy, "none")),
      label("Partially supersedes", links(data.partiallySupersedes, "none")),
      label("Expiry", d.expires_at, "none"),
      VERIFIED,
    ].join("\n"),
    section("Context", text(d.context, "No context recorded.")),
    section(
      "Evidence",
      bullets(data.evidence.map((e) => (typeof e === "string" ? e : `${text(e.claim ?? e.summary)} (${text(e.label ?? e.epistemic_status, "unlabelled")}, ${text(e.source, "no source")})`)), "- None recorded."),
    ),
    section("Decision criteria", bullets(data.criteria, "- None recorded.")),
    section(
      "Options considered",
      data.options.length
        ? data.options
            .map((o, i) =>
              `${i + 1}. **${text(o.name ?? o.option, "Option")}** - ${text(o.pros, "no benefits recorded")} / ${text(o.cons, "no costs recorded")}${o.why_not ? ` / rejected because ${o.why_not}` : ""}`)
            .join("\n")
        : "None recorded.",
    ),
    section("Decision", text(d.decision, "No decision recorded.")),
    section("Rationale", text(d.observable_rationale, "No observable rationale recorded.")),
    section(
      "Consequences",
      [
        `- Positive: ${commas(data.consequences.positive, "none recorded")}`,
        `- Negative: ${commas(data.consequences.negative, "none recorded")}`,
        `- Neutral: ${commas(data.consequences.neutral, "none recorded")}`,
      ].join("\n"),
    ),
    section("Risks", bullets(data.risks, "- None recorded.")),
    section("Enforcement", bullets(data.enforcement, "- Not enforced anywhere, which makes this a preference rather than a decision.")),
    section("Verification", text(d.verification, "No verification recorded.")),
    section("Revisit triggers", bullets(data.revisitTriggers, "- None recorded.")),
    section("Related", links(data.related, "Nothing linked.")),
    section(
      "History",
      table(
        ["#", "From", "To", "Scope delta", "Reason"],
        data.transitions.map((t) => [t.sequence, t.from_status, t.to_status, t.scope_delta, t.reason]),
        "No transitions recorded.",
      ),
    ),
  );
}

// -------------------------------------------------------------- derived views

export function changelog(data) {
  return doc(
    REGENERATED,
    `# ${text(data.project.name, "Project")} - Changelog`,
    "Specification and decision changes, newest first, taken from the append-only activity log. Task and session traffic stays in the control center.",
    table(
      ["#", "Date", "Change", "Actor"],
      data.entries.map((e) => [e.sequence, e.date, e.summary, e.actor]),
      "No changes recorded yet.",
    ),
  );
}

export function projectSummary(data) {
  return doc(
    REGENERATED,
    `# ${text(data.project.name, "Project")} - Project Summary`,
    "- **Method:** database-first read. Every claim below is a stored record, and anything unestablished is listed at the end rather than guessed.",
    section("What it is", text(data.project.statement, "No product statement recorded.")),
    section(
      "Who uses it",
      table(["Role", "Goal", "Evidence"], data.roles.map((r) => [r.name, r.primary_goals, r.who]), "No roles recorded."),
    ),
    section(
      "What it does",
      table(
        ["Module", "Capabilities", "Evidence"],
        data.modules.map((m) => [m.name, commas(m.features, "no features recorded"), link(m.doc)]),
        "No modules recorded.",
      ),
    ),
    section(
      "How it is built",
      table(["Capability", "Choice", "Evidence"], data.stack.map((s) => [s.area, s.choice, s.evidence]), "No stack slots recorded."),
    ),
    section(
      "How it runs",
      [
        label("Runtime pieces", commas(data.pieces, "none recorded")),
        label("Environments", commas(data.environments, "none recorded")),
        label("Integrations", commas(data.integrations, "none recorded")),
      ].join("\n"),
    ),
    section(
      "State of the project",
      table(["Measure", "Value"], data.state.map((s) => [s.measure, s.value]), "Nothing measured."),
    ),
    section(
      "Could not be established",
      bullets(
        data.unknowns.map((u) => `${u.item} - ${text(u.resolution, "no resolution path recorded")}`),
        "- Nothing outstanding.",
      ),
    ),
  );
}

export function statusReport(data) {
  return doc(
    REGENERATED,
    `# ${text(data.project.name, "Project")} - Status`,
    "Counts only. Individual tasks, sessions and assignments live in the database and the control center, never in a file.",
    section("Headline", table(["Measure", "Value"], data.headline.map((h) => [h.measure, h.value]), "Nothing recorded.")),
    section(
      "Milestones",
      table(["Milestone", "Status", "Features", "Complete"], data.milestones.map((m) => [m.name, stat(m.status), m.features, m.complete]), "No milestones recorded."),
    ),
    section(
      "Modules",
      table(["Module", "Status", "Features", "Steps filled"], data.modules.map((m) => [m.name, stat(m.status), m.features, m.steps]), "No modules recorded."),
    ),
    section(
      "Features needing attention",
      table(["Feature", "Status", "Next action"], data.attention.map((f) => [link(f.doc), stat(f.status), f.next_action]), "Nothing is waiting."),
    ),
    section(
      "Open questions",
      table(["Question", "Why it matters", "Scope"], data.questions.map((q) => [q.question, q.why_it_matters, q.scope]), "No open questions."),
    ),
  );
}

export function driftReport(data) {
  return doc(
    REGENERATED,
    `# ${text(data.project.name, "Project")} - Change Impact and Drift`,
    "- **Scope:** the whole project database and the documents generated from it.",
    section(
      "Change impact",
      table(
        ["Document", "Sync state", "Scope", "Action"],
        data.impact.map((i) => [link(i.doc), stat(i.sync_status), i.scope, i.action]),
        "Every generated document is in sync.",
      ),
    ),
    section(
      "Drift findings",
      table(
        ["#", "Class", "Database side", "Document side", "Resolution owner"],
        data.findings.map((f, i) => [i + 1, f.class, f.database, f.document, f.owner]),
        "No drift found.",
      ),
    ),
    section(
      "Contradictions still open",
      table(["Sides", "Detail", "Blocking"], data.contradictions.map((c) => [c.sides, c.detail, c.blocking]), "None open."),
    ),
    section("Pending sync", bullets(data.pending, "- Nothing pending.")),
  );
}
