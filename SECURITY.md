# Security notes

CipherLink is a portfolio application designed to make security boundaries visible. It uses Node's standard cryptographic library rather than custom cryptography:

- Each uploaded file receives a fresh random 32-byte data-encryption key.
- File bytes are sealed with AES-256-GCM using a random 12-byte nonce. The stored binary layout is nonce, authentication tag, and ciphertext.
- The per-file key is wrapped with a separate AES-256-GCM operation using `MASTER_KEY_HEX`.
- PostgreSQL stores wrapped-key metadata, checksums, filenames, sizes, timestamps, and share state. Encrypted bytes live in the private `STORAGE_DIR` volume.
- Share tokens come from `randomBytes`; only their SHA-256 hashes are persisted. Audit records do not include file contents or raw share tokens.
- Downloads authenticate the ciphertext and verify the plaintext SHA-256 checksum before sending bytes to the caller.

## Threat model

The application is intended to reduce accidental exposure and enforce deliberate sharing rules:

| Scenario | Control in this project |
| --- | --- |
| A file is accidentally exposed as a public static asset | Encrypted files are written to a private directory that Express never serves directly. |
| A user guesses another file or share ID | Authenticated file and share queries are scoped to the current owner. Public links use 32-byte random tokens rather than sequential identifiers. |
| A link is used after its policy ends | Every public request checks expiry, revocation, and the download count. |
| Stored ciphertext is modified | AES-GCM authentication and a SHA-256 checksum are checked before delivery. |
| A filename attempts path traversal | Both slash styles are reduced to a safe basename and characters are constrained. |
| Basic HTTP or request abuse reaches the API | Helmet, CORS configuration, JSON limits, upload limits, and rate limiting are enabled. |

## What is not protected

This is **not end-to-end encryption** and is not a claim of zero-knowledge storage. A compromised application process, host administrator, or deployment with `MASTER_KEY_HEX` can decrypt files. Database metadata remains visible to the service, including filenames, sizes, checksums, content-type metadata, timestamps, and share state. Anyone who obtains a valid share link can download the file until it expires, is revoked, or reaches its limit.

The demo also does not protect against client malware, screenshots, a malicious authenticated user, traffic observation when deployed without HTTPS, or a compromised dependency. It does not include antivirus scanning, content disarm, deep file signature inspection, object-storage isolation, backups, or a professional security audit.

## Known hardening work

- Replace browser local-storage bearer JWTs with short-lived access tokens, secure HttpOnly refresh cookies, CSRF defenses, and a revocation/session strategy.
- Move the master key into a KMS/HSM-backed key-encryption flow with rotation, versioning, and recovery procedures.
- Terminate HTTPS at the deployment edge and keep secrets out of container environment inspection and logs.
- Add versioned database migrations, backup/restore testing, operational monitoring, malware/content checks, and a streaming upload path.
- Make share-limit consumption atomic under concurrency; the demo performs the availability check and increment as separate database operations.

Please treat this repository as an educational portfolio project, not as an audited enterprise file-sharing service. Do not upload real confidential data or production credentials while evaluating it.
