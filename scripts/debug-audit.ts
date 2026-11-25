// scripts/debug-audit.ts
// Simple script to fetch the latest completed audit and output premium keys presence
import path from 'path';
import { getDb } from '@/lib/db';
import { audits } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const rows = await db.select().from(audits).where(eq(audits.auditStatus, 'COMPLETED')).orderBy(desc(audits.createdAt)).limit(1);
  if (!rows.length) {
    console.log('No completed audits found');
    return;
  }
  const audit = rows[0];
  console.log('Audit ID:', audit.id);
  console.log('Report version:', audit.reportVersion);
  if (!audit.reportJson) {
    console.log('No reportJson stored');
    return;
  }
  try {
    const report = JSON.parse(audit.reportJson);
    const premiumKeys = ['demoWalkthrough', 'draftAssets', 'visitorJourney', 'quickWins', 'pilotProposal'];
    premiumKeys.forEach((k) => {
      const present = report[k] ? 'present' : 'missing';
      console.log(`${k}: ${present}`);
    });
  } catch (e) {
    console.error('Failed to parse reportJson', e);
  }
}

main().catch((e) => {
  console.error('Error running debug script', e);
  process.exit(1);
});

