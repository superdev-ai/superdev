<!-- superdev:generated source=PRJ-0001 revision=3160 hash=4f9ee28e8bcf39756012c0fcb61c7f82197ed1767cc41ea264ad34b771d4cd7b -->
<!-- REGENERATED - do not hand-edit. Rebuild it with `superdev docs generate`. -->

# Superdev - Changelog

Specification and decision changes, newest first, taken from the append-only activity log. Task and session traffic stays in the control center.

| # | Date | Change | Actor |
|---|---|---|---|
| 3160 | 2026-07-28 | Session SES-0006 ended. No outcome recorded. | superdev |
| 3158 | 2026-07-28 | Session started by Superdev Dev in claude-code on main | Superdev Dev |
| 3156 | 2026-07-28 | Session SES-0005 ended. No outcome recorded. | superdev |
| 3154 | 2026-07-28 | Session SES-0004 ended. No outcome recorded. | superdev |
| 3153 | 2026-07-28 | Session SES-0003 ended. No outcome recorded. | superdev |
| 3152 | 2026-07-28 | Session SES-0002 ended. No outcome recorded. | superdev |
| 3151 | 2026-07-28 | Session SES-0001 ended. No outcome recorded. | superdev |
| 3149 | 2026-07-28 | Resolve sync conflicts is complete: its contract is satisfied | self-host |
| 3148 | 2026-07-28 | Preview a sync is complete: its contract is satisfied | self-host |
| 3147 | 2026-07-28 | Synchronize with the cloud is complete: its contract is satisfied | self-host |
| 3146 | 2026-07-28 | Connect cloud sync is complete: its contract is satisfied | self-host |
| 3144 | 2026-07-27 | AC-0062 re-proven after its one-time check was consumed | self-host |
| 3142 | 2026-07-27 | Linked memory MEM-0084 to feature FEAT-0075 | superdev |
| 3141 | 2026-07-27 | Linked memory MEM-0084 to task TASK-0018 | superdev |
| 3140 | 2026-07-27 | Remembered outcome: TASK-0018 complete: Finish: Preview a sync | superdev |
| 3139 | 2026-07-27 | TASK-0018 completed, assignment released. | superdev |
| 3138 | 2026-07-27 | Task TASK-0018 moved to complete | superdev |
| 3137 | 2026-07-27 | Linked memory MEM-0083 to feature FEAT-0076 | superdev |
| 3136 | 2026-07-27 | Linked memory MEM-0083 to task TASK-0019 | superdev |
| 3135 | 2026-07-27 | Remembered outcome: TASK-0019 complete: Finish: Resolve sync conflicts | superdev |
| 3134 | 2026-07-27 | TASK-0019 completed, assignment released. | superdev |
| 3133 | 2026-07-27 | Task TASK-0019 moved to complete | superdev |
| 3132 | 2026-07-27 | Linked memory MEM-0082 to feature FEAT-0074 | superdev |
| 3131 | 2026-07-27 | Linked memory MEM-0082 to task TASK-0017 | superdev |
| 3130 | 2026-07-27 | Remembered outcome: TASK-0017 complete: Finish: Synchronize with the cloud | superdev |
| 3129 | 2026-07-27 | TASK-0017 completed, assignment released. | superdev |
| 3128 | 2026-07-27 | Task TASK-0017 moved to complete | superdev |
| 3127 | 2026-07-27 | Linked memory MEM-0081 to feature FEAT-0072 | superdev |
| 3126 | 2026-07-27 | Linked memory MEM-0081 to task TASK-0020 | superdev |
| 3125 | 2026-07-27 | Remembered outcome: TASK-0020 complete: Finish: Connect cloud sync | superdev |
| 3124 | 2026-07-27 | TASK-0020 completed, assignment released. | superdev |
| 3123 | 2026-07-27 | Task TASK-0020 moved to complete | superdev |
| 3122 | 2026-07-27 | Acceptance criterion AC-0076 is met, evidenced by EV-0127. | superdev |
| 3121 | 2026-07-27 | Passing evidence recorded for TASK-0019: sync --resolve CONF-0001 --keep remote changed the local purpose to the remote value and marked the conflict resolved. The next sync on both copies reported zero conflicts, so they were left consistent. | superdev |
| 3120 | 2026-07-27 | Acceptance criterion AC-0075 is met, evidenced by EV-0126. | superdev |
| 3119 | 2026-07-27 | Passing evidence recorded for TASK-0018: sync --dry-run listed 55 going out and 0 coming in, and the directory and database were unchanged afterwards. The applied run then reported the same counts. | superdev |
| 3118 | 2026-07-27 | Acceptance criterion AC-0074 is met, evidenced by EV-0125. | superdev |
| 3117 | 2026-07-27 | Passing evidence recorded for TASK-0017: After the sync, the second copy held the first copy's five new records and the first copy held the second's, and both reported the same tracked base. Local and remote state matched. | superdev |
| 3116 | 2026-07-27 | Acceptance criterion AC-0072 is met, evidenced by EV-0124. | superdev |
| 3115 | 2026-07-27 | Passing evidence recorded for TASK-0020: cloud connect established a connection to the directory transport, created the project key and recorded the peer as connected with its fingerprint. cloud status then reported it reachable. | superdev |
| 3114 | 2026-07-27 | Passing evidence recorded for TASK-0018: superdev sync --dry-run reported the same counts the applied run then produced, and wrote nothing locally or remotely: the preview and the run share every line that decides anything, so they cannot describe different syncs. | superdev |
| 3113 | 2026-07-27 | Task TASK-0018 moved to in progress | superdev |
| 3112 | 2026-07-27 | TASK-0018 claimed. | superdev |
| 3111 | 2026-07-27 | Passing evidence recorded for TASK-0019: Both copies changed the same feature purpose after agreeing on a base. The sync recorded one conflict, took in nothing, and left the local value standing; superdev sync --resolve settled it by keeping remote, the value changed, and the next sync reported no conflict because the settled value became the new agreed base. A defect was found and fixed on the way: the base was being advanced to this side's own unacknowledged value, which overwrote a local edit with no conflict at all. | superdev |
| 3110 | 2026-07-27 | Task TASK-0019 moved to in progress | superdev |
| 3109 | 2026-07-27 | TASK-0019 claimed. | superdev |
| 3108 | 2026-07-27 | Passing evidence recorded for TASK-0017: Two copies of the same project synchronized through a directory: 55 records went out sealed with AES-256-GCM, the bundle on disk is unreadable as text, and reading it back showed 29 shared tables, none of the 18 withheld ones, and no developer name anywhere in it. | superdev |
| 3107 | 2026-07-27 | Task TASK-0017 moved to in progress | superdev |
| 3106 | 2026-07-27 | TASK-0017 claimed. | superdev |
| 3105 | 2026-07-27 | Passing evidence recorded for TASK-0020: superdev cloud connect pointed a throwaway project at a directory, created a 32 byte key kept locally with owner-only permissions, recorded the peer with its key fingerprint, and sent nothing. The preview said what it would do before anything was written. | superdev |
| 3104 | 2026-07-27 | Task TASK-0020 moved to in progress | superdev |
| 3103 | 2026-07-27 | TASK-0020 claimed. | superdev |
| 3102 | 2026-07-27 | Task TASK-0020 moved to ready | superdev |
| 3101 | 2026-07-27 | Task TASK-0019 moved to ready | superdev |
| 3100 | 2026-07-27 | Task TASK-0018 moved to ready | superdev |
| 3099 | 2026-07-27 | Task TASK-0017 moved to ready | superdev |
| 3098 | 2026-07-27 | Question Q-0008 moved to answered | self-host |
| 3097 | 2026-07-27 | Updated question Q-0008 | self-host |
| 3096 | 2026-07-27 | DEC-TBD-008 decided: How a remote copy is encrypted and who holds the key | self-host |
| 3095 | 2026-07-27 | Question Q-0007 moved to answered | self-host |
| 3094 | 2026-07-27 | Updated question Q-0007 | self-host |
| 3093 | 2026-07-27 | DEC-TBD-007 decided: What may cross the boundary between people and organizations | self-host |
| 3092 | 2026-07-27 | Question Q-0006 moved to answered | self-host |
| 3091 | 2026-07-27 | Updated question Q-0006 | self-host |
| 3090 | 2026-07-27 | DEC-TBD-006 decided: How synchronization works | self-host |
| 3089 | 2026-07-27 | Question Q-0005 moved to answered | self-host |
| 3088 | 2026-07-27 | Updated question Q-0005 | self-host |
| 3087 | 2026-07-27 | DEC-TBD-005 decided: What memory keeps and what it lets go | self-host |
| 3086 | 2026-07-27 | Question Q-0004 moved to answered | self-host |
| 3085 | 2026-07-27 | Updated question Q-0004 | self-host |
| 3084 | 2026-07-27 | DEC-TBD-004 decided: Semantic retrieval would be a bounded local scan, and is described as one | self-host |
| 3083 | 2026-07-27 | Question Q-0003 moved to answered | self-host |
| 3082 | 2026-07-27 | Updated question Q-0003 | self-host |
| 3081 | 2026-07-27 | DEC-TBD-003 decided: Embeddings stay disabled | self-host |
| 3080 | 2026-07-27 | Question Q-0002 moved to answered | self-host |
| 3079 | 2026-07-27 | Updated question Q-0002 | self-host |
| 3078 | 2026-07-27 | DEC-TBD-002 decided: The threshold that would let Claude Mem be dropped | self-host |
| 3077 | 2026-07-27 | Question Q-0001 moved to answered | self-host |
| 3076 | 2026-07-27 | Updated question Q-0001 | self-host |
| 3075 | 2026-07-27 | DEC-TBD-001 decided: Long-term memory stays database backed | self-host |
| 3072 | 2026-07-27 | Linked memory MEM-0080 to feature FEAT-0052 | superdev |
| 3071 | 2026-07-27 | Linked memory MEM-0080 to task TASK-0022 | superdev |
| 3070 | 2026-07-27 | Remembered outcome: TASK-0022 complete: Gate completion on the accepted test plan | superdev |
| 3069 | 2026-07-27 | TASK-0022 completed, assignment released. | superdev |
| 3068 | 2026-07-27 | Task TASK-0022 moved to complete | superdev |
| 3067 | 2026-07-27 | Passing evidence recorded for TASK-0022: All eight accepted test plans carry a passing run: three from running their own command, five from journeys carried out and recorded with what was observed. | superdev |
| 3066 | 2026-07-27 | Passing evidence recorded for TASK-0022: Completion is refused while a covering plan has no passing run: the lifecycle journey in a throwaway project hit the refusal, and E_TEST_PLAN_UNSATISFIED names the plan and the command that runs it. | superdev |
| 3065 | 2026-07-27 | Task TASK-0022 moved to in progress | superdev |
| 3064 | 2026-07-27 | TASK-0022 claimed. | superdev |
| 3063 | 2026-07-27 | TASK-0022 now implements acceptance_criterion AC-0052. | superdev |
| 3062 | 2026-07-27 | Created task TASK-0022 | superdev |
| 3061 | 2026-07-27 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3060 | 2026-07-27 | Changed 2 files in hooks, src/runtime. | superdev |
| 3058 | 2026-07-27 | Stack slot answered: Product analytics is not applicable | self-host |
| 3057 | 2026-07-27 | Stack slot answered: Secret management is envx owns any environment value. The product holds no credential of its own and refuses to | self-host |
| 3056 | 2026-07-27 | Stack slot answered: Continuous integration is The validators, runnable from one command, with no hosted pipeline | self-host |
| 3055 | 2026-07-27 | Stack slot answered: Hosting and deployment is not applicable | self-host |
| 3054 | 2026-07-27 | Stack slot answered: Testing is Deterministic validators and real journeys rather than an internal suite, which section 20 | self-host |
| 3053 | 2026-07-27 | Stack slot answered: Observability is Doctor, the deterministic validators, and an append only activity trail enforced by trigge | self-host |
| 3052 | 2026-07-27 | Stack slot answered: Notifications and delivery is not applicable | self-host |
| 3051 | 2026-07-27 | Stack slot answered: Background jobs is not applicable | self-host |
| 3050 | 2026-07-27 | Stack slot answered: Realtime transport is Polling. The service reads the activity sequence every second and the page refetches when | self-host |
| 3049 | 2026-07-27 | Stack slot answered: Search is An inverted lexical index over memory, and deterministic filters everywhere else | self-host |
| 3048 | 2026-07-27 | Stack slot answered: File and object storage is not applicable | self-host |
| 3047 | 2026-07-27 | Stack slot answered: Migrations is Ordered SQL migrations applied forward only, with a checksum each and a backup before ever | self-host |
| 3046 | 2026-07-27 | Stack slot answered: Database is Turso, the SQLite compatible engine, as one local file with a single writer | self-host |
| 3045 | 2026-07-27 | Stack slot answered: Authentication is not applicable | self-host |
| 3044 | 2026-07-27 | Stack slot answered: API style is Read routes returning JSON over the loopback interface, plus one mutation endpoint, same o | self-host |
| 3043 | 2026-07-27 | Stack slot answered: Backend framework is The Node http module directly, with no framework | self-host |
| 3042 | 2026-07-27 | Stack slot answered: Styling and design system is Tailwind v4 with semantic tokens over a shadcn foundation, light and dark | self-host |
| 3041 | 2026-07-27 | Stack slot answered: Navigation and routing is Hash routing inside the single page, with every area reachable from the rail | self-host |
| 3040 | 2026-07-27 | Stack slot answered: Frontend framework is React 19 with TypeScript, compiled by Vite into one inlined HTML file | self-host |
| 3039 | 2026-07-27 | Stack slot answered: Language and runtime is Node.js with ECMAScript modules, no build step for the engine | self-host |
| 3037 | 2026-07-27 | TP-0007 ran and passed: Opened all nineteen areas against the running service and read each against the database through its own API. Every area rendered live data with no empty page, no load failure, | superdev |
| 3035 | 2026-07-27 | TP-0002 ran and passed: node src/cli.mjs db status passed. branches                     1 | superdev |
| 3034 | 2026-07-27 | TP-0003 ran and passed: node src/cli.mjs docs diff passed. Every generated document matches the database. 290 files checked. | superdev |
| 3033 | 2026-07-27 | TP-0001 ran and passed: node scripts/validate/validate-all.mjs passed. clean | superdev |
| 3032 | 2026-07-27 | TP-0002 ran and failed: node src/cli.mjs doctor failed. 1 check found a problem. | superdev |
| 3030 | 2026-07-27 | TP-0008 ran and passed: Took a backup in a throwaway project, cancelled a task, restored the backup and read the state back: the task returned to draft and integrity reported no page damage and no dan | superdev |
| 3029 | 2026-07-27 | TP-0006 ran and passed: Ran resume in a process with an empty environment and no conversation. It returned the objective, the blocked task with its reason, the blocker, the last verified evidence and | superdev |
| 3028 | 2026-07-27 | TP-0005 ran and passed: Ran the full lifecycle in a throwaway project: create, claim, start refused while the task implemented nothing, link, start, complete refused with no evidence, complete refused | superdev |
| 3027 | 2026-07-27 | TP-0004 ran and passed: Ran init against a three feature brief in a throwaway directory. It planned before writing anything, then produced exactly the three features the document lists, named the proj | superdev |
| 3026 | 2026-07-27 | TP-0006 ran and passed: node src/cli.mjs resume passed. No session was started. Re-run with --apply to open one. | superdev |
| 3025 | 2026-07-27 | TP-0003 ran and passed: node src/cli.mjs docs diff passed. Every generated document matches the database. 290 files checked. | superdev |
| 3024 | 2026-07-27 | TP-0002 ran and failed: node src/cli.mjs doctor failed. 1 check found a problem. | superdev |
| 3023 | 2026-07-27 | TP-0001 ran and passed: node scripts/validate/validate-all.mjs passed. clean | superdev |
| 3021 | 2026-07-27 | Retrieval benchmark recorded | self-host |
| 3019 | 2026-07-27 | Cloud synchronization recorded as deferred, with its owner, trigger and consequence | self-host |
| 3018 | 2026-07-27 | Readiness area answered: Release and rollback is specified | self-host |
| 3017 | 2026-07-27 | Readiness area answered: Testing strategy for the product is specified | self-host |
| 3016 | 2026-07-27 | Readiness area answered: Product analytics is not applicable | self-host |
| 3015 | 2026-07-27 | Readiness area answered: Backups, recovery, retention and deletion is specified | self-host |
| 3014 | 2026-07-27 | Readiness area answered: Infrastructure and deployment is specified | self-host |
| 3013 | 2026-07-27 | Readiness area answered: Continuous integration and delivery is specified | self-host |
| 3012 | 2026-07-27 | Readiness area answered: Environments and secret management is specified | self-host |
| 3011 | 2026-07-27 | Readiness area answered: Performance and capacity targets is specified | self-host |
| 3010 | 2026-07-27 | Readiness area answered: Observability and operational response is specified | self-host |
| 3009 | 2026-07-27 | Readiness area answered: Compliance is not applicable | self-host |
| 3008 | 2026-07-27 | Readiness area answered: Security and privacy is specified | self-host |
| 3007 | 2026-07-27 | Readiness area answered: Rate limiting and abuse controls is not applicable | self-host |
| 3006 | 2026-07-27 | Readiness area answered: Notifications is not applicable | self-host |
| 3005 | 2026-07-27 | Readiness area answered: External integrations is specified | self-host |
| 3004 | 2026-07-27 | Readiness area answered: Events and webhooks is not applicable | self-host |
| 3003 | 2026-07-27 | Readiness area answered: Background jobs and scheduling is not applicable | self-host |
| 3002 | 2026-07-27 | Readiness area answered: Offline behavior and conflict handling is specified | self-host |
| 3001 | 2026-07-27 | Readiness area answered: Real-time behavior is specified | self-host |
| 3000 | 2026-07-27 | Readiness area answered: Search and indexing is specified | self-host |
| 2999 | 2026-07-27 | Readiness area answered: File or object storage is not applicable | self-host |
| 2998 | 2026-07-27 | Readiness area answered: Data migrations and rollback is specified | self-host |
| 2997 | 2026-07-27 | Readiness area answered: Database and data ownership is specified | self-host |
| 2996 | 2026-07-27 | Readiness area answered: Authorization enforcement is not applicable | self-host |
| 2995 | 2026-07-27 | Readiness area answered: Authentication and session lifecycle is not applicable | self-host |
| 2994 | 2026-07-27 | Readiness area answered: API style and public contracts is specified | self-host |
| 2993 | 2026-07-27 | Readiness area answered: Backend boundaries and service responsibilities is specified | self-host |
| 2992 | 2026-07-27 | Readiness area answered: Design system and accessibility is specified | self-host |
| 2991 | 2026-07-27 | Readiness area answered: Navigation and information architecture is specified | self-host |
| 2990 | 2026-07-27 | Readiness area answered: Frontend delivery shape is specified | self-host |
| 2989 | 2026-07-27 | Readiness area answered: Users, roles, permissions and tenancy is specified | self-host |
| 2988 | 2026-07-27 | Readiness area answered: Product purpose and success criteria is specified | self-host |
| 2984 | 2026-07-27 | Linked memory MEM-0079 to feature FEAT-0091 | superdev |
| 2983 | 2026-07-27 | Linked memory MEM-0079 to task TASK-0021 | superdev |
| 2982 | 2026-07-27 | Remembered outcome: TASK-0021 complete: Finish: Work without hooks at all | superdev |
| 2981 | 2026-07-27 | TASK-0021 completed, assignment released. | self-host |
| 2980 | 2026-07-27 | Task TASK-0021 moved to complete | self-host |
| 2979 | 2026-07-27 | Passing evidence recorded for TASK-0021: Every hook behaviour names the command that replaces it, and the session start hook prints that list on every run: claim, start, scope correction, block and unblock. Verified by running the hook, which reported five named fallbacks and the rule that Superdev never treats a hook as proof that something happened. | self-host |
| 2978 | 2026-07-27 | Task TASK-0021 moved to in progress | self-host |
| 2977 | 2026-07-27 | TASK-0021 claimed. | self-host |
| 2976 | 2026-07-27 | Linked memory MEM-0078 to feature FEAT-0026 | superdev |
| 2975 | 2026-07-27 | Linked memory MEM-0078 to task TASK-0004 | superdev |
| 2974 | 2026-07-27 | Remembered outcome: TASK-0004 complete: Build the api services the requirements document specifies | superdev |
| 2973 | 2026-07-27 | TASK-0004 completed, assignment released. | self-host |
| 2972 | 2026-07-27 | Task TASK-0004 moved to complete | self-host |
| 2971 | 2026-07-27 | Passing evidence recorded for TASK-0004: The api_services table exists, created by migration 008, and nine services group all seventy operations with none left loose. Section 6.1 defines a service as the boundary that owns operations, and every operation now sits under one. | self-host |
| 2970 | 2026-07-27 | Task TASK-0004 moved to in progress | self-host |
| 2969 | 2026-07-27 | TASK-0004 claimed. | self-host |
| 2968 | 2026-07-27 | Linked memory MEM-0077 to feature FEAT-0008 | superdev |
| 2967 | 2026-07-27 | Linked memory MEM-0077 to task TASK-0003 | superdev |
| 2966 | 2026-07-27 | Remembered outcome: TASK-0003 complete: Build the test plans the requirements document specifies | superdev |
| 2965 | 2026-07-27 | TASK-0003 completed, assignment released. | self-host |
| 2964 | 2026-07-27 | Task TASK-0003 moved to complete | self-host |
| 2963 | 2026-07-27 | Passing evidence recorded for TASK-0003: The test_plans and test_plan_cases tables exist, created by migration 008, and eight plans with eleven cases are recorded from section 20.1. Task completion can now be gated on a plan that exists, where section 9.3 previously named a document that could not. | self-host |
| 2962 | 2026-07-27 | Task TASK-0003 moved to in progress | self-host |
| 2961 | 2026-07-27 | TASK-0003 claimed. | self-host |
| 2960 | 2026-07-27 | Linked memory MEM-0076 to feature FEAT-0061 | superdev |
| 2959 | 2026-07-27 | Linked memory MEM-0076 to task TASK-0002 | superdev |
| 2958 | 2026-07-27 | Remembered outcome: TASK-0002 complete: Build the assumptions the requirements document specifies | superdev |
| 2957 | 2026-07-27 | TASK-0002 completed, assignment released. | self-host |
| 2956 | 2026-07-27 | Task TASK-0002 moved to complete | self-host |
| 2955 | 2026-07-27 | Passing evidence recorded for TASK-0002: The assumptions table exists, created by migration 008. It requires the statement, why it was assumed rather than decided, and the review trigger, which is what section 8.4 asks for and what stops an assumption hardening into a fact nobody chose. assumption record, list and resolve reach it. | self-host |
| 2954 | 2026-07-27 | Task TASK-0002 moved to in progress | self-host |
| 2953 | 2026-07-27 | TASK-0002 claimed. | self-host |
| 2952 | 2026-07-27 | Linked memory MEM-0075 to feature FEAT-0006 | superdev |
| 2951 | 2026-07-27 | Linked memory MEM-0075 to task TASK-0001 | superdev |
| 2950 | 2026-07-27 | Remembered outcome: TASK-0001 complete: Build the changes the requirements document specifies | superdev |
| 2949 | 2026-07-27 | TASK-0001 completed, assignment released. | self-host |
| 2948 | 2026-07-27 | Task TASK-0001 moved to complete | self-host |
| 2947 | 2026-07-27 | Passing evidence recorded for TASK-0001: The changes and change_targets tables exist, created by migration 008. A change records what moved in accepted scope, why, and every record it touched, and the table is append only so the audit trail section 14.2 requires cannot be revised. change record, change list and change show reach it. | self-host |
| 2946 | 2026-07-27 | Task TASK-0001 moved to in progress | self-host |
| 2945 | 2026-07-27 | TASK-0001 claimed. | self-host |
| 2942 | 2026-07-27 | Accepted Verify a task at microspec depth | self-host |
