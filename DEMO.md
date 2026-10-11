# Interviewer walkthrough

This is a local-only walkthrough. Use a disposable `DEMO_PASSWORD` in the untracked `.env`; do not use production credentials or real confidential files.

1. Follow [`docs/DEMO.md`](docs/DEMO.md) to generate local values and run `docker compose up --build`.
2. Open `http://localhost:5174` and sign in as `demo@cipherlink.local` with the local `DEMO_PASSWORD` value.
3. Upload a small `.txt` file. The vault displays its original size, encrypted size, checksum, and AES-256-GCM status.
4. If demonstrating storage boundaries, inspect the local `cipherlink_files` Docker volume only. The stored `.bin` file is ciphertext and is not served as a public directory.
5. Create a link, copy the generated URL, and open it in a private browser window. The unauthenticated share page exposes only the necessary metadata and offers a download.
6. Download the file and compare it with the original. The backend authenticates and decrypts it, then verifies the SHA-256 checksum before responding.
7. Revoke the share through the UI; opening it again returns the generic unavailable-link state. Create another link with a short expiry to demonstrate expiry handling.
8. Open **Audit trail** after the authenticated actions to show login, upload, share creation, share access, and revocation records.

Discuss: per-file random keys, AES-GCM authentication tags, master-key wrapping, hashed share tokens, private storage, server-side authorization, and the documented server-trust limitation.
