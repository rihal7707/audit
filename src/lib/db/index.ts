import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { getEnv } from '@/lib/env';

export type AppDb = LibSQLDatabase<typeof schema>;

let singletonClient: Client | null = null;
let singletonDb: AppDb | null = null;
let singletonPragmaPromise: Promise<void> | null = null;

function isPersistentFileDb(databaseUrl: string): boolean {
  if (!databaseUrl.startsWith('file:')) return false;
  const rawPath = databaseUrl.slice('file:'.length).split('?')[0] ?? '';
  return Boolean(rawPath) && rawPath !== ':memory:';
}

export function getDatabaseMode(databaseUrl?: string): 'remote-libsql' | 'memory' | 'local-file' {
  const url = databaseUrl ?? getEnv().DATABASE_URL;
  if (!url.startsWith('file:')) return 'remote-libsql';
  return isPersistentFileDb(url) ? 'local-file' : 'memory';
}

async function applySqlitePragmas(client: Client): Promise<void> {
  try {
    await client.execute('PRAGMA busy_timeout = 5000;');
    await client.execute('PRAGMA journal_mode = WAL;');
    await client.execute('PRAGMA synchronous = NORMAL;');
  } catch {
    // Ignore pragma errors on constrained drivers/test doubles
  }
}

function ensureLocalFileDirectory(databaseUrl: string): void {
  if (!databaseUrl.startsWith('file:')) return;
  const rawPath = databaseUrl.slice('file:'.length).split('?')[0] ?? '';
  if (!rawPath || rawPath === ':memory:') return;
  if (process.env.VERCEL === '1') {
    throw new Error(
      'DATABASE_URL points to a local SQLite file, which is unsupported on Vercel read-only serverless storage. Configure a hosted libSQL/Turso DATABASE_URL and DATABASE_AUTH_TOKEN.',
    );
  }
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createLibsqlClient(databaseUrl?: string, authToken?: string): Client {
  const env = getEnv();
  const url = databaseUrl ?? env.DATABASE_URL;
  const token = authToken ?? env.DATABASE_AUTH_TOKEN;

  ensureLocalFileDirectory(url);

  return createClient({
    url,
    authToken: token,
  });
}

export function getDbClient(): Client {
  if (!singletonClient) {
    const env = getEnv();
    singletonClient = createLibsqlClient(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);
    if (isPersistentFileDb(env.DATABASE_URL)) {
      singletonPragmaPromise = applySqlitePragmas(singletonClient);
    }
  }
  return singletonClient;
}

export async function ensureDbReady(): Promise<void> {
  getDbClient();
  if (singletonPragmaPromise) {
    await singletonPragmaPromise;
  }
}

export function getDb(): AppDb {
  if (!singletonDb) {
    const client = getDbClient();
    singletonDb = drizzle(client, { schema });
  }
  return singletonDb;
}

export function setTestDb(client: Client): AppDb {
  singletonClient = client;
  singletonPragmaPromise = null;
  singletonDb = drizzle(client, { schema });
  return singletonDb;
}

export function resetDbForTesting(): void {
  singletonClient = null;
  singletonPragmaPromise = null;
  singletonDb = null;
}
