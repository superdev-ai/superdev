<!-- Template: API operation. Universal core - style specifics come from the active
     API fragment (rest/graphql/rpc/events/local-only), never assumed. -->
# API: {{operation-name}}

- **Status:** draft | accepted | implemented
- **Module:** {{owning-module}}
- **Style:** {{from-active-fragment}}
- **Implemented at:** {{code-path}}
- **Last verified:** {{revision}} on {{date}}

## Contract

- **Purpose:** {{what-it-does}}
- **Callers:** {{surfaces/actions/systems}}
- **Auth:** {{requirement-and-permission}} - enforced at {{enforcement-point}}
- **Request:** {{fields-validation-limits}}
- **Response (success):** {{shape}}
- **Errors:** {{code → meaning → user-facing-behavior}}
- **Idempotency:** {{key/semantics-or-deliberate-none}}
- **Limits:** {{rate/size-from-evidence-or-none-declared}}
- **Side effects:** {{events-jobs-notifications}}
- **Versioning:** {{compatibility-expectations}}

## Style specifics

{{filled-by-active-fragment-section}}

## Tests

{{test-references}}
