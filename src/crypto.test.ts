import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptFile, decryptFile } from './crypto.js';
process.env.MASTER_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
test('AES-GCM encrypts and decrypts file bytes', () => { const source=Buffer.from('CipherLink test content'); const encrypted=encryptFile(source); assert.notDeepEqual(encrypted.ciphertext, source); assert.deepEqual(decryptFile(encrypted), source); });
test('AES-GCM rejects corrupted ciphertext', () => { const encrypted=encryptFile(Buffer.from('protected')); encrypted.ciphertext[20] ^= 1; assert.throws(() => decryptFile(encrypted)); });
