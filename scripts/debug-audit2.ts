// scripts/debug-audit2.ts
// Direct DB query without path alias
import { createLibsqlClient } from '../src/lib/db';
import * as schema from '../src/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

async function main() {
  const client = createLibsqlClient();
  const db = drizzle(client, { schema });
  const rows = await db
    .select()
    .from(schema.audits)
    .where(eq(schema.audits.auditStatus, 'COMPLETED'))
    .orderBy(desc(schema.audits.createdAt))
    .limit(1);
  if (!rows.length) {
    console.log('No completed audits found');
    return;
  }
  const audit = rows[0]!;
  console.log('Audit ID:', audit.id);
  console.log('Report JSON length:', audit.reportJson?.length ?? 0);
  if (audit.reportJson) {
    try {
      const report = JSON.parse(audit.reportJson);
      const premiumKeys = ['demoWalkthrough', 'draftAssets', 'visitorJourney', 'quickWins', 'pilotProposal'];
      for (const k of premiumKeys) {
        console.log(`${k}: ${report[k] ? 'present' : 'missing'}`);
      }
    } catch (e) {
      console.error('Failed to parse reportJson', e);
    }
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

