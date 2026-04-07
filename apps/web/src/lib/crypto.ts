import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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
 * Encrypt a phone number string to a Buffer.
 * Format: [12-byte IV][ciphertext][16-byte auth tag]
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
