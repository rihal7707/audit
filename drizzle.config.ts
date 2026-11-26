import { defineConfig } from 'drizzle-kit';

const url =
  process.env.TURSO_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  'file:./data/amarketing.db';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url,
  },
});

