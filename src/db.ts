import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS files (id UUID PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, original_filename TEXT NOT NULL, stored_filename TEXT UNIQUE NOT NULL, content_type TEXT NOT NULL, original_size BIGINT NOT NULL, encrypted_size BIGINT NOT NULL, checksum TEXT NOT NULL, wrapped_key TEXT NOT NULL, key_nonce TEXT NOT NULL, key_tag TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS share_links (id UUID PRIMARY KEY, file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, max_downloads INTEGER, download_count INTEGER NOT NULL DEFAULT 0, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, ip_address TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS files_owner_idx ON files(owner_id); CREATE INDEX IF NOT EXISTS shares_token_idx ON share_links(token_hash); CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);
  `);
}
