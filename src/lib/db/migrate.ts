import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { createLibsqlClient, type AppDb } from './index';
import * as schema from './schema';

export async function runMigrations(targetDb?: AppDb): Promise<void> {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  if (targetDb) {
    await migrate(targetDb, { migrationsFolder });
    return;
  }
  const client = createLibsqlClient();
  try {
    await client.execute('PRAGMA foreign_keys = ON;');
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
  } finally {
    client.close();
  }
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  runMigrations()
    .then(() => {
      console.log('Database migrations applied successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

