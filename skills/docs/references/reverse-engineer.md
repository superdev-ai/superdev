# Reverse-Engineering Documentation from Code

Build honest documentation for an undocumented (or under-documented) repository. Code is the highest authority for current behavior; everything not directly read is labeled.

## Order of operations

1. **Static orientation first:** run `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/profile-detect.mjs" --root <project> --json` for stack/capability evidence; read repository instructions, manifests (including workspace members), entry points, and configuration before any prose.
2. **Map the tree:** routes/screens, handlers, services, schema sources, jobs, tests - a structural map with file paths, before interpretation.
3. **Group into candidate modules** by URL/navigation prefix, folder cohesion, and data ownership; present the candidate inventory for confirmation before deep work.
4. **Run the twenty-step loop in reverse** (`module-decomposition.md`): fill each step from code evidence - routes from the router, actions from handlers, schema from schema sources, states from enums/guards, permissions from middleware/policies. Cite the file per claim.
5. **Label ruthlessly:** read-and-verified → Confirmed · structure-implied → Inferred (marked in the artifact, not just the report) · not determinable → Unknown, listed as an open question. Never fill a gap with plausibility.
6. **Ask only about genuine gaps** - intent, priorities, and history that code cannot show (why a thing exists, whether a behavior is deliberate). Never ask what the code answers.
7. **Reconciliation report** when partial docs exist: docs-vs-code disagreements by drift class, each with both sides' evidence - separate from the new artifacts.

## Rules

- Adoption rules apply: new artifacts land per the active profile; existing docs are never restructured by reverse-engineering.
- Behavior observed only in tests is evidence of intent as well as behavior - cite the test.
- Dead code and unreferenced surfaces are reported as findings, not documented as features.
- Generated artifacts (lockfiles, build output, generated types) are evidence of configuration, not hand-written intent - do not document them as design.
- The output is drafts + report; acceptance is explicit, like every Docs mutation.
