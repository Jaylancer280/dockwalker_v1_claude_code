import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Convert whatever Supabase handed back for a bytea column into a Node Buffer.
 * PostgREST serialises bytea differently depending on version and transport:
 *   - Hex string with `\x` prefix (legacy): "\x41424344"
 *   - Hex string without prefix: "41424344"
 *   - Base64 string
 *   - Native Buffer (direct pg insertion)
 *   - Uint8Array (rare)
 * Always returns a Buffer. Falls back to utf-8 decoding if nothing else parses.
 */
export function bufferFromBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) {
      return Buffer.from(value.slice(2), 'hex');
    }
    // Detect hex (even length, all hex chars)
    if (value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value)) {
      return Buffer.from(value, 'hex');
    }
    // Detect base64 (length divisible by 4, only base64 alphabet)
    if (value.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(value)) {
      return Buffer.from(value, 'base64');
    }
    return Buffer.from(value, 'utf8');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Buffer.from(value as any);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.NOTIFICATION_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('NOTIFICATION_ENCRYPTION_KEY env var is not set');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('NOTIFICATION_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  return key;
}

/**
 * Encrypt a string and return a Buffer.
 * Format: [12-byte IV][ciphertext][16-byte auth tag]
 *
 * For Supabase bytea writes, prefer `encryptForStorage()` — it returns a
 * base64 string with a consistent wire format that survives round-tripping
 * through PostgREST regardless of bytea_output setting.
 */
export function encryptPhone(plaintext: string): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]);
}

/**
 * Encrypt and return a PostgreSQL hex literal (`\x...`) suitable for writing
 * to a Supabase bytea column. PostgREST ships the string verbatim to Postgres,
 * which parses `\x` as native hex bytea input — unambiguous round trip.
 *
 * Do NOT pass a raw Buffer or a base64 string to a bytea column: the Supabase
 * JS serializer's behaviour is inconsistent and base64 without a type hint is
 * interpreted as `escape`-format bytea, which stores the ASCII of the literal
 * string rather than the decoded bytes. Both failed in production.
 */
export function encryptForStorage(plaintext: string): string {
  return '\\x' + encryptPhone(plaintext).toString('hex');
}

/**
 * Decrypt a Buffer back to a phone number string.
 * Expects format: [12-byte IV][ciphertext][16-byte auth tag]
 */
export function decryptPhone(encrypted: Buffer): string {
  const key = getKey();
  const iv = encrypted.subarray(0, IV_LENGTH);
  const tag = encrypted.subarray(encrypted.length - TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH, encrypted.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
