// Types for figure-state.mjs, which is plain JavaScript so node's test runner can
// import it directly. The runtime and the types live apart for that one reason.

export type FigureState = "complete" | "active" | "attention" | "blocked" | "idle" | "retired";

export function stateOf(status: string | null | undefined): FigureState;
