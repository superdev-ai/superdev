// Where a bundle goes. DEC-TBD-006, the transport half.
//
// The protocol does not care what carries the bytes, so the transport is an
// adapter and the engine never names one. Exactly one is implemented: a
// directory on this machine, which may be a shared drive or a mounted volume.
//
// That is deliberate and it is not a placeholder. A directory transport is
// enough to synchronize two working copies, which is the case the local product
// actually has, and it lets every other part of synchronization, the merge, the
// conflict, the lease, the queue, the encryption, be built and proven now
// rather than described. A hosted transport is a second adapter implementing
// these four functions, and nothing above it changes.
//
// Nothing here reaches the network. When a hosted transport is added it is a
// deliberate act with the owner's authorization, not a consequence of this.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const E = {
  UNREACHABLE: "E_PEER_UNREACHABLE",
  UNKNOWN_TRANSPORT: "E_UNKNOWN_TRANSPORT",
  BUSY: "E_PEER_BUSY",
};

export class TransportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TransportError";
    this.code = code;
  }
}

/**
 * A directory holding one encrypted bundle per participant.
 *
 * Each side writes only its own file and reads everyone else's, so two machines
 * syncing at the same moment cannot overwrite each other's work. Writes go to a
 * temporary name and are renamed into place, which is atomic on every
 * filesystem this runs on, so a reader never sees half a bundle.
 */
function directory(location) {
  const at = resolve(location);

  return {
    describe: () => at,

    reachable() {
      try {
        return existsSync(at) && statSync(at).isDirectory();
      } catch {
        return false;
      }
    },

    open() {
      mkdirSync(at, { recursive: true });
      // A marker so a reader can tell this directory is in use by Superdev
      // rather than pointing at something else by accident.
      const marker = join(at, "superdev-remote");
      if (!existsSync(marker)) {
        writeFileSync(marker, "This directory holds encrypted Superdev project bundles. The contents are unreadable without the project key, which is never stored here.\n");
      }
    },

    /** Write this side's bundle, atomically. */
    put(name, bytes) {
      if (!this.reachable()) {
        throw new TransportError(E.UNREACHABLE,
          `The remote directory ${at} does not exist or is not a directory, so nothing can be written to it.`);
      }
      const target = join(at, `${name}.bundle`);
      const temporary = `${target}.writing`;
      writeFileSync(temporary, bytes);
      renameSync(temporary, target);
    },

    /** Every bundle except this side's own. */
    list(exclude) {
      if (!this.reachable()) return [];
      return readdirSync(at)
        .filter((f) => f.endsWith(".bundle") && f !== `${exclude}.bundle`)
        .map((f) => ({ name: f.replace(/\.bundle$/, ""), at: join(at, f) }));
    },

    get(name) {
      const file = join(at, `${name}.bundle`);
      if (!existsSync(file)) return null;
      return readFileSync(file);
    },

    forget(name) {
      const file = join(at, `${name}.bundle`);
      if (existsSync(file)) rmSync(file);
    },
  };
}

const ADAPTERS = { directory };

/** The adapter for a peer, or a refusal naming what is available. */
export function transportFor(peer) {
  const kind = String(peer?.transport ?? "directory");
  const make = ADAPTERS[kind];
  if (!make) {
    throw new TransportError(E.UNKNOWN_TRANSPORT,
      `${kind} is not a transport this version can use. Available: ${Object.keys(ADAPTERS).join(", ")}.`);
  }
  if (!peer?.location) {
    throw new TransportError(E.UNREACHABLE,
      "This peer has no location recorded, so there is nowhere to read from or write to.");
  }
  return make(peer.location);
}

export const AVAILABLE_TRANSPORTS = Object.keys(ADAPTERS);
