<!-- superdev:generated source=PRJ-0001 revision=3365 hash=14f95ed35583e0c2226e947afc2e155fa52ceb06bfb509e7afb79d56566c0fc8 -->
<!-- REGENERATED - do not hand-edit. Rebuild it with `superdev docs generate`. -->

# Superdev - Changelog

Specification and decision changes, newest first, taken from the append-only activity log. Task and session traffic stays in the control center.

| # | Date | Change | Actor |
|---|---|---|---|
| 3365 | 2026-07-28 | Change recorded: A verification script is judged by containment, and an active task always has an owner | superdev |
| 3364 | 2026-07-28 | Linked memory MEM-0099 to feature FEAT-0088 | superdev |
| 3363 | 2026-07-28 | Linked memory MEM-0099 to task TASK-0031 | superdev |
| 3362 | 2026-07-28 | Remembered outcome: TASK-0031 complete: Judge a verification script by whether it is inside the proj | superdev |
| 3361 | 2026-07-28 | TASK-0031 completed, assignment released. | superdev |
| 3360 | 2026-07-28 | Task TASK-0031 moved to complete | superdev |
| 3359 | 2026-07-28 | Passing evidence recorded for TASK-0031: verify now accepts a script anywhere inside the project, and refuses everything that leaves it | superdev |
| 3358 | 2026-07-28 | Task TASK-0031 moved to in progress | superdev |
| 3357 | 2026-07-28 | TASK-0031 claimed. | superdev |
| 3356 | 2026-07-28 | TASK-0031 now implements acceptance_criterion AC-0088. | superdev |
| 3355 | 2026-07-28 | Created task TASK-0031 | superdev |
| 3354 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3353 | 2026-07-28 | Linked memory MEM-0098 to feature FEAT-0088 | superdev |
| 3352 | 2026-07-28 | Linked memory MEM-0098 to task TASK-0030 | superdev |
| 3351 | 2026-07-28 | Remembered outcome: TASK-0030 complete: Never leave a task in an active status that no session owns | superdev |
| 3350 | 2026-07-28 | TASK-0030 completed, assignment released. | superdev |
| 3349 | 2026-07-28 | Task TASK-0030 moved to complete | superdev |
| 3348 | 2026-07-28 | Passing evidence recorded for TASK-0030: A task can no longer be in an active status that no session owns, by either route in | superdev |
| 3347 | 2026-07-28 | Changed 6 files in src/runtime, talks/changes, talks/modules/hooks-and-session-continuity/features and 2 more places. | superdev |
| 3346 | 2026-07-28 | Task TASK-0030 moved to in progress | superdev |
| 3345 | 2026-07-28 | TASK-0030 claimed. | superdev |
| 3344 | 2026-07-28 | TASK-0030 now implements acceptance_criterion AC-0088. | superdev |
| 3343 | 2026-07-28 | Created task TASK-0030 | superdev |
| 3341 | 2026-07-28 | Change recorded: Work is untracked only when it is newly changed, not when git keeps reporting an old edit | superdev |
| 3340 | 2026-07-28 | Linked memory MEM-0097 to feature FEAT-0088 | superdev |
| 3339 | 2026-07-28 | Linked memory MEM-0097 to task TASK-0029 | superdev |
| 3338 | 2026-07-28 | Remembered outcome: TASK-0029 complete: Only call work untracked when it is newly changed, not when | superdev |
| 3337 | 2026-07-28 | TASK-0029 completed, assignment released. | superdev |
| 3336 | 2026-07-28 | Task TASK-0029 moved to complete | superdev |
| 3335 | 2026-07-28 | Passing evidence recorded for TASK-0029: Work already accounted for is no longer reported as untracked when git re-reports it | superdev |
| 3334 | 2026-07-28 | Changed 7 files in src, src/service, talks/changes and 3 more places. | superdev |
| 3333 | 2026-07-28 | Task TASK-0029 moved to in progress | superdev |
| 3332 | 2026-07-28 | TASK-0029 claimed. | superdev |
| 3331 | 2026-07-28 | TASK-0029 now implements acceptance_criterion AC-0088. | superdev |
| 3330 | 2026-07-28 | Created task TASK-0029 | superdev |
| 3329 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3328 | 2026-07-28 | Changed 6 files in src, src/service, talks/changes and 2 more places. | superdev |
| 3326 | 2026-07-28 | Change recorded: A busy port says whose it is, and stops claiming the reader is blocked when they are not | superdev |
| 3325 | 2026-07-28 | Linked memory MEM-0096 to feature FEAT-0016 | superdev |
| 3324 | 2026-07-28 | Linked memory MEM-0096 to task TASK-0028 | superdev |
| 3323 | 2026-07-28 | Remembered outcome: TASK-0028 complete: Make the port refusal actionable: say which project holds it | superdev |
| 3322 | 2026-07-28 | TASK-0028 completed, assignment released. | superdev |
| 3321 | 2026-07-28 | Task TASK-0028 moved to complete | superdev |
| 3320 | 2026-07-28 | Passing evidence recorded for TASK-0028: The port flag exists on both start and ui, and refuses what is not a port | superdev |
| 3319 | 2026-07-28 | Passing evidence recorded for TASK-0028: A held port now names its holder, start takes a port, and the two messages that were wrong are right | superdev |
| 3318 | 2026-07-28 | Changed 22 files in src, src/init, src/product and 14 more places. | superdev |
| 3317 | 2026-07-28 | Task TASK-0028 moved to in progress | superdev |
| 3316 | 2026-07-28 | TASK-0028 claimed. | superdev |
| 3315 | 2026-07-28 | TASK-0028 now implements acceptance_criterion AC-0016. | superdev |
| 3314 | 2026-07-28 | Created task TASK-0028 | superdev |
| 3312 | 2026-07-28 | Change recorded: A claim points the session at its task, so the record stops accusing tracked work of being untracked | superdev |
| 3311 | 2026-07-28 | Linked memory MEM-0095 to feature FEAT-0088 | superdev |
| 3310 | 2026-07-28 | Linked memory MEM-0095 to task TASK-0027 | superdev |
| 3309 | 2026-07-28 | Remembered outcome: TASK-0027 complete: Point the session at the task it claimed, so tracked work st | superdev |
| 3308 | 2026-07-28 | TASK-0027 completed, assignment released. | superdev |
| 3307 | 2026-07-28 | Task TASK-0027 moved to complete | superdev |
| 3306 | 2026-07-28 | Task TASK-0027 moved to in progress | superdev |
| 3305 | 2026-07-28 | TASK-0027 now implements acceptance_criterion AC-0088. | superdev |
| 3304 | 2026-07-28 | Passing evidence recorded for TASK-0027: Claiming a task now points the session at it, so work under a claim stops being reported as untracked | superdev |
| 3303 | 2026-07-28 | Changed 19 files in src, src/init, src/product and 12 more places. | superdev |
| 3302 | 2026-07-28 | TASK-0027 claimed. | superdev |
| 3301 | 2026-07-28 | Created task TASK-0027 | superdev |
| 3300 | 2026-07-28 | Changed 18 files in ui/src/views, src, src/init and 11 more places. | superdev |
| 3298 | 2026-07-28 | Change recorded: One answer path for a question, replacing three that disagreed | superdev |
| 3297 | 2026-07-28 | Linked memory MEM-0094 to feature FEAT-0095 | superdev |
| 3296 | 2026-07-28 | Linked memory MEM-0094 to task TASK-0026 | superdev |
| 3295 | 2026-07-28 | Remembered outcome: TASK-0026 complete: Prove Answer a question by choosing from its options or typi | superdev |
| 3294 | 2026-07-28 | Answer a question by choosing from its options or typing your own is complete: its contract is satisfied | superdev |
| 3293 | 2026-07-28 | TASK-0026 completed, assignment released. | superdev |
| 3292 | 2026-07-28 | Task TASK-0026 moved to complete | superdev |
| 3291 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3290 | 2026-07-28 | Acceptance criterion AC-0103 is met, evidenced by EV-0140. | superdev |
| 3289 | 2026-07-28 | Passing evidence recorded for TASK-0026: A typed answer is accepted alone or alongside an option, and the right half of it reaches the project field | superdev |
| 3288 | 2026-07-28 | Acceptance criterion AC-0102 is met, evidenced by EV-0139. | superdev |
| 3287 | 2026-07-28 | Passing evidence recorded for TASK-0026: One-answer questions refuse several options; many-answer questions accept them | superdev |
| 3286 | 2026-07-28 | Acceptance criterion AC-0101 is met, evidenced by EV-0138. | superdev |
| 3285 | 2026-07-28 | Passing evidence recorded for TASK-0026: The API carries each question's options, select mode, recommended options and why, and the control centre renders them as choices | superdev |
| 3284 | 2026-07-28 | Changed 8 files in src, src/init, src/product and 4 more places. | superdev |
| 3283 | 2026-07-28 | Changed 5 files in src/init, src/product, src and 1 more places. | superdev |
| 3281 | 2026-07-28 | Task TASK-0026 moved to in progress | superdev |
| 3280 | 2026-07-28 | TASK-0026 claimed. | superdev |
| 3279 | 2026-07-28 | Derived tasks for FEAT-0095: 1 new, 0 updated, 0 superseded. | superdev |
| 3278 | 2026-07-28 | Derived Prove Answer a question by choosing from its options or typing your own meets its acceptance criteria | superdev |
| 3277 | 2026-07-28 | FEAT-0095 now serves Complete, structured product model | superdev |
| 3276 | 2026-07-28 | Accepted Answer a question by choosing from its options or typing your own at microspec depth | superdev |
| 3275 | 2026-07-28 | Edge case recorded for FEAT-0095: state_machine_violations | superdev |
| 3274 | 2026-07-28 | Edge case recorded for FEAT-0095: invalid_input | superdev |
| 3273 | 2026-07-28 | Acceptance criterion recorded for FEAT-0095 | superdev |
| 3272 | 2026-07-28 | Acceptance criterion recorded for FEAT-0095 | superdev |
| 3271 | 2026-07-28 | Acceptance criterion recorded for FEAT-0095 | superdev |
| 3270 | 2026-07-28 | Primary flow recorded for FEAT-0095 | superdev |
| 3269 | 2026-07-28 | Primary flow recorded for FEAT-0095 | superdev |
| 3268 | 2026-07-28 | Primary flow recorded for FEAT-0095 | superdev |
| 3267 | 2026-07-28 | Primary flow recorded for FEAT-0095 | superdev |
| 3266 | 2026-07-28 | Feature drafted in Local Control Center: Answer a question by choosing from its options or typing your own | superdev |
| 3265 | 2026-07-28 | Linked memory MEM-0093 to feature FEAT-0094 | superdev |
| 3264 | 2026-07-28 | Linked memory MEM-0093 to task TASK-0025 | superdev |
| 3263 | 2026-07-28 | Remembered outcome: TASK-0025 complete: Prove Resolve a capability area through a command meets its | superdev |
| 3262 | 2026-07-28 | Resolve a capability area through a command is complete: its contract is satisfied | superdev |
| 3261 | 2026-07-28 | TASK-0025 completed, assignment released. | superdev |
| 3260 | 2026-07-28 | Task TASK-0025 moved to complete | superdev |
| 3259 | 2026-07-28 | Acceptance criterion AC-0100 is met, evidenced by EV-0137. | superdev |
| 3258 | 2026-07-28 | Passing evidence recorded for TASK-0025: No area is left awaiting a decision with no question raised | superdev |
| 3257 | 2026-07-28 | Acceptance criterion AC-0099 is met, evidenced by EV-0136. | superdev |
| 3256 | 2026-07-28 | Passing evidence recorded for TASK-0025: capability not-applicable records a reason, and refuses without one | superdev |
| 3255 | 2026-07-28 | Acceptance criterion AC-0098 is met, evidenced by EV-0135. | superdev |
| 3254 | 2026-07-28 | Passing evidence recorded for TASK-0025: capability specify settled the area doctor was warning about, and the warning cleared | superdev |
| 3253 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3252 | 2026-07-28 | Changed 20 files in the project root, scripts/validate, skills/docs/scripts and 8 more places. | superdev |
| 3251 | 2026-07-28 | Task TASK-0025 moved to in progress | superdev |
| 3250 | 2026-07-28 | TASK-0025 claimed. | superdev |
| 3249 | 2026-07-28 | Derived tasks for FEAT-0094: 1 new, 0 updated, 0 superseded. | superdev |
| 3248 | 2026-07-28 | Derived Prove Resolve a capability area through a command meets its acceptance criteria | superdev |
| 3247 | 2026-07-28 | FEAT-0094 now serves No unmapped or disconnected implementation work | superdev |
| 3246 | 2026-07-28 | Accepted Resolve a capability area through a command at microspec depth | superdev |
| 3245 | 2026-07-28 | Edge case recorded for FEAT-0094: invalid_input | superdev |
| 3244 | 2026-07-28 | Edge case recorded for FEAT-0094: empty_states | superdev |
| 3243 | 2026-07-28 | Acceptance criterion recorded for FEAT-0094 | superdev |
| 3242 | 2026-07-28 | Acceptance criterion recorded for FEAT-0094 | superdev |
| 3241 | 2026-07-28 | Acceptance criterion recorded for FEAT-0094 | superdev |
| 3240 | 2026-07-28 | Primary flow recorded for FEAT-0094 | superdev |
| 3239 | 2026-07-28 | Primary flow recorded for FEAT-0094 | superdev |
| 3238 | 2026-07-28 | Primary flow recorded for FEAT-0094 | superdev |
| 3237 | 2026-07-28 | Feature drafted in Discovery and Onboarding: Resolve a capability area through a command | superdev |
| 3235 | 2026-07-28 | Change recorded: Fixed eight defects an independent first-run report found, and added the checks that would have caught three of them | superdev |
| 3234 | 2026-07-28 | Linked memory MEM-0092 to feature FEAT-0093 | superdev |
| 3233 | 2026-07-28 | Linked memory MEM-0092 to task TASK-0024 | superdev |
| 3232 | 2026-07-28 | Remembered outcome: TASK-0024 complete: Prove Record what the product deliberately does not do meets | superdev |
| 3231 | 2026-07-28 | Record what the product deliberately does not do is complete: its contract is satisfied | superdev |
| 3230 | 2026-07-28 | TASK-0024 completed, assignment released. | superdev |
| 3229 | 2026-07-28 | Task TASK-0024 moved to complete | superdev |
| 3228 | 2026-07-28 | Acceptance criterion AC-0097 is met, evidenced by EV-0134. | superdev |
| 3227 | 2026-07-28 | Passing evidence recorded for TASK-0024: A hand edit to Non-goals is refused with the command that writes it | superdev |
| 3226 | 2026-07-28 | Acceptance criterion AC-0096 is met, evidenced by EV-0133. | superdev |
| 3225 | 2026-07-28 | Passing evidence recorded for TASK-0024: Scope was recorded, listed and removed through the CLI on a real project | superdev |
| 3224 | 2026-07-28 | Acceptance criterion AC-0095 is met, evidenced by EV-0132. | superdev |
| 3223 | 2026-07-28 | Passing evidence recorded for TASK-0024: A brief's out-of-scope line reached the generated Non-goals section, with its provenance | superdev |
| 3222 | 2026-07-28 | Task TASK-0024 moved to in progress | superdev |
| 3221 | 2026-07-28 | TASK-0024 claimed. | superdev |
| 3220 | 2026-07-28 | Derived tasks for FEAT-0093: 1 new, 0 updated, 0 superseded. | superdev |
| 3219 | 2026-07-28 | Derived Prove Record what the product deliberately does not do meets its acceptance criteria | superdev |
| 3218 | 2026-07-28 | FEAT-0093 now serves No unmapped or disconnected implementation work | superdev |
| 3217 | 2026-07-28 | Accepted Record what the product deliberately does not do at microspec depth | superdev |
| 3216 | 2026-07-28 | Edge case recorded for FEAT-0093: duplication | superdev |
| 3215 | 2026-07-28 | Edge case recorded for FEAT-0093: empty_states | superdev |
| 3214 | 2026-07-28 | Acceptance criterion recorded for FEAT-0093 | superdev |
| 3213 | 2026-07-28 | Acceptance criterion recorded for FEAT-0093 | superdev |
| 3212 | 2026-07-28 | Acceptance criterion recorded for FEAT-0093 | superdev |
| 3211 | 2026-07-28 | Primary flow recorded for FEAT-0093 | superdev |
| 3210 | 2026-07-28 | Primary flow recorded for FEAT-0093 | superdev |
| 3209 | 2026-07-28 | Primary flow recorded for FEAT-0093 | superdev |
| 3208 | 2026-07-28 | Primary flow recorded for FEAT-0093 | superdev |
| 3207 | 2026-07-28 | Feature drafted in Product Model and Orchestration: Record what the product deliberately does not do | superdev |
| 3206 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3205 | 2026-07-28 | Changed 18 files in the project root, scripts/validate, skills/docs/scripts and 8 more places. | superdev |
| 3204 | 2026-07-28 | Changed 17 files in the project root, scripts/validate, skills/docs/scripts and 7 more places. | superdev |
| 3203 | 2026-07-28 | Changed 15 files in the project root, scripts/validate, src and 7 more places. | superdev |
| 3202 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3201 | 2026-07-28 | Changed 12 files in src, talks/changes, talks/modules/product-model-and-orchestration and 5 more places. | superdev |
| 3199 | 2026-07-28 | Changed 13 files in hooks, src/progress, src/runtime and 8 more places. | superdev |
| 3198 | 2026-07-28 | Session started by Rahul Retnan in claude-code on main | Rahul Retnan |
| 3197 | 2026-07-28 | FEAT-0092 now serves No unmapped or disconnected implementation work | superdev |
| 3195 | 2026-07-28 | Linked memory MEM-0091 to feature FEAT-0092 | superdev |
| 3194 | 2026-07-28 | Linked memory MEM-0091 to task TASK-0023 | superdev |
| 3193 | 2026-07-28 | Remembered outcome: TASK-0023 complete: Prove Author the product map after initialization meets its | superdev |
| 3192 | 2026-07-28 | Author the product map after initialization is complete: its contract is satisfied | superdev |
| 3191 | 2026-07-28 | TASK-0023 completed, assignment released. | superdev |
| 3190 | 2026-07-28 | Task TASK-0023 moved to complete | superdev |
| 3189 | 2026-07-28 | Acceptance criterion AC-0094 is met, evidenced by EV-0131. | superdev |
| 3188 | 2026-07-28 | Passing evidence recorded for TASK-0023: feature move reassigned FEAT-0001 from MOD-0001 to MOD-0002 and the database shows the new module with the feature's name, depth and status unchanged. This very feature, FEAT-0092, was created and specified through the new commands rather than by a script. | superdev |
| 3187 | 2026-07-28 | Acceptance criterion AC-0093 is met, evidenced by EV-0130. | superdev |
| 3186 | 2026-07-28 | Passing evidence recorded for TASK-0023: feature create drafted FEAT-0002 in MOD-0002 at microspec depth with status draft, and told the reader the depth gate would refuse acceptance until the specification was written. A second feature with the same name was refused, naming the one that existed. | superdev |
| 3185 | 2026-07-28 | Acceptance criterion AC-0092 is met, evidenced by EV-0129. | superdev |
| 3184 | 2026-07-28 | Passing evidence recorded for TASK-0023: In a throwaway project: goal record created GOAL-0001 and said it was unmeasurable until it carried a criterion; goal criterion added GSC-0001 with its measurement and target; the database shows the criterion unmet against the goal, which is what progress counts. | superdev |
| 3183 | 2026-07-28 | Task TASK-0023 moved to in progress | superdev |
| 3182 | 2026-07-28 | TASK-0023 claimed. | superdev |
| 3181 | 2026-07-28 | Derived tasks for FEAT-0092: 1 new, 0 updated, 0 superseded. | superdev |
| 3180 | 2026-07-28 | Derived Prove Author the product map after initialization meets its acceptance criteria | superdev |
| 3179 | 2026-07-28 | Accepted Author the product map after initialization at microspec depth | superdev |
| 3178 | 2026-07-28 | Edge case recorded for FEAT-0092: deletion_semantics | superdev |
| 3177 | 2026-07-28 | Edge case recorded for FEAT-0092: invalid_input | superdev |
| 3176 | 2026-07-28 | Edge case recorded for FEAT-0092: duplication | superdev |
| 3175 | 2026-07-28 | Edge case recorded for FEAT-0092: empty_states | superdev |
| 3174 | 2026-07-28 | Acceptance criterion recorded for FEAT-0092 | superdev |
| 3173 | 2026-07-28 | Acceptance criterion recorded for FEAT-0092 | superdev |
| 3172 | 2026-07-28 | Acceptance criterion recorded for FEAT-0092 | superdev |
| 3171 | 2026-07-28 | Primary flow recorded for FEAT-0092 | superdev |
| 3170 | 2026-07-28 | Primary flow recorded for FEAT-0092 | superdev |
| 3169 | 2026-07-28 | Primary flow recorded for FEAT-0092 | superdev |
| 3168 | 2026-07-28 | Primary flow recorded for FEAT-0092 | superdev |
| 3167 | 2026-07-28 | Primary flow recorded for FEAT-0092 | superdev |
| 3166 | 2026-07-28 | Primary flow recorded for FEAT-0092 | superdev |
| 3165 | 2026-07-28 | Feature drafted in Product Model and Orchestration: Author the product map after initialization | superdev |
| 3164 | 2026-07-28 | The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line. | superdev |
| 3162 | 2026-07-28 | Change recorded: Removed skills/docs/scripts/ingest.mjs from the Docs skill | superdev |
| 3160 | 2026-07-28 | Session SES-0006 ended. No outcome recorded. | superdev |
| 3158 | 2026-07-28 | Session started by Superdev Dev in claude-code on main | Superdev Dev |
| 3156 | 2026-07-28 | Session SES-0005 ended. No outcome recorded. | superdev |
| 3154 | 2026-07-28 | Session SES-0004 ended. No outcome recorded. | superdev |
| 3153 | 2026-07-28 | Session SES-0003 ended. No outcome recorded. | superdev |
