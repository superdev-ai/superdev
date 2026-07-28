# Superdev Plugin Product Requirements Document

## 1. Document Information

| Field                    | Value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Product                  | Superdev                                                           |
| Product Type             | Open-source AI product-development plugin and local control center |
| Status                   | Draft for owner approval                                           |
| License                  | Apache-2.0                                                         |
| Primary Platforms        | Claude Code, Codex, skills.sh-compatible agents                    |
| Primary Storage          | Project-local SQLite-compatible database                           |
| Documentation Foundation | Existing Superdev Docs skill                                       |
| Cloud Component          | Future Superdev Cloud integration                                  |
| Memory Architecture      | Partially defined, final architecture undecided                    |

---

## 2. Product Summary

### 2.1 What We Are Building

Superdev is a product-building operating system for AI agents, developers, product owners, designers, and non-technical founders.

It converts a product idea or an existing project into a structured, continuously maintained product model containing:

- Product vision
- Goals
- Delivery milestones
- Modules
- Features
- Workflows
- Workflow steps
- UI surfaces and actions
- APIs and API operations
- Data schemas and migrations
- Integrations
- Background jobs and webhooks
- Roles and permissions
- Non-functional requirements
- Test plans
- Tasks and subtasks
- Dependencies
- Decisions
- Changes
- Evidence
- Questions and assumptions
- Short-term and long-term memory

Superdev then uses this model to guide AI agents through planning, implementation, verification, documentation, and handoff.

The product must ensure that an agent never starts building random, unmapped work. Every implementation task must belong to a feature and must implement a known product contract.

### 2.2 Product Vision

A user should be able to describe a product in ordinary language and have Superdev help them:

1. Understand what they are trying to build.
2. Ask the questions they did not know they needed to answer.
3. Convert the answers into a complete product specification.
4. Select an appropriate architecture and technology stack.
5. Break the product into modules, features, workflows, APIs, schemas, and tasks.
6. Coordinate specialist skills at the right time.
7. Guide the implementation task by task.
8. Track progress automatically.
9. Maintain documentation and decisions continuously.
10. Resume accurately after a new session or context reset.
11. Show the project’s real status in a human-readable control center.
12. Preserve project knowledge across agents and developers.

### 2.3 Core Product Promise

At any point, a human or agent must be able to answer:

- What are we building?
- Why are we building it?
- Who is it for?
- What outcomes are expected?
- What modules and features exist?
- How does each workflow behave?
- What is complete?
- What is currently being built?
- What is blocked?
- What remains?
- Which agent or developer is working on each task?
- Which branch contains the work?
- Which decisions govern the implementation?
- What changed and why?
- What evidence proves that something works?
- What should happen next?

---

## 3. Problem Statement

AI coding agents can generate code quickly, but they frequently suffer from:

- Incomplete requirements
- Weak product understanding
- Unrecorded assumptions
- Missing workflows and edge cases
- Unclear architecture
- Unplanned integrations
- Tasks that are not connected to product outcomes
- Documentation that becomes outdated
- Decisions that are forgotten
- Work duplicated by multiple agents
- Status reports based on conversation history instead of live project state
- Progress percentages that do not reflect actual deliverables
- Excessive raw logs that consume tokens without improving decisions
- Tests that validate internal machinery while the real product remains incomplete
- Context loss between sessions
- Project drift from the original goal

Superdev must solve these problems through structured discovery, persistent project state, specialist skill orchestration, product-linked task execution, and evidence-based completion.

---

## 4. Target Users

### 4.1 Primary Users

- Non-technical founders
- Product owners
- Developers
- Engineering leads
- Designers
- AI-assisted development teams
- Solo developers using coding agents

### 4.2 Agent Users

- Claude Code
- Codex
- skills.sh-compatible agents
- Future supported coding-agent environments

### 4.3 User Knowledge Assumption

Superdev must not assume that the user understands:

- Software architecture
- Databases
- Authentication
- APIs
- Infrastructure
- Security
- Testing
- Deployment
- Product design terminology

Questions must use plain language first. Technical terminology can be shown as supporting detail.

---

## 5. Product Principles

### P-001: Clarify Before Building

Superdev must understand the product, module, feature, and workflow before implementation begins.

### P-002: Ask Proactive Questions

Superdev must identify missing decisions and ask questions that help the user think through the product.

### P-003: Database as Operational Authority

The project database is the live operational source for status, assignments, progress, sessions, tasks, evidence, and relationships.

### P-004: Docs Skill as the Specification Foundation

The existing Docs skill defines the structure and quality of product documentation. It must not be redesigned or replaced in this scope.

### P-005: One Product Model

Database records and generated documentation must represent the same accepted product model. They must not evolve independently.

### P-006: Product Work Before Internal Ceremony

Superdev must prioritize product clarity, implementation, and real-world verification over unnecessary internal process.

### P-007: Evidence Before Completion

A task, feature, milestone, or goal cannot be reported as complete without its required evidence.

### P-008: Memory Is Recall, Not Authority

A recalled statement must be checked against current specifications, decisions, code, and evidence before consequential use.

### P-009: Providers Before Reinvention

Superdev must use suitable specialist skills when available instead of recreating their methods.

### P-010: Hooks Improve Reliability, Not Correctness

No required behavior may depend exclusively on a hook firing.

### P-011: Local First

The complete core workflow must function locally without Superdev Cloud.

### P-012: Human-Readable Status

The control center must explain status in plain language, not only through percentages, IDs, or technical labels.

### P-013: Safe Autonomy

Once the product plan is accepted, the agent may continue through unblocked tasks without unnecessary checkpoints. It must stop for material owner decisions, security-sensitive actions, destructive actions, external credentials, or genuine blockers.

### P-014: Controlled Generated Content

Superdev-generated project content must not contain emojis or em dashes.

### P-015: Public Repository Privacy

Public Superdev source, documentation, examples, history, and fixtures must not expose internal project names, private paths, credentials, or personal identifiers.

---

## 6. Canonical Product Model

### 6.1 Product Objects

| Object                     | Purpose                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| Product                    | The complete product being built                                            |
| Goal                       | A lasting business, user, or technical outcome                              |
| Milestone                  | A delivery checkpoint or release stage                                      |
| Module                     | A coherent product or technical domain                                      |
| Feature                    | A user-facing or system capability                                          |
| Workflow                   | An ordered journey that produces an outcome                                 |
| Workflow Step              | A single action or system transition in a workflow                          |
| UI Surface                 | A page, screen, panel, modal, or interface area                             |
| UI Action                  | A button, form, command, interaction, or state transition                   |
| API Service                | A logical API boundary                                                      |
| API Operation              | A concrete endpoint, procedure, event, or command                           |
| Data Entity                | A persistent domain object                                                  |
| Data Field                 | An attribute of a data entity                                               |
| Data Relation              | A relationship between data entities                                        |
| Migration                  | A versioned database change                                                 |
| Integration                | An external or internal system dependency                                   |
| Job                        | A background or scheduled process                                           |
| Webhook                    | An inbound or outbound event contract                                       |
| Role                       | A person or system actor                                                    |
| Permission                 | An allowed action within a scope                                            |
| Non-Functional Requirement | A security, performance, privacy, accessibility, or reliability requirement |
| Test Plan                  | The agreed verification strategy for a feature or workflow                  |
| Task                       | A bounded implementation unit                                               |
| Subtask                    | A smaller task belonging to a parent task                                   |
| Evidence                   | Proof that a requirement or task works                                      |
| Decision                   | An accepted choice and observable rationale                                 |
| Change                     | A recorded alteration to accepted product scope or behavior                 |
| Question                   | An unresolved product or technical choice                                   |
| Assumption                 | A reversible answer used temporarily                                        |
| Work Session               | A bounded period of agent or developer activity                             |
| Assignment                 | Ownership of a task by a developer and agent                                |
| Memory                     | Verified or unverified recall from previous work                            |

### 6.2 Required Relationships

- A Product contains Modules.
- A Product has Goals.
- A Product has Milestones.
- A Goal describes an outcome.
- A Milestone describes a delivery checkpoint.
- Goals and Milestones must not be treated as the same object.
- A Feature belongs to one primary Module.
- A Feature supports one or more Goals.
- A Feature may be scheduled into one Milestone.
- A Workflow may involve multiple Features and Modules.
- Every Workflow contains ordered Workflow Steps.
- Every Workflow Step must identify its responsible Feature or system boundary.
- A Feature may reference UI, API, schema, integration, job, webhook, permission, and non-functional contracts.
- Every Task must belong to exactly one Feature.
- Every implementation Task must link to at least one accepted contract.
- A Task may have Subtasks and Dependencies.
- Evidence must identify the Task or acceptance criterion it proves.
- Decisions may govern the Product, Module, Feature, Workflow, Task, API, Schema, or Integration.
- Changes must record the affected records and the reason for the change.
- Memory must link to the records it concerns.

### 6.3 Derived Completion

The following states must be calculated instead of manually asserted:

- Feature completion from acceptance criteria and required evidence
- Workflow completion from its required steps and supported feature capabilities
- Milestone readiness from its scheduled features and exit criteria
- Goal achievement from measurable outcome evidence
- Product progress from accepted deliverables

A completed Milestone does not automatically mean that every Goal is achieved.

---

## 7. Source of Truth and Documentation

### 7.1 Operational Authority

The project-local database is authoritative for:

- Current lifecycle state
- Tasks and subtasks
- Assignments
- Agent sessions
- Branches
- Activity
- Evidence
- Dependencies
- Progress
- Questions
- Memory
- Documentation generation state
- Record relationships

### 7.2 Human-Readable Product Contracts

The Docs skill generates and maintains human-readable Markdown for:

- Foundations
- Module inventory
- Module specifications
- Feature specifications
- Workflows
- UI surfaces and actions
- API specifications
- Schema and data design
- Integration specifications
- Test plans
- Decisions
- Changes
- Changelog

### 7.3 Docs Skill Boundary

The existing Docs skill must remain unchanged during this product scope.

Superdev must build an adapter around it that:

1. Uses its templates and methodology.
2. Converts accepted discovery answers into the matching database records.
3. Generates the corresponding Markdown through the Docs workflow.
4. Tracks document revision and source record revision.
5. Detects manual Markdown edits.
6. Treats manual edits as proposals.
7. Accepts or rejects proposals explicitly.
8. Prevents silent divergence between the database and documentation.

### 7.4 Repository Cleanliness

Superdev must not create a Markdown or JSON file for every:

- Task
- Session
- Event
- Assignment
- Memory
- Hook execution
- Status refresh
- Activity event

These belong in the database.

Only meaningful Docs skill artifacts should be committed to the repository.

Generated indexes, caches, temporary exports, runtime databases, backup files, and transient activity data must be ignored unless explicitly exported for review.

---

## 8. Onboarding Journeys

Superdev must support two onboarding paths.

### 8.1 New Product

Command:

```bash
superdev init
```

Used when:

- The repository is empty.
- Only an idea exists.
- A scaffold exists but product requirements do not.
- The user wants Superdev to guide product definition from the beginning.

### 8.2 Existing Product

Command:

```bash
superdev adopt
```

Used when:

- A codebase already exists.
- Documentation may be incomplete or outdated.
- Existing behavior must be reverse-engineered.
- Superdev must create an initial product map without changing product behavior.

### 8.3 Onboarding Process

#### Step 1: Environment Inspection

Superdev must inspect:

- Repository structure
- Existing documentation
- Package manifests
- Frameworks
- Database tooling
- Migration files
- APIs
- UI routes
- Authentication
- Integrations
- Tests
- Deployment configuration
- Existing agent instructions
- Current Git status

It must not ask for information that can be discovered safely.

#### Step 2: Capability Inspection

Superdev must check whether the relevant specialist providers are:

- Installed
- Invocable
- Compatible with the current harness
- Trusted where required
- Available at a known version

Missing providers must be reported with:

- Their purpose
- What work will be weaker without them
- The exact installation plan
- Any required user consent

No provider may be installed silently.

#### Step 3: Product Foundation Interview

Superdev must establish:

- Product name
- Product description
- Problem being solved
- Target users
- User roles
- Expected outcomes
- Business model if applicable
- Supported platforms
- Constraints
- Known risks
- Success metrics
- Explicit non-goals
- Release expectations

#### Step 4: Module Discovery

For every proposed Module, Superdev must ask:

- What responsibility does this Module own?
- Which users interact with it?
- What is explicitly outside its scope?
- Which other Modules does it depend on?
- What data does it own?
- Which APIs does it expose or consume?
- Which UI surfaces belong to it?
- Which integrations does it require?
- What permissions apply?
- What failure conditions must be handled?
- What performance, privacy, security, and reliability requirements apply?
- How will the Module be tested?
- How will it be deployed and observed?

#### Step 5: Feature Discovery

For every Feature, Superdev must establish:

- Feature name
- User problem
- Intended outcome
- Primary actor
- Supporting actors
- Entry point
- Preconditions
- Happy path
- Alternative paths
- Failure paths
- Edge cases
- Acceptance criteria
- UI surfaces
- UI actions and states
- API operations
- Data entities and fields
- Integrations
- Roles and permissions
- Notifications
- Background processing
- Observability
- Security requirements
- Accessibility requirements
- Performance requirements
- Test strategy
- Rollout strategy
- Rollback strategy
- Goals supported
- Milestone assignment

#### Step 6: Workflow Discovery

For every Workflow, Superdev must establish:

- Trigger
- Actor
- Preconditions
- Ordered steps
- Decision points
- UI interaction at each step
- API operation at each step
- Data read or written at each step
- Permission checks
- External integrations
- Retry rules
- Timeout behavior
- Failure behavior
- Compensation or rollback behavior
- Completion condition
- Evidence required
- Analytics and telemetry
- Related Features

#### Step 7: Architecture and Technology Interview

Superdev must clarify:

- Application platforms
- Frontend framework
- UI component system
- Backend framework
- API style
- Authentication
- Authorization
- Organization and tenancy model
- Primary database
- Local database
- Migration tooling
- File storage
- Search
- Cache
- Background jobs
- Events and webhooks
- Realtime communication
- Offline behavior
- Conflict resolution
- Email and notifications
- Analytics
- Logging
- Metrics
- Error tracking
- Rate limiting
- Security
- Privacy
- Compliance
- Environment management
- CI/CD
- Infrastructure
- Hosting
- Backup
- Recovery
- Retention
- Data deletion
- Cost constraints
- Performance objectives
- Availability objectives
- Deployment and rollback

Technology choices must include:

- Recommended option
- Alternatives
- Benefits
- Risks
- Operational cost
- Lock-in considerations
- Reversibility
- Owner decision

#### Step 8: Production-Readiness Review

Every applicable area must be marked as:

- Specified
- Awaiting decision
- Not applicable, with reason
- Deferred, with owner, trigger, and consequence

#### Step 9: Product Map Presentation

Before implementation, Superdev must present:

- Product summary
- Goals
- Milestones
- Modules
- Features
- Workflows
- Architecture
- Technology stack
- Data model
- APIs
- Integrations
- Major decisions
- Open questions
- Risks
- Suggested delivery order
- Proposed first implementation slice

The owner must accept the plan or request changes.

#### Step 10: Documentation and Database Creation

After acceptance, Superdev must:

1. Create the project database.
2. Run versioned migrations.
3. Store the accepted product model.
4. Generate Docs skill artifacts.
5. Confirm database and document parity.
6. Derive implementation Tasks.
7. Open the local control center.
8. Present the first ready Task.

#### Step 11: Start Implementation

Implementation begins only when:

- The product foundation is accepted.
- The relevant Feature is accepted.
- The Task belongs to that Feature.
- The Task links to an accepted contract.
- Dependencies are satisfied.
- Material questions are answered or explicitly assumed.
- Verification requirements are known.

### 8.4 Question Quality Standard

Each material question should contain:

- The question in plain language
- Why the answer matters
- A recommendation where appropriate
- Tradeoffs
- A simple example
- The consequence of leaving it unanswered

Superdev should ask three to five related questions at a time.

Irreversible or high-risk decisions should be asked individually.

“I do not know” is a valid answer. Superdev may recommend a reversible assumption, but it must record the assumption and its review trigger.

---

## 9. Product Development Lifecycle

Superdev must operate using the following lifecycle:

1. Discover
2. Clarify
3. Model
4. Specify
5. Review
6. Accept
7. Derive Tasks
8. Assign
9. Implement
10. Verify
11. Record Evidence
12. Update Documentation
13. Recalculate Progress
14. Consolidate Memory
15. Continue or Handoff

### 9.1 Before Implementation

Before modifying product code, the agent must:

1. Resume current project state.
2. Identify the active Task.
3. Create a Task if legitimate work has no Task.
4. Confirm the owning Feature.
5. Confirm the contract being implemented.
6. Check governing Decisions.
7. Check Dependencies.
8. Claim the Task.
9. Mark it In Progress.
10. Record the Work Session and branch.

### 9.2 During Implementation

The agent must:

- Record meaningful activity, not every edit.
- Update the product model before implementing newly discovered scope.
- Create a Decision when a material architectural or product choice changes.
- Create a Change when accepted behavior changes.
- Record blockers immediately.
- Keep Task and Feature state current.
- Use required specialist skills.
- Avoid duplicating another active assignment.

### 9.3 Completion

A Task may complete only when:

- Acceptance criteria are satisfied.
- Product tests defined by the accepted test plan pass.
- Required review is complete.
- Evidence is recorded.
- Documentation is refreshed.
- No required subtask remains open.
- The code and project model agree.

---

## 10. First-Party Superdev Skills

| Skill      | Purpose                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`  | Primary orchestrator. Routes all product work through the accepted product model and specialist providers.                                         |
| `init`     | Discovers and defines a new product through a structured interview.                                                                                |
| `adopt`    | Reverse-engineers an existing product and creates its initial product model. This may be implemented through the init skill with an adoption mode. |
| `feature`  | Creates, deepens, reviews, and accepts Feature specifications.                                                                                     |
| `task`     | Creates, derives, assigns, starts, blocks, verifies, completes, cancels, and reopens Tasks.                                                        |
| `docs`     | Existing documentation engine and template foundation. It must not be redesigned in this scope.                                                    |
| `status`   | Produces a human-readable explanation of current product state.                                                                                    |
| `resume`   | Reconstructs current work from the database, repository, decisions, evidence, and verified memory.                                                 |
| `decision` | Records, supersedes, reviews, and applies Decisions.                                                                                               |
| `debug`    | Runs evidence-first systematic debugging linked to the affected Feature and contract.                                                              |
| `review`   | Reviews contract compliance first and implementation quality second.                                                                               |
| `doctor`   | Checks project health, database health, documentation parity, harness coverage, and provider availability.                                         |

Memory and the control center are runtime services used by these skills. They do not need separate skills unless a future use case requires direct specialist workflows.

---

## 11. Specialist Provider Skills

Superdev must orchestrate these providers rather than copying their implementations.

| Provider                                | Purpose                                                                             | When Used                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Superpowers Brainstorming               | Improve discovery and explore product alternatives                                  | Product initialization, new Features, major scope changes                   |
| Superpowers Planning                    | Produce structured implementation plans                                             | After specifications are accepted                                           |
| Superpowers Test-Driven Development     | Guide product-level implementation testing                                          | While implementing accepted product behavior                                |
| Superpowers Systematic Debugging        | Establish evidence and root cause                                                   | Bugs, regressions, failed verification                                      |
| Superpowers Code Review and Finish Work | Review completed implementation and prepare delivery                                | Before Task or release completion                                           |
| Frontend Design                         | Establish strong product interface direction                                        | New UI surfaces, major redesigns, interaction models                        |
| Impeccable                              | Critique and polish usability, accessibility, hierarchy, motion, and visual quality | After functional UI exists and before completion                            |
| Find Skills                             | Discover suitable specialist skills                                                 | When a required capability is not covered                                   |
| skills.sh                               | Install and distribute compatible skills                                            | Provider setup and standalone distribution                                  |
| Task Observer                           | Capture reusable methodology improvements                                           | During substantive Superdev workflows                                       |
| envx                                    | Manage environment stages and secrets safely                                        | Environment setup, local development, deployment                            |
| Claude Mem                              | Optional transitional conversational recall                                         | Only as a supplementary cache until Superdev memory reaches accepted parity |

### 11.1 Provider Rules

- A provider receives the smallest necessary context.
- Provider output must be screened before storage.
- Provider output must be attributed.
- Provider output is not automatically accepted as project truth.
- Missing providers must not be silently substituted.
- Installation requires explicit consent.
- Superdev remains the orchestrator and product authority.
- Claude Mem must never override Superdev records.

---

## 12. Required Command Surface

### 12.1 Project Lifecycle

```bash
superdev init
superdev adopt
superdev plan
superdev readiness
superdev status
superdev resume
superdev resume --end
superdev doctor
```

### 12.2 Local Control Center

```bash
superdev ui
superdev start
superdev stop
superdev restart
superdev services
```

### 12.3 Database

```bash
superdev db status
superdev db migrate --apply
superdev db backup --apply
superdev db restore <backup> --apply
superdev export <file> --apply
superdev import <file> --apply
```

All schema changes must use versioned migrations. Direct schema push commands must not be used.

### 12.4 Product Map

The target command surface should support:

```bash
superdev module list
superdev module show <MODULE-id>
superdev goal list
superdev goal show <GOAL-id>
superdev milestone list
superdev milestone show <MILESTONE-id>
superdev feature list
superdev feature show <FEATURE-id>
superdev feature depth <FEATURE-id> <depth>
superdev feature accept <FEATURE-id>
superdev workflow list
superdev workflow show <WORKFLOW-id>
superdev architecture show
superdev schema show
superdev api show
superdev integration list
```

### 12.5 Tasks

```bash
superdev task list
superdev task show <TASK-id>
superdev task create
superdev task update <TASK-id>
superdev task claim <TASK-id>
superdev task start <TASK-id>
superdev task release <TASK-id>
superdev task block <TASK-id>
superdev task unblock <TASK-id>
superdev task evidence <TASK-id>
superdev task complete <TASK-id>
superdev task cancel <TASK-id>
superdev task reopen <TASK-id>
superdev derive
superdev verify <TASK-id>
```

Lifecycle state changes must use their explicit lifecycle commands.

### 12.6 Documentation

```bash
superdev docs generate
superdev docs diff
superdev docs accept <proposal-id>
superdev docs reject <proposal-id>
```

### 12.7 Decisions and Questions

```bash
superdev question list
superdev question answer <QUESTION-id>
superdev decision record
superdev decision supersede <DECISION-id>
superdev decision list
```

### 12.8 Memory

The target memory command surface should support:

```bash
superdev memory search "<topic>"
superdev memory show <MEMORY-id>
superdev memory verify <MEMORY-id>
superdev memory consolidate
superdev memory supersede <MEMORY-id>
superdev memory status
```

### 12.9 Future Cloud Synchronization

```bash
superdev cloud connect
superdev cloud status
superdev sync
superdev sync --dry-run
superdev sync --resolve
```

Cloud synchronization is not required for the local plugin to function.

---

## 13. Hooks

### 13.1 Session Start

Responsibilities:

- Confirm database accessibility.
- Confirm schema version.
- Open or rejoin a Work Session.
- Show the active Task.
- Show the current objective.
- Show blockers and unanswered questions.
- Show the next recommended action.
- Report provider and harness limitations.

### 13.2 User Prompt Submit

Responsibilities:

- Detect whether the requested work maps to an existing Task.
- Remind the agent to create and link a Task if no valid Task exists.
- Detect requests that contradict accepted Decisions.
- Ask for confirmation before overriding an earlier Decision.
- Avoid blocking harmless conversational questions.

### 13.3 Post Tool Use

Responsibilities:

- Record files touched by the active Task.
- Record meaningful activity at a controlled frequency.
- Mark related generated documentation as potentially stale.
- Avoid recording every edit as an individual event.

### 13.4 Pre-Compact

Responsibilities:

- Create a compact handoff.
- Preserve the active Task and Feature.
- Preserve governing Decisions.
- Preserve blockers.
- Preserve verification state.
- Preserve the exact next action.

### 13.5 Session End

Responsibilities:

- Record the observable session outcome.
- Release or retain the assignment according to policy.
- Update Task state.
- Update the branch and revision.
- Consolidate relevant short-term memory.
- Record the handoff.

### 13.6 Hook Reliability Rule

Every hook behavior must have a command-based fallback.

- Claude Code may use lifecycle hooks.
- Codex hooks may require explicit trust.
- skills.sh environments may have no hook support.
- Project correctness must remain possible through `superdev resume`, Task commands, and explicit lifecycle commands.

---

## 14. Database Requirements

### 14.1 Storage Model

The local database must store normalized records for:

- Projects
- Goals
- Milestones
- Modules
- Features
- Feature acceptance criteria
- Workflows
- Workflow steps
- UI surfaces
- UI actions
- API services
- API operations
- Data entities
- Data fields
- Data relations
- Migrations
- Integrations
- Jobs
- Webhooks
- Roles
- Permissions
- Non-functional requirements
- Test plans
- Tasks
- Task dependencies
- Task contract links
- Task assignments
- Developers
- Agents
- Branches
- Work sessions
- Verification evidence
- Questions
- Assumptions
- Decisions
- Decision supersession
- Changes
- Activity events
- Documents
- Documentation proposals
- Memory entries
- Memory links
- Memory search terms
- Optional memory embeddings

### 14.2 Database Enforcement

The database should enforce important invariants where practical:

- A Task cannot exist without a Feature.
- A Task cannot begin implementation without an accepted contract or explicit enabling target.
- A Task cannot complete while required Subtasks remain open.
- Only one active assignment may own a Task.
- Immutable history records cannot be silently updated or deleted.
- Memory links cannot reference missing records.
- Accepted Decisions must be superseded rather than overwritten.
- Parent completion cannot be asserted while child requirements are incomplete.
- Changes must preserve audit history.

### 14.3 Database Lifecycle

- All schema changes use ordered migrations.
- Migrations must be idempotent where possible.
- A backup must be created before risky migration.
- Migration history must be verifiable.
- Runtime data must not be stored as repository JSON files.
- The database and backups must be ignored by Git by default.
- Portable export and import must be supported.

---

## 15. Memory System Requirements

### 15.1 Status

The final Claude Mem alternative architecture is not yet approved.

Superdev may continue using its existing structured local memory foundation while the final design is evaluated.

### 15.2 Memory Objectives

The memory system must:

- Restore useful context across sessions.
- Reduce repeated repository exploration.
- Preserve decisions and learned facts.
- Preserve blockers and unresolved questions.
- Preserve verified outcomes.
- Support agent handoff.
- Avoid injecting complete conversation histories.
- Avoid storing secrets.
- Avoid storing hidden reasoning or chain-of-thought.
- Avoid treating the agent’s own unverified output as a fact.
- Detect stale and contradicted memories.
- Support local operation.
- Allow a future shared cloud implementation.

### 15.3 Short-Term Memory

Short-term memory should include:

- Active objective
- Active Task
- Active Feature
- Current branch
- Assigned developer
- Assigned agent
- Recently touched files
- Recent meaningful activity
- Current blockers
- Unanswered questions
- Pending documentation proposals
- Latest verification
- Exact next action

Short-term memory should be compact, session-oriented, and aggressively consolidated.

### 15.4 Long-Term Memory

Long-term memory should include:

- Accepted Decisions
- Confirmed learned facts
- Verified implementation outcomes
- Root causes of important defects
- Reusable project-specific patterns
- Significant failed approaches
- Resolved blockers
- Long-lived architectural constraints
- Handoff summaries
- Product and domain knowledge not already represented by accepted specifications

Long-term memory must use stable links to the relevant records.

### 15.5 Memory Types

Supported memory kinds should include:

- Outcome
- Decision
- Learned fact
- Unresolved question
- Blocker
- Handoff
- Summary

Supported epistemic states should include:

- Confirmed
- Inferred
- Assumed
- Unknown
- Contradicted

### 15.6 Memory Capture

Capture should occur from meaningful events such as:

- Task start
- Task completion
- Decision acceptance
- Decision supersession
- Blocker creation
- Blocker resolution
- Failed approach
- Successful verification
- Session handoff
- Documentation acceptance
- Material product change

Capture must be idempotent so repeated hooks do not create duplicate memories.

### 15.7 Memory Retrieval

Retrieval must use progressive disclosure:

1. Structured filters
2. Record relationships
3. Lexical retrieval
4. Recency
5. Memory type weighting
6. Epistemic status weighting
7. Optional semantic retrieval
8. Optional reranking

Only the smallest useful context should be returned.

### 15.8 Recall Verification

Every recalled memory must carry:

- Memory ID
- Memory type
- Epistemic status
- Source reference
- Linked records
- Creation time
- Supersession state
- Retrieval score
- Verification warning

Before consequential use, Superdev must compare the memory with:

- Current specifications
- Current Decisions
- Current record versions
- Current code
- Newer evidence
- Superseding memories

Possible verification results:

- Verified
- Needs review
- Contradicted
- Unverifiable

### 15.9 Consolidation

The memory system should periodically:

- Merge duplicates
- Connect related memories
- Supersede outdated statements
- Promote important short-term outcomes to long-term memory
- Discard low-value operational noise
- Detect contradictions
- Preserve provenance
- Recalculate retrieval metadata
- Enforce retention policies

### 15.10 Karpathy-Inspired Knowledge Compilation

The verified Karpathy LLM Wiki pattern uses three conceptual layers:

1. Immutable raw sources
2. An LLM-maintained, interlinked knowledge layer
3. An operating schema that defines ingest, query, and maintenance

Superdev may adapt this as:

| Karpathy Pattern           | Superdev Interpretation                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| Raw sources                | User-provided requirements, accepted evidence, source documents, repository state |
| Maintained knowledge layer | Accepted Docs skill artifacts and verified long-term memory                       |
| Operating schema           | Superdev’s database model, skills, commands, hooks, and Docs templates            |

The useful principle is compounding knowledge: important synthesis should be maintained once rather than recreated from raw conversation history during every session.

This is an architectural influence, not an approved storage implementation.

### 15.11 Embeddings and Vector Search

Embeddings are optional and remain undecided.

Superdev must begin with:

- Structured links
- Deterministic filters
- Inverted lexical indexing
- Progressive retrieval
- Retrieval benchmarks

Embeddings may be added only when benchmarks demonstrate a meaningful improvement.

The decision must define:

- Provider
- Model
- Dimensions
- Local or remote execution
- Privacy policy
- Cost
- Re-embedding policy
- Content hash
- Model version
- Storage format
- Vector index
- Bounded fallback behavior
- Team synchronization behavior

If the local engine has no vector index, Superdev must report that semantic retrieval uses a bounded scan. It must not describe the scan as indexed vector search.

### 15.12 Memory Evaluation

Before replacing Claude Mem, Superdev must measure:

- Relevant-memory recall
- Retrieval precision
- Retrieval noise
- Ranking quality
- Token reduction
- Latency
- Storage growth
- Stale-memory detection
- Contradiction detection
- Cross-session resume accuracy
- Cross-agent handoff accuracy

Claude Mem should remain optional until Superdev demonstrates acceptable parity for the use cases Superdev needs.

---

## 16. Local Control Center Requirements

The local control center must read live data through the shared database service.

It must not require the agent to regenerate static HTML after every update.

### 16.1 Required Areas

- Overview
- Product Vision
- Goals
- Milestones
- Modules
- Features
- Workflows
- Tasks
- Architecture
- UI Surfaces
- APIs
- Schema
- Integrations
- Decisions
- Changes
- Evidence
- Memory
- Activity
- Blueprint
- Settings

### 16.2 Overview Requirements

The Overview must explain:

- What the product is
- Who it is for
- What outcome it is pursuing
- Current delivery stage
- Overall project progress
- Current milestone progress
- What works today
- What is being built now
- What is blocked
- What is pending
- What should happen next

Every progress value must say what it counts.

### 16.3 Drill-Down Requirements

Users must be able to navigate:

- Goal to supporting Features
- Milestone to scheduled Features
- Module to Features
- Feature to Workflows
- Workflow to Steps
- Feature to Tasks
- Task to Subtasks
- Task to contract
- Task to assignee
- Task to branch
- Task to evidence
- Task to activity
- Decision to affected records
- Change to affected records
- Memory to source records

### 16.4 Task Management

The control center must support:

- Creating Tasks
- Editing Tasks
- Categorizing Tasks
- Claiming Tasks
- Assigning developers and agents
- Starting Tasks
- Blocking Tasks
- Adding Subtasks
- Adding Dependencies
- Adding Evidence
- Completing Tasks
- Cancelling Tasks
- Reopening Tasks
- Deleting only when safe and allowed by history policy
- Filtering by Feature, status, category, owner, branch, and milestone

### 16.5 Blueprint

The Blueprint must provide an interactive relationship canvas for:

- Product
- Goals
- Milestones
- Modules
- Features
- Workflows
- Tasks
- Integrations
- APIs
- Schemas
- Decisions

It must support:

- Pan
- Zoom
- Fullscreen
- Dragging
- Selection
- Deselecting on empty-canvas click
- Network highlighting
- Connected-path highlighting
- Relationship filters
- Search
- Automatic organization by relationship
- Opening the selected record
- Persisting user layout separately from product truth

### 16.6 User Interface Standard

- React-based component architecture
- Reusable components
- shadcn-compatible component foundation
- Responsive layout
- Accessible interaction
- Light and dark theme
- Title-case human-readable statuses
- Monospace only for IDs, commands, and machine values
- No emojis
- No em dashes
- Plain-language descriptions before technical details
- Technical metadata available through drill-down

---

## 17. Autonomous Agent Requirements

### 17.1 The Agent Must

- Read current state before acting.
- Work only on mapped Tasks.
- Create a Task before starting legitimate untracked work.
- Link every Task to a Feature.
- Link implementation Tasks to a contract.
- Check prior Decisions.
- Ask before contradicting an accepted Decision.
- Update state when work begins.
- Update state when scope changes.
- Record meaningful activity.
- Record blockers.
- Record evidence.
- Update documentation after accepted behavior changes.
- Recalculate progress.
- Create a handoff before ending.
- Continue to the next ready Task when no material decision or blocker remains.

### 17.2 The Agent Must Not

- Build unapproved scope.
- Mark parent records complete manually.
- Claim completion without evidence.
- Treat memory as authority.
- Store hidden reasoning.
- print or store secrets.
- create one tracking file per Task or event.
- silently install providers.
- silently change architecture.
- hide external verification gaps.
- continue after encountering a decision requiring owner authority.
- use direct database schema push commands.
- generate emojis or em dashes in project content.

---

## 18. Security and Privacy Requirements

- Secrets must never be stored in memory, activity, evidence, generated documents, or provider output.
- Secret-shaped values must be screened before persistence.
- Environment values must be handled through envx or an approved equivalent.
- Public repository content must be scanned for private identifiers.
- Memory must support project isolation.
- Future shared memory must support organization and project access controls.
- Cross-organization existence must not be disclosed.
- Destructive commands require explicit scope and confirmation.
- Provider installation requires an approved plan.
- Remote memory and cloud synchronization must use authenticated and encrypted transport.
- Exported project data must be reviewable before sharing.

---

## 19. Distribution Requirements

Superdev should support:

- Claude Code plugin distribution
- Codex plugin distribution
- skills.sh-compatible standalone distribution
- Local repository development
- Open-source installation
- Versioned database migrations
- Capability inspection after installation
- Honest reporting of harness-specific limitations

The standalone distribution must contain:

- Superdev skills
- Docs skill
- Runtime
- Database migrations
- Control center assets
- Command reference
- Provider inspector
- Privacy validator

---

## 20. Quality Strategy

### 20.1 Superdev Plugin

The Superdev plugin must avoid a large internal test suite that increases repository weight without proving product usefulness.

Plugin quality should rely on:

- Deterministic validators
- Manifest validation
- Migration validation
- Database integrity checks
- Documentation parity checks
- Privacy scans
- Real project dogfooding
- Real onboarding journeys
- Real Task lifecycle journeys
- Real dashboard interaction
- Real fresh-session resume
- Real provider invocation
- Real failure and recovery journeys

### 20.2 Products Built With Superdev

Products built using Superdev must have product tests derived from their accepted test plans.

Depending on the product, this can include:

- Unit tests
- Integration tests
- API contract tests
- Database migration tests
- Browser journeys
- Accessibility checks
- Security checks
- Performance checks
- Recovery tests
- Deployment checks

Superdev must use the product’s accepted testing strategy rather than enforcing one universal test style.

---

## 21. Non-Functional Requirements

### NFR-001: Local Availability

Core planning, tracking, documentation, memory, and dashboard functionality must work without cloud access.

### NFR-002: Performance

Common status, Task, Feature, and workflow reads should feel immediate on a normal development machine.

### NFR-003: Token Efficiency

The agent must retrieve targeted records instead of loading the entire project database or full documentation set into context.

### NFR-004: Resumability

A fresh agent session must reconstruct the active working state without relying on the previous conversation.

### NFR-005: Auditability

Material changes, decisions, state transitions, and evidence must be traceable.

### NFR-006: Accessibility

The control center must meet accepted accessibility requirements for navigation, focus, contrast, labels, and reduced motion.

### NFR-007: Portability

The local database must support backup, restore, export, and import.

### NFR-008: Failure Honesty

Unavailable providers, stale documentation, unsupported hooks, missing credentials, and unverified remote behavior must be reported truthfully.

### NFR-009: Data Minimization

Superdev must store the smallest amount of information needed to guide and audit product development.

### NFR-010: Repository Cleanliness

Runtime state, generated caches, backups, and event streams must not pollute the Git repository.

---

## 22. Acceptance Criteria

Superdev is ready for a stable local release when all of the following are true:

1. A non-technical user can initialize a product through plain-language questions.
2. Initialization covers product, modules, features, workflows, architecture, technology, schemas, APIs, integrations, quality, and deployment.
3. The owner can review and accept the complete product map before implementation.
4. The Docs skill remains unchanged.
5. Accepted product information is represented in both the database and Docs skill projections without divergence.
6. Every implementation Task belongs to a Feature.
7. Every implementation Task links to an accepted contract.
8. A Task cannot complete without required evidence.
9. Feature, Milestone, Goal, and Product progress are derived honestly.
10. A fresh session can resume from the database.
11. The agent warns when a request conflicts with a previous Decision.
12. The control center reads live database state.
13. The control center explains product status in ordinary language.
14. Every primary product object is reachable through drill-down navigation.
15. The interactive Blueprint supports pan, zoom, drag, highlighting, search, fullscreen, and record navigation.
16. Missing providers are reported and never silently replaced.
17. No provider is installed without explicit consent.
18. The local memory system supports structured capture, progressive retrieval, provenance, and verification.
19. Memory does not override specifications, Decisions, code, or evidence.
20. The project repository contains only meaningful Docs skill artifacts, not per-event tracking files.
21. Superdev-generated content contains no emojis or em dashes.
22. Public repository scans contain no private project identifiers or secrets.
23. The local plugin works without Superdev Cloud.
24. The plugin guides products to implement their accepted test plans.
25. A real project can be planned, implemented, verified, documented, paused, and resumed using Superdev.

---

## 23. Open Architecture Decisions

The following decisions remain intentionally open:

### DEC-TBD-001: Final Memory Architecture

Decide whether long-term memory remains entirely database-backed or includes a compiled knowledge layer inspired by the Karpathy LLM Wiki.

### DEC-TBD-002: Claude Mem Replacement Gate

Define the benchmark and capability threshold required before Claude Mem can be removed as a transitional provider.

### DEC-TBD-003: Embedding Provider

Choose whether embeddings are:

- Disabled
- Local
- Cloud-hosted
- User-selectable

### DEC-TBD-004: Vector Storage

Choose between:

- Bounded local scan
- Local vector-capable database
- Remote vector service
- Hybrid storage

### DEC-TBD-005: Memory Retention

Define:

- Short-term retention
- Long-term promotion
- Forgetting
- Archival
- User deletion
- Team retention

### DEC-TBD-006: Cloud Synchronization

Define:

- Local-first merge policy
- Conflict resolution
- Assignment leases
- Realtime transport
- Offline queue
- Access control
- Branch awareness
- Multi-agent convergence

### DEC-TBD-007: Shared Team Memory

Define what information can be shared between developers, agents, projects, and organizations.

### DEC-TBD-008: Remote Encryption

Define encryption, key ownership, backup, and recovery for cloud-synchronized project state.

These decisions must be completed before the corresponding features are accepted. They must not block the local product-planning and execution core.

---

## 24. Recommended Delivery Order

### Phase 1: Product Model and Docs Foundation

- Preserve the existing Docs skill.
- Finalize the product object model.
- Finalize database schema and migrations.
- Implement database-to-Docs projection.
- Remove redundant file-based tracking.

### Phase 2: Initialization and Adoption

- Build the complete initialization interview.
- Build existing-project adoption.
- Build architecture and production-readiness discovery.
- Build owner review and acceptance.

### Phase 3: Task and Execution Control

- Derive Tasks from accepted contracts.
- Implement Task lifecycle.
- Implement assignments, sessions, branches, dependencies, and evidence.
- Implement decision conflict checks.

### Phase 4: Local Control Center

- Build live database service.
- Build Overview and product navigation.
- Build Feature, Workflow, Task, API, Schema, Decision, and Change drill-downs.
- Build Task management.
- Build the interactive Blueprint.

### Phase 5: Memory

- Stabilize structured local memory.
- Add consolidation and verification.
- Benchmark lexical and structured retrieval.
- Evaluate Karpathy-inspired compiled knowledge.
- Evaluate embeddings only if benchmarks justify them.
- Decide Claude Mem replacement readiness.

### Phase 6: Provider Orchestration

- Validate specialist provider routing.
- Validate provider attribution.
- Validate missing-provider behavior.
- Validate explicit installation consent.

### Phase 7: Real Project Dogfooding

- Initialize a real product using Superdev.
- Build it through Superdev Tasks.
- Record shortcomings as product improvements.
- Verify pause, resume, handoff, and recovery.
- Remove any process that does not improve real product delivery.

### Phase 8: Cloud Preparation

- Define the synchronization protocol.
- Define conflict resolution.
- Define team presence and assignment leases.
- Define remote memory and access control.
- Integrate with Superdev Cloud only after the local model is stable.

---

## 25. Definition of Done

Superdev is complete for the local plugin scope when it operates as a coherent product-building control system rather than a collection of unrelated skills.

A user must be able to:

1. Install Superdev.
2. Run `superdev init` or `superdev adopt`.
3. Answer a structured but understandable discovery interview.
4. Review a complete product map.
5. Approve the plan.
6. Receive Docs skill artifacts and a matching project database.
7. Open a live control center.
8. See Goals, Milestones, Modules, Features, Workflows, Tasks, APIs, Schemas, Decisions, Changes, and evidence.
9. Allow an agent to implement accepted Tasks.
10. Track the active developer, agent, branch, and Task.
11. Verify completed work.
12. Understand what remains.
13. Resume from a fresh session.
14. Receive a warning when new work conflicts with an earlier Decision.
15. Preserve useful short-term and long-term project memory.
16. Continue building without depending on Superdev Cloud.

The final result should help a person build a production-quality product with an AI agent while remaining fully aware of what is being built, why it is being built, what has changed, and what happens next.
