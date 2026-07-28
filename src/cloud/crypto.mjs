// Encryption for anything that leaves the machine. DEC-TBD-008.
//
// The key is generated here, stored here, and never transmitted. What a remote
// holds is unreadable without it, which is the whole point: a directory on a
// shared drive, and later a hosted service, both get bytes that say nothing.
//
// Losing the key costs the remote copy and nothing else. That is only an
// acceptable trade because DEC-0014 makes the local database authoritative, so
// recovery is the local backup rather than the remote. A product whose only
// copy was remote could not afford an owner-held key, and this one can.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { paths } from "../db/store.mjs";

export const E = {
  NO_KEY: "E_NO_SYNC_KEY",
  WRONG_KEY: "E_WRONG_SYNC_KEY",
  CORRUPT: "E_BUNDLE_CORRUPT",
};

export class CryptoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CryptoError";
    this.code = code;
  }
}

const keyFile = (root) => join(paths(root).dir, "cloud", "key");

/**
 * The key for this project, created on first use.
 *
 * Written with owner-only permissions, in the project's own directory rather
 * than a shared one, because a key that lives next to the thing it protects is
 * a key somebody can find when they need it and can delete when they mean to.
 */
export function ensureKey(root) {
  const file = keyFile(root);
  if (existsSync(file)) return readFileSync(file);
  const key = randomBytes(32);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, key);
  try {
    chmodSync(file, 0o600);
  } catch {
    // A filesystem without permissions is not a reason to refuse the key.
  }
  return key;
}

export function keyExists(root) {
  return existsSync(keyFile(root));
}

export function loadKey(root) {
  const file = keyFile(root);
  if (!existsSync(file)) {
    throw new CryptoError(E.NO_KEY,
      "No encryption key exists for this project, so nothing can be read from or written to a remote. Run superdev cloud connect to create one.");
  }
  return readFileSync(file);
}

/**
 * A short, stable name for a key.
 *
 * Two machines can compare fingerprints to find out whether they hold the same
 * key without either sending it. A mismatch is the difference between "the
 * bundle is corrupt" and "you have the wrong key", and those need different
 * answers from whoever is reading the error.
 */
export const fingerprint = (key) =>
  createHash("sha256").update(key).digest("hex").slice(0, 16);

/** Encrypt a JSON-serializable value. Returns bytes, not text. */
export function seal(key, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
  ]);
  // Version byte first, so a future format change is detectable rather than
  // arriving as a decryption failure nobody can explain.
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), body]);
}

/** Decrypt what seal produced, or say plainly which of the two things went wrong. */
export function open(key, bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 30 || buffer[0] !== 1) {
    throw new CryptoError(E.CORRUPT,
      "This does not look like a Superdev bundle. It is either truncated or written by a different version.");
  }
  const iv = buffer.subarray(1, 13);
  const tag = buffer.subarray(13, 29);
  const body = buffer.subarray(29);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(body), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    throw new CryptoError(E.WRONG_KEY,
      "The bundle could not be opened with this project's key. Either it was written under a different key, or it has been altered since it was written. Nothing has been read from it.");
  }
}

/** A stable hash of a record, for deciding whether it changed. */
export const rowHash = (row) =>
  createHash("sha256")
    .update(JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k]])))
    .digest("hex")
    .slice(0, 32);
