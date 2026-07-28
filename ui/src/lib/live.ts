/**
 * The server-sent events subscription.
 *
 * Behaviour, per MODULE_CONTRACT.md "Server-sent events":
 * - `hello` on connect, carrying the current sequence.
 * - `change` per new activity sequence, event id equal to the sequence.
 * - `resync` when our Last-Event-ID predates the replay buffer, which means a
 *   full refetch rather than an incremental update.
 * - Reconnect with exponential backoff plus jitter, capped near 30 seconds,
 *   resuming from the last sequence we saw.
 *
 * The stream is closed while the document is hidden and reopened when it comes
 * back, so a tab left open overnight does not hold a connection on the local
 * service.
 */

import { useSyncExternalStore } from "react";
import type { ChangeEvent, ConnectionState } from "@/types";

export interface LiveHandlers {
  /** Connection state changed: live, reconnecting or offline. */
  onState?: (state: ConnectionState, detail: LiveStatus) => void;
  /** A new committed activity sequence arrived. */
  onChange?: (event: ChangeEvent) => void;
  /**
   * Our position is older than the replay buffer, so incremental updates would
   * miss changes. Refetch everything on screen.
   */
  onResync?: (sequence: number) => void;
  /** The first successful connect, and every reconnect, of a session. */
  onHello?: (sequence: number) => void;
}

export interface LiveStatus {
  state: ConnectionState;
  /** Last sequence we are confident we have seen. */
  lastEventSequence: number;
  /** Consecutive failed connection attempts. */
  attempts: number;
  /** When the next reconnect is due, while reconnecting. */
  retryAt: number | null;
  /** Plain language for the header indicator and the Offline state panel. */
  explanation: string;
}

const BASE_DELAY = 500;
const MAX_DELAY = 30_000;
/** After this many failures in a row we stop claiming it is coming back. */
const OFFLINE_AFTER = 4;

const EXPLANATIONS: Record<ConnectionState, string> = {
  live: "Connected to the local Superdev service. Changes appear as they are committed.",
  reconnecting:
    "The connection to the local Superdev service dropped and is being retried. What you see is the last data received.",
  offline:
    "The local Superdev service is not answering. Start it with `superdev start --apply` in the project directory, then choose Reconnect.",
  degraded:
    "The local Superdev service is answering, but it cannot read the project database, so changes are not arriving. What you see is the last data received.",
};

/** Exponential backoff with full jitter, capped near thirty seconds. */
function backoffDelay(attempts: number): number {
  const ceiling = Math.min(MAX_DELAY, BASE_DELAY * 2 ** Math.min(attempts, 8));
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

export class LiveConnection {
  private source: EventSource | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private lastSequence = 0;
  private state: ConnectionState = "reconnecting";
  private retryAt: number | null = null;
  private started = false;
  private readonly handlers: LiveHandlers;
  private readonly url: string;

  constructor(handlers: LiveHandlers = {}, url = "/api/events") {
    this.handlers = handlers;
    this.url = url;
    this.onVisibility = this.onVisibility.bind(this);
  }

  get status(): LiveStatus {
    return {
      state: this.state,
      lastEventSequence: this.lastSequence,
      attempts: this.attempts,
      retryAt: this.retryAt,
      explanation: EXPLANATIONS[this.state],
    };
  }

  /** Begin subscribing. Safe to call more than once. */
  start(fromSequence = 0) {
    if (this.started) return;
    this.started = true;
    if (fromSequence > this.lastSequence) this.lastSequence = fromSequence;
    document.addEventListener("visibilitychange", this.onVisibility);
    if (document.visibilityState === "visible") {
      this.open();
    } else {
      this.setState("reconnecting");
    }
  }

  /** Stop for good and release the connection. */
  stop() {
    this.started = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.close();
    this.clearTimer();
  }

  /** Retry immediately, for the Reconnect control on the Offline panel. */
  reconnectNow() {
    if (!this.started) return;
    this.clearTimer();
    this.attempts = 0;
    this.close();
    this.open();
  }

  private onVisibility() {
    if (!this.started) return;
    if (document.visibilityState === "hidden") {
      // Do not pin the local service from a forgotten tab.
      this.clearTimer();
      this.close();
      this.setState("reconnecting");
    } else if (!this.source) {
      this.attempts = 0;
      this.open();
    }
  }

  private open() {
    this.clearTimer();
    this.retryAt = null;

    // Resume where we left off. EventSource sets Last-Event-ID itself once it
    // has seen an id, but a fresh object after a reload has no memory of it, so
    // the position travels in the query string as well.
    const url =
      this.lastSequence > 0
        ? `${this.url}?lastEventId=${this.lastSequence}`
        : this.url;

    let source: EventSource;
    try {
      source = new EventSource(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.source = source;

    source.addEventListener("open", () => {
      this.attempts = 0;
      this.setState("live");
    });

    source.addEventListener("hello", (event) => {
      const sequence = readSequence(event as MessageEvent);
      if (sequence !== null) this.lastSequence = sequence;
      this.attempts = 0;
      // A degraded frame follows hello on a stream that is already blind, so
      // this reads live for one tick and is then corrected by the server.
      this.setState("live");
      this.handlers.onHello?.(this.lastSequence);
    });

    source.addEventListener("change", (event) => {
      const message = event as MessageEvent;
      const payload = parse<ChangeEvent>(message.data);
      const sequence =
        payload?.sequence ?? (message.lastEventId ? Number(message.lastEventId) : null);
      if (sequence === null || Number.isNaN(sequence)) return;
      if (sequence > this.lastSequence) this.lastSequence = sequence;
      // An event arriving is itself proof the poller reached the database.
      this.setState("live");
      this.handlers.onChange?.({ ...payload, sequence });
    });

    source.addEventListener("resync", (event) => {
      const sequence = readSequence(event as MessageEvent);
      if (sequence !== null) this.lastSequence = sequence;
      this.setState("live");
      this.handlers.onResync?.(this.lastSequence);
    });

    // The socket is open and the service is answering, and its change poller
    // is not reaching the database. Without this the interface sat on a healthy
    // connection showing Live and never learned it had stopped being told
    // anything, which is the one failure a freshness indicator must not have.
    source.addEventListener("degraded", () => {
      this.setState("degraded");
    });

    source.addEventListener("recovered", (event) => {
      const sequence = readSequence(event as MessageEvent);
      if (sequence !== null && sequence > this.lastSequence) this.lastSequence = sequence;
      this.setState("live");
      // Whatever committed while the poller was blind never reached this client,
      // so the correct recovery is a full reload, not resuming the count.
      this.handlers.onResync?.(this.lastSequence);
    });

    source.addEventListener("error", () => {
      // EventSource retries on its own, but with no backoff and no ceiling.
      // Take the connection back so the retry schedule is ours.
      this.close();
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (!this.started || document.visibilityState === "hidden") {
      this.setState("reconnecting");
      return;
    }
    this.attempts += 1;
    this.setState(this.attempts >= OFFLINE_AFTER ? "offline" : "reconnecting");
    const delay = backoffDelay(this.attempts);
    this.retryAt = Date.now() + delay;
    this.clearTimer();
    this.timer = setTimeout(() => this.open(), delay);
  }

  private close() {
    if (!this.source) return;
    this.source.close();
    this.source = null;
  }

  private clearTimer() {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private setState(next: ConnectionState) {
    if (next === this.state) return;
    this.state = next;
    this.handlers.onState?.(next, this.status);
  }
}

/* ---------------------------------------------------------------------------
   One subscription for the whole application
   --------------------------------------------------------------------------- */

/**
 * The shell and every view need the same three readings, so they share one
 * stream rather than opening a connection each. The alternative, a hook that
 * constructs its own EventSource, gave the application several connections at
 * once, each with its own retry clock, and made the header's Reconnect control
 * a lie: it revived the shell's stream while the view on screen stayed offline.
 */
interface LiveSnapshot {
  status: LiveStatus;
  /** Increments on every committed change: put it in a fetch dependency list. */
  revision: number;
  /**
   * Increments only when the server said our position predated its replay
   * buffer, for views that distinguish an incremental change from a full
   * reload.
   */
  resyncToken: number;
}

let snapshot: LiveSnapshot = {
  status: {
    state: "reconnecting",
    lastEventSequence: 0,
    attempts: 0,
    retryAt: null,
    explanation: EXPLANATIONS.reconnecting,
  },
  revision: 0,
  resyncToken: 0,
};

let shared: LiveConnection | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<LiveSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!shared) {
    shared = new LiveConnection({
      onState: (_state, detail) => publish({ status: detail }),
      onHello: (sequence) => publish({ revision: sequence }),
      onChange: (event) => publish({ revision: event.sequence }),
      onResync: (sequence) =>
        publish({ revision: sequence, resyncToken: snapshot.resyncToken + 1 }),
    });
    shared.start();
  }
  return () => {
    listeners.delete(listener);
    // ponytail: the stream outlives the last subscriber rather than being torn
    // down and rebuilt on every navigation. LiveConnection already releases the
    // socket while the tab is hidden, which is the case that actually matters.
  };
}

function readSnapshot(): LiveSnapshot {
  return snapshot;
}

export function reconnectNow() {
  shared?.reconnectNow();
}

export function useLive() {
  const live = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  return {
    status: live.status,
    revision: live.revision,
    resyncToken: live.resyncToken,
    reconnect: reconnectNow,
  };
}

function parse<T>(data: unknown): Partial<T> {
  if (typeof data !== "string" || data.length === 0) return {};
  try {
    return JSON.parse(data) as Partial<T>;
  } catch {
    return {};
  }
}

function readSequence(event: MessageEvent): number | null {
  const payload = parse<{ sequence: number }>(event.data);
  if (typeof payload.sequence === "number") return payload.sequence;
  if (event.lastEventId) {
    const parsed = Number(event.lastEventId);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}
