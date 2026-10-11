# Local demo runbook

CipherLink has no hosted demo account. This runbook creates a disposable local environment without putting credentials, tokens, encrypted files, or private data in the repository.

## 1. Start the stack

From the repository root:

```powershell
Copy-Item .env.example .env
```

Replace `JWT_SECRET`, `MASTER_KEY_HEX`, and `DEMO_PASSWORD` in `.env` with local values. Generate a random value for each secret with this Node.js command (run it once per variable):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then run:

```powershell
docker compose up --build
```

Open [http://localhost:5174](http://localhost:5174). The backend health check is [http://localhost:4000/api/health](http://localhost:4000/api/health).

## 2. Sign in safely

The seed creates:

- **Email:** `demo@cipherlink.local`
- **Password:** the local `DEMO_PASSWORD` value

The password is intentionally not repeated in repository documentation. Keep `.env` untracked and use a disposable value for local evaluation. You can also register a separate local account from the sign-in screen.

## 3. Walk through the product

1. Upload a small sample such as a text file or PDF.
2. Watch the upload progress state and confirm the file appears in **My files**.
3. Open the file detail view and review the content-type metadata, original/encrypted sizes, and SHA-256 checksum.
4. Create a link with a short expiry and a limit of one or two downloads.
5. Copy the link once. Open it in a private browser window to see the public share experience without a session.
6. Download the file and confirm the recipient view reports that the limit was consumed.
7. Return to the owner view, revoke the link, and reopen it to see the generic unavailable state.
8. Open **Audit trail** to review the login, upload, share, download, and revoke records.
9. Open **Security** to show the encryption-at-rest boundary and the server-side decryption limitation.

## 4. Reset the demo

Stop the running process with `Ctrl+C`. To remove the local PostgreSQL and encrypted-file volumes before the next walkthrough:

```powershell
docker compose down -v
```

This deletes only the local Docker volumes created by Compose. Do not run it against a deployment that contains data you need.

## What to show in a portfolio review

- The product journey is visible in the vault rather than hidden in a README-only claim.
- The share token is displayed once, while share history shows policy state without exposing the token again.
- The server verifies AES-GCM authentication and SHA-256 integrity before returning plaintext.
- The Security view and [`SECURITY.md`](../SECURITY.md) state the trusted-server boundary clearly.
- The repository can be validated with `npm test`, both TypeScript builds, and `docker compose config` without committing any environment values.
