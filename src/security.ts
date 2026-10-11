import path from 'node:path';

export const MAX_FILENAME_LENGTH = 180;

export const allowedExtensions = new Set([
  '.txt',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.json',
  '.csv',
  '.zip',
]);

const contentTypes: Record<string, string> = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
};

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * Keep names useful to a recipient while ensuring they can never become a
 * path. Both slash styles are normalized because uploads may originate on a
 * different operating system than the API container.
 */
export function safeName(name: string): string {
  const basename = name.replaceAll('\\', '/').split('/').pop() ?? '';
  const sanitized = basename.replace(/[^a-zA-Z0-9._ -]/g, '_').trim();
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new InputValidationError('Invalid filename');
  }
  return sanitized.slice(0, MAX_FILENAME_LENGTH);
}

export function extensionOf(name: string): string {
  return path.posix.extname(name.replaceAll('\\', '/')).toLowerCase();
}

export function contentTypeForExtension(name: string): string {
  return contentTypes[extensionOf(name)] ?? 'application/octet-stream';
}

export function validateFile(file: { originalname: string; size: number; buffer: Buffer }, maxSize: number): void {
  const extension = extensionOf(file.originalname);
  if (!allowedExtensions.has(extension)) {
    throw new InputValidationError('File extension is not allowed');
  }
  if (!Number.isFinite(file.size) || file.size > maxSize) {
    throw new InputValidationError('File exceeds the configured size limit');
  }
  if (!file.buffer?.length) {
    throw new InputValidationError('Empty or malformed upload');
  }
}

export function parseBearerToken(authorization?: string): string | null {
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export type ShareAvailability = {
  expires_at: string | Date;
  max_downloads: number | string | null;
  download_count: number | string;
  revoked_at?: string | Date | null;
};

export function shareIsAvailable(share: ShareAvailability, now = new Date()): boolean {
  if (share.revoked_at) return false;
  const expiresAt = new Date(share.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return false;
  if (share.max_downloads === null) return true;
  return Number(share.download_count) < Number(share.max_downloads);
}
