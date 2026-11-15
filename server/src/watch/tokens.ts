// Tokens for watch links. A token is 32 random bytes; the database only ever
// holds a keyed hash of it, and hashes are compared in constant time, so a
// copy of the database opens no watch and a guess learns nothing from timing.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A new random token, safe to put in a link. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** HMAC-SHA256 of the token under the signing secret, as hex. This is what is stored. */
export function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

/** Compare two stored-form hashes without leaking where they differ. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const unsubscribeSignature = (id: string, manageHash: string, secret: string): string =>
  createHmac('sha256', secret).update(`unsubscribe:${id}:${manageHash}`).digest('base64url');

/**
 * The token in an email's unsubscribe link. Alerts go out long after the watch
 * was made, when only the hash of its manage token is left, so this is worked
 * out from that hash and the signing secret instead of being stored: "<id>.<signature>".
 */
export function unsubscribeToken(id: string, manageHash: string, secret: string): string {
  return `${id}.${unsubscribeSignature(id, manageHash, secret)}`;
}

/** The watch id an unsubscribe token names, or undefined when it is not of that form. */
export function unsubscribeTokenId(token: string): string | undefined {
  return /^(\d{1,18})\.[A-Za-z0-9_-]{43}$/.exec(token)?.[1];
}

/** True when the token is the unsubscribe token for this watch. */
export function isUnsubscribeTokenFor(token: string, id: string, manageHash: string, secret: string): boolean {
  return sameHash(token, unsubscribeToken(id, manageHash, secret));
}
