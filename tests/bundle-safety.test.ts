import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function walkFiles(dir: string, extRegex: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extRegex));
    } else if (extRegex.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Client Bundle Secret & Server-Only Boundary Guard', () => {
  it('never accesses server secrets in client components or NEXT_PUBLIC vars', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const files = walkFiles(srcRoot, /\.(ts|tsx)$/);

    const forbiddenEnvAccess = [
      'process.env.GEMINI_API_KEY',
      'process.env.ADMIN_PASSWORD',
      'process.env.ADMIN_PASSWORD_HASH',
      'process.env.ADMIN_SESSION_SECRET',
      'process.env.CRON_SECRET',
      'process.env.DATABASE_AUTH_TOKEN',
      'process.env.RESEND_API_KEY',
      'process.env.TURNSTILE_SECRET_KEY',
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const isClientComponent = /^['"]use client['"];?/m.test(content.slice(0, 200));
      if (isClientComponent) {
        for (const pattern of forbiddenEnvAccess) {
          expect(content, `${path.relative(srcRoot, file)} contains ${pattern}`).not.toContain(
            pattern,
          );
        }
        expect(content).not.toMatch(/\b(?:AIza[0-9A-Za-z_-]{10,}|AQ\.Ab[0-9A-Za-z_-]{10,})/);
        expect(content).not.toMatch(
          /from\s+['"]@\/lib\/(?:env|db|pipeline|ai\/gemini-client|security\/safe-fetch|security\/url-guard|security\/admin-auth)['"]/,
        );
      }

      // Nowhere in src/ should NEXT_PUBLIC_ expose any secret
      expect(content).not.toMatch(/NEXT_PUBLIC_.*(?:GEMINI|SECRET|PASSWORD|TOKEN|RESEND)/);
    }
  });

  it('if production client chunks exist, verifies no API key patterns leaked into static JS bundles', () => {
    const chunksDir = path.resolve(process.cwd(), '.next/static/chunks');
    if (!fs.existsSync(chunksDir)) return;
    const jsFiles = walkFiles(chunksDir, /\.js$/);
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/\bAIza[0-9A-Za-z_-]{20,}\b/);
      expect(content).not.toMatch(/\bAQ\.Ab[0-9A-Za-z_-]{20,}\b/);
      expect(content).not.toContain('process.env.GEMINI_API_KEY');
    }
  });
});
