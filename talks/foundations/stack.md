<!-- superdev:generated source=PRJ-0001 revision=3058 hash=4875d904151f8eea6017b60ee74d9c8c1d5ab4ccb5023f80a3886e74bb58cea2 -->
# Superdev - Foundations: Stack

- **Status:** Active
- **Last verified:** see the generation marker at the top of this file.

Capability slots are filled by evidence or an accepted decision only. An empty slot is a question, never an assumption.

## Capability slots

| Capability | Choice | State | Evidence / decision |
|---|---|---|---|
| Language and runtime | Node.js with ECMAScript modules, no build step for the engine | Specified | package.json engines, and every src file is .mjs |
| Frontend framework | React 19 with TypeScript, compiled by Vite into one inlined HTML file | Specified | ui/package.json and scripts/package/build-ui.mjs |
| Navigation and routing | Hash routing inside the single page, with every area reachable from the rail | Specified | ui/src/components/shell/app-shell.tsx |
| Styling and design system | Tailwind v4 with semantic tokens over a shadcn foundation, light and dark | Specified | ui/src/index.css and ui/DESIGN_DIRECTION.md |
| Backend framework | The Node http module directly, with no framework | Specified | src/service/server.mjs |
| API style | Read routes returning JSON over the loopback interface, plus one mutation endpoint, same origin only | Specified | superdev api show |
| Authentication | N/A - There are no user accounts. The service binds to the loopback interface and refuses any request that is not same origin, so the only caller is a browser on the machine that started it. | Not Applicable | - |
| Database | Turso, the SQLite compatible engine, as one local file with a single writer | Specified | src/db/connect.mjs and docs/adr/0014-single-writer-concurrency-model.md |
| Migrations | Ordered SQL migrations applied forward only, with a checksum each and a backup before every run | Specified | src/db/migrations and superdev db status |
| File and object storage | N/A - The product stores records in a database and Markdown in the repository. It never accepts an upload or holds a binary. | Not Applicable | - |
| Search | An inverted lexical index over memory, and deterministic filters everywhere else | Specified | src/memory/index.mjs and superdev memory status |
| Realtime transport | Polling. The service reads the activity sequence every second and the page refetches when it moves | Specified | src/service/server.mjs |
| Background jobs | N/A - Nothing runs on a schedule. Every change happens because a command was run or a hook fired on a real event. | Not Applicable | - |
| Notifications and delivery | N/A - The product speaks through command output, the control centre and the session hooks. It sends no mail, no push and no message. | Not Applicable | - |
| Observability | Doctor, the deterministic validators, and an append only activity trail enforced by triggers | Specified | superdev doctor |
| Testing | Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires | Specified | node scripts/validate/validate-all.mjs and superdev test-plan list |
| Hosting and deployment | N/A - There is no infrastructure. The product is a plugin that runs on a developer machine, distributed as a Claude Code plugin, a Codex plugin and a skills bundle. | Not Applicable | - |
| Continuous integration | The validators, runnable from one command, with no hosted pipeline | Specified | node scripts/validate/validate-all.mjs |
| Secret management | envx owns any environment value. The product holds no credential of its own and refuses to store a secret shaped one | Specified | src/model/screening.mjs |
| Product analytics | N/A - Nothing is measured about the person using the product and nothing leaves the machine. | Not Applicable | - |

## Design direction

Tailwind v4 with semantic tokens over a shadcn foundation, light and dark
