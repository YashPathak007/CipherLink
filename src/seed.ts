import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { initDb, pool } from './db.js';
async function main() { await initDb(); const password = await bcrypt.hash(process.env.DEMO_PASSWORD || 'DemoPass123!', 12); await pool.query('INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING', ['demo@cipherlink.local', password, 'Demo User']); console.log('Seeded demo@cipherlink.local'); await pool.end(); }
main().catch(error => { console.error(error); process.exit(1); });
