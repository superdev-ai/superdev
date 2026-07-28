<!-- superdev:generated source=PRJ-0001 revision=1255 hash=9732ddcd7527fa35b5e80f7bf8862369b1c96015287ec150a4da48bcb0339b34 -->
# Superdev - Architecture

- **Status:** Active
- **Last verified:** see the generation marker at the top of this file.

## Shape

A product building operating system for AI agents and the people working with them. It turns an idea or an existing codebase into a structured product model, then uses that model to guide planning, implementation, verification and handoff, so that nobody is ever building unmapped work.

## System context

```mermaid
graph LR
  n_Non_technical_founder["Non-technical founder"] --> n_Superdev
  n_Product_owner["Product owner"] --> n_Superdev
  n_Developer["Developer"] --> n_Superdev
  n_Engineering_lead["Engineering lead"] --> n_Superdev
  n_Designer["Designer"] --> n_Superdev
  n_AI_assisted_development_team["AI-assisted development team"] --> n_Superdev
  n_Solo_developer_using_coding_agents["Solo developer using coding agents"] --> n_Superdev
  n_Claude_Code["Claude Code"] --> n_Superdev
  n_Codex["Codex"] --> n_Superdev
  n_skills_sh_compatible_agent["skills.sh-compatible agent"] --> n_Superdev
  n_Future_supported_coding_agent_environment["Future supported coding-agent environment"] --> n_Superdev
  n_Superdev["Superdev"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
  n_Superdev --> n_ext_External_installed_separately["External, installed separately"]
```

*Claim: 11 recorded roles reach the product, which depends on 13 recorded external integrations.*

## Runtime pieces

| Piece | Runs where | Talks to | Evidence |
|---|---|---|---|
| Command line interface | The developer machine, invoked per command and exits | Project database (direct file access, one transaction per write), Migration runner (in process call), Documentation projector (in process call) | src/cli.mjs |
| Local service | The developer machine, a long lived process on a bound port | Project database (direct file access, readonly connections only) | src/service/server.mjs |
| Control centre | The browser, served by the local service as one inlined page | Local service (HTTP on the loopback interface, same origin only) | src/service/assets/control-center.html |
| Project database | The project directory, one file opened per read or write and never pooled | nothing recorded | src/db/connect.mjs |
| Migration runner | The developer machine, before any other database access | Project database (direct file access, exclusive) | src/db/migrate.mjs |
| Documentation projector | The developer machine, writing Markdown from the database | Project database (direct file access, readonly) | src/docs/render.mjs |
| Skills | The agent harness, read as instructions rather than executed | nothing recorded | skills/ |
| Session hooks | The agent harness, on session and tool events, with a command fallback for each | Command line interface (process invocation) | src/runtime/hooks.mjs |
| Deterministic validators | The developer machine, on demand and in review | Project database (direct file access, readonly) | scripts/validate/ |

## Module map

```mermaid
graph TD
  n_discovery_and_onboarding["Discovery and Onboarding"]
  n_product_model_and_orchestration["Product Model and Orchestration"]
  n_documentation_generation_and_sync["Documentation Generation and Sync"]
  n_task_and_implementation_lifecycle["Task and Implementation Lifecycle"]
  n_decisions_changes_and_questions["Decisions, Changes, and Questions"]
  n_database_and_persistence["Database and Persistence"]
  n_memory_system["Memory System"]
  n_hooks_and_session_continuity["Hooks and Session Continuity"]
  n_local_control_center["Local Control Center"]
  n_provider_orchestration["Provider Orchestration"]
  n_packaging_and_distribution["Packaging and Distribution"]
```

*Claim: No module declares a dependency on another.*

## Data ownership

| Entity group | Owning module | Consumers |
|---|---|---|
| api_operations, api_services, changes, data_fields, data_relationships, feature_acceptance_criteria, features, goals, jobs, milestones, modules, non_functional_requirements, permissions, projects, roles, test_plans, webhooks, workflow_steps, workflows | Product Model and Orchestration | none |
| documents | Documentation Generation and Sync | none |
| agents, branches, developers, integrations, task_assignments, task_contract_links, task_dependencies, tasks, verification_evidence | Task and Implementation Lifecycle | none |
| applied_migrations, assumptions, decisions, questions | Decisions, Changes, and Questions | none |
| data_entities | Database and Persistence | none |
| memory_embeddings, memory_entries, memory_links, memory_search_terms | Memory System | none |
| activity_events, decision_transitions, work_sessions | Hooks and Session Continuity | none |
| surfaces, ui_actions | Local Control Center | none |

## Critical path

```mermaid
sequenceDiagram
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Inspect the environment: repository structure, existing documentation, package m
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Inspect capability: check whether the relevant specialist providers are installe
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Run the product foundation interview: establish name, description, problem, targ
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Run module discovery for every proposed module
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Run feature discovery for every feature
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Run workflow discovery for every workflow
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Run the architecture and technology interview, presenting each technology choice
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Run the production readiness review, marking every applicable area as specified,
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Present the product map: summary, goals, milestones, modules, features, workflow
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: After acceptance, create the project database, run versioned migrations, store t
  n_Superdev_working_with_the_product_owner->>n_Superdev_working_with_the_product_owner: Confirm implementation can begin: product foundation accepted, the feature accep
```

*Claim: The Onboarding Journey workflow, step by step.*

## Boundaries and constraints

- No boundaries recorded.
