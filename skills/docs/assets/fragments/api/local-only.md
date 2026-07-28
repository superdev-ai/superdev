# Fragment: Local-Only API (in-process contracts)

**Activates on evidence:** no network API surface - capabilities exposed as in-process module interfaces (exported functions/classes consumed across module boundaries). Or an accepted decision.

**Fills:** the "Style specifics" section of the API template.

## Sections supplied

- **Contract location:** the exported interface (file, symbol) - the type signature is the contract.
- **Consumers:** which modules import it (module boundaries still apply in-process).
- **Error convention:** exceptions vs result types, as the project does it.
- **Stability:** which interfaces are internal-stable (cross-module) vs private (may change freely).
- **Statement:** the doc records explicitly that no network API exists for this capability - absence is a documented fact, not an omission.
