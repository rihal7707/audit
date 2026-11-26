// scripts/migrate-prod.mjs
// Applies committed Drizzle migrations against the hosted libSQL database defined in .env.vercel.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const envPath = path.resolve(process.cwd(), '.env.vercel');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.vercel. Run `cp .env.vercel.example .env.vercel` and set hosted DB credentials first.');
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const idx = t.indexOf('=');
  env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
}

const url = env.DATABASE_URL || env.TURSO_DATABASE_URL || '';
const authToken = env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || '';

if (!url || url.startsWith('file:')) {
  console.error('REFUSED: .env.vercel DATABASE_URL is missing or points to a local file: URL.');
  process.exit(1);
}
if (!authToken) {
  console.error('REFUSED: .env.vercel DATABASE_AUTH_TOKEN (or TURSO_AUTH_TOKEN) is missing.');
  process.exit(1);
}

const client = createClient({ url, authToken });
try {
  await migrate(drizzle(client), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  const tablesRes = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tableNames = tablesRes.rows.map((r) => String(r.name));
  console.log('Production migrations applied successfully.');
  console.log('Tables:', tableNames.join(', '));
} finally {
  client.close();
}
