import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_SIZE = 12;
const MASTER_KEY_SIZE = 32;
export type EncryptedPayload = { ciphertext: Buffer; wrappedKey: string; keyNonce: string; keyTag: string; checksum: string };

function masterKey(): Buffer {
  const value = process.env.MASTER_KEY_HEX || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('MASTER_KEY_HEX must be exactly 32 bytes in hex');
  return Buffer.from(value, 'hex');
}
function seal(key: Buffer, plaintext: Buffer) {
  const nonce = randomBytes(NONCE_SIZE); const cipher = createCipheriv(ALGORITHM, key, nonce); const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce, tag: cipher.getAuthTag(), body };
}
export function encryptFile(plaintext: Buffer): EncryptedPayload {
  const fileKey = randomBytes(MASTER_KEY_SIZE); const file = seal(fileKey, plaintext); const wrapped = seal(masterKey(), fileKey);
  return { ciphertext: Buffer.concat([file.nonce, file.tag, file.body]), wrappedKey: wrapped.body.toString('base64'), keyNonce: wrapped.nonce.toString('base64'), keyTag: wrapped.tag.toString('base64'), checksum: createHash('sha256').update(plaintext).digest('hex') };
}
export function decryptFile(payload: { ciphertext: Buffer; wrappedKey: string; keyNonce: string; keyTag: string; checksum: string }): Buffer {
  const unwrap = createDecipheriv(ALGORITHM, masterKey(), Buffer.from(payload.keyNonce, 'base64')); unwrap.setAuthTag(Buffer.from(payload.keyTag, 'base64')); const fileKey = Buffer.concat([unwrap.update(Buffer.from(payload.wrappedKey, 'base64')), unwrap.final()]);
  const nonce = payload.ciphertext.subarray(0, NONCE_SIZE); const tag = payload.ciphertext.subarray(NONCE_SIZE, NONCE_SIZE + 16); const body = payload.ciphertext.subarray(NONCE_SIZE + 16); const decipher = createDecipheriv(ALGORITHM, fileKey, nonce); decipher.setAuthTag(tag); const plaintext = Buffer.concat([decipher.update(body), decipher.final()]);
  if (createHash('sha256').update(plaintext).digest('hex') !== payload.checksum) throw new Error('Integrity check failed');
  return plaintext;
}
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function createShareToken() { return randomBytes(32).toString('base64url'); }
