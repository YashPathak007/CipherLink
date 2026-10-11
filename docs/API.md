# CipherLink API reference

This is a concise route reference for the implementation in [`src/server.ts`](../src/server.ts). It is not a generated OpenAPI document. The API listens on port `4000` by default and is mounted under `/api`.

## Conventions

- JSON request bodies use `Content-Type: application/json` unless noted otherwise.
- Authenticated endpoints require `Authorization: Bearer <jwt>`.
- Login and registration tokens expire after two hours.
- IDs are UUIDs for files and shares. Owner-scoped resource lookups generally return `404` rather than revealing whether another account owns them; share history returns only owner-visible rows.
- Public share routes receive the raw token in the URL. The database stores only its SHA-256 hash.
- The default upload limit is 10 MiB (`MAX_FILE_SIZE=10485760`). Allowed extensions are `.txt`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.json`, `.csv`, and `.zip`.

## Health and authentication

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | None | Runs a database connectivity check. Returns `200` with `{ "status": "ok", "database": "ok" }`, or `503` when the database is unavailable. |
| `POST` | `/api/auth/register` | None | Accepts `email`, `password` (10+ characters), and `displayName`. Returns `201` with a JWT and user summary. |
| `POST` | `/api/auth/login` | None | Accepts `email` and `password`. Returns a JWT and user summary. |
| `POST` | `/api/auth/logout` | Bearer | Records a logout audit event and returns `204`. The server does not revoke an already-issued JWT before expiry. |

## Files and downloads

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/files` | Bearer | Lists the current user's files. |
| `POST` | `/api/files` | Bearer | Accepts `multipart/form-data` with a single `file` field, encrypts the bytes, stores metadata, and returns the file summary. |
| `GET` | `/api/files/:id` | Bearer | Returns one owner-scoped file summary. |
| `PATCH` | `/api/files/:id` | Bearer | Accepts `{ "name": "new-name.pdf" }` and safely renames the file record. |
| `GET` | `/api/files/:id/download` | Bearer | Decrypts, authenticates, checksum-verifies, and downloads an owner-scoped file. |
| `DELETE` | `/api/files/:id` | Bearer | Deletes the file record, encrypted bytes, and cascading share records. |

The file summary includes the original and encrypted sizes, stored content-type metadata, SHA-256 checksum, and timestamps. It does not include wrapped key material.

## Controlled sharing

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/files/:id/shares` | Bearer | Accepts a future `expiresAt` ISO timestamp and optional `maxDownloads` (`1`–`1000`, or `null` for unlimited). Returns share metadata plus the raw token once. |
| `GET` | `/api/files/:id/shares` | Bearer | Lists the owner's share history without returning raw tokens. |
| `DELETE` | `/api/shares/:id` | Bearer | Revokes an active owner-scoped link and returns `204`. |
| `GET` | `/api/shared/:token` | None | Validates a public link and returns filename, content type metadata, size, expiry, and remaining downloads. |
| `GET` | `/api/shared/:token/download` | None | Rechecks the link policy, consumes a download, verifies the encrypted file, and sends the decrypted bytes. |

An invalid, expired, revoked, or exhausted public link returns `404` with a generic error so the API does not distinguish link states to an unauthenticated caller. The frontend turns the raw token into `http://localhost:5173/shared/<token>` (or the active frontend origin).

## Audit

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/audit` | Bearer | Returns up to the latest 200 audit events for the current actor. Events include action, resource type/id, timestamp, and non-content details. |

Recorded actions include registration, successful and failed login, logout, upload, download, share creation/access, revocation, rename, and deletion.

## Example request shapes

```http
POST /api/auth/login
Content-Type: application/json

{"email":"demo@cipherlink.local","password":"<local-demo-password>"}
```

```http
POST /api/files/<file-id>/shares
Authorization: Bearer <jwt>
Content-Type: application/json

{"expiresAt":"2030-01-01T00:00:00.000Z","maxDownloads":5}
```

The placeholder values above are deliberately not credentials or tokens. Configure a local `DEMO_PASSWORD` and create a session through the local app before trying authenticated requests.
