/**
 * A clock the interface can re-render against.
 *
 * Relative times were computed against `Date.now()` at render, and nothing
 * re-rendered while the connection was down. So the one line whose entire job
 * is to answer "is this data current" sat there reading "Just now" for as long
 * as the page was left open, which is the single worst thing a freshness
 * indicator can do: it does not merely go stale, it actively asserts it has not.
 *
 * One interval for the whole application, shared through `useSyncExternalStore`,
 * rather than a timer per component. Thirty seconds is chosen to match the
 * smallest step the wording can express: `relativeTime` says "Just now" below
 * forty five seconds, so a faster tick could not change a word on screen.
 */
import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function start() {
  if (timer !== null) return;
  timer = setInterval(() => {
    now = Date.now();
    for (const listener of listeners) listener();
  }, TICK_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function snapshot() {
  return now;
}

/**
 * The current time, re-rendering the caller as it advances. Pass it to
 * `relativeTime` anywhere the phrase is a claim about freshness rather than a
 * timestamp on a historical record.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
