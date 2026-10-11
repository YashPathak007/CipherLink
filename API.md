# CipherLink API

The API is served at `http://localhost:4000/api` by default. The complete route reference, request shapes, authentication rules, and response behavior live in [`docs/API.md`](docs/API.md); the implementation source is [`src/server.ts`](src/server.ts).

## Route groups

- `GET /health` — database-backed health check
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` — session lifecycle
- `GET /files`, `POST /files`, `GET /files/:id`, `PATCH /files/:id`, `DELETE /files/:id` — owner file management
- `GET /files/:id/download` — authenticated, integrity-checked download
- `POST /files/:id/shares`, `GET /files/:id/shares`, `DELETE /shares/:id` — controlled sharing
- `GET /shared/:token`, `GET /shared/:token/download` — public share inspection and download
- `GET /audit` — authenticated activity history

Owner-scoped routes require `Authorization: Bearer <jwt>`. Registration and login are intentionally unauthenticated. Public share routes accept only the high-entropy token and enforce expiration, revocation, and download count on the backend; raw share tokens are not persisted.
