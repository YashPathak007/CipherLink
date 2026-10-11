import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InputValidationError,
  contentTypeForExtension,
  parseBearerToken,
  safeName,
  shareIsAvailable,
  validateFile,
} from './security.js';

test('safeName strips both POSIX and Windows path traversal', () => {
  assert.equal(safeName('../../private.txt'), 'private.txt');
  assert.equal(safeName('..\\secret.pdf'), 'secret.pdf');
  assert.equal(safeName('quarterly report?.pdf'), 'quarterly report_.pdf');
});

test('safeName rejects names that contain no usable filename', () => {
  assert.throws(() => safeName('////'), InputValidationError);
  assert.throws(() => safeName('..'), InputValidationError);
});

test('uploads use a server-selected content type and enforce the allow-list', () => {
  const file = { originalname: 'payload.JSON', size: 4, buffer: Buffer.from('{}') };
  validateFile(file, 10);
  assert.equal(contentTypeForExtension(file.originalname), 'application/json');
  assert.throws(
    () => validateFile({ originalname: 'script.exe', size: 1, buffer: Buffer.from('x') }, 10),
    /extension is not allowed/,
  );
});

test('bearer authentication requires a complete bearer header', () => {
  assert.equal(parseBearerToken('Bearer abc123'), 'abc123');
  assert.equal(parseBearerToken('bearer\tabc123'), 'abc123');
  assert.equal(parseBearerToken('Basic abc123'), null);
  assert.equal(parseBearerToken('Bearer abc123 extra'), null);
});

test('share availability respects expiry, revocation, and download limits', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const share = {
    expires_at: '2026-01-01T01:00:00.000Z',
    max_downloads: 2,
    download_count: 1,
    revoked_at: null,
  };
  assert.equal(shareIsAvailable(share, now), true);
  assert.equal(shareIsAvailable({ ...share, download_count: 2 }, now), false);
  assert.equal(shareIsAvailable({ ...share, revoked_at: now }, now), false);
  assert.equal(shareIsAvailable({ ...share, expires_at: '2025-12-31T23:59:00.000Z' }, now), false);
});
