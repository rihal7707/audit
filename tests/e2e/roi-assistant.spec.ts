import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const VERIFICATION_DIR = path.resolve(process.cwd(), 'verification');

test.describe('ROI Simulator & Ask Your Audit Verification', () => {
  test.beforeAll(() => {
    fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
  });

  test('landing & sample-report render ROI Simulator, Contents rail, and Assistant Side Panel at 1440px and 390px', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (text.includes('kaspersky-labs.com')) return;
      consoleErrors.push(text);
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    // Landing at 1440 & 390
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Understand the Financial Impact of AI/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Your Personal AI Business Consultant/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `Landing overflow at ${width}px`).toBe(false);
      await page.screenshot({ path: path.join(VERIFICATION_DIR, `landing-${width}.png`), fullPage: false });
    }

    // Sample report at 1440px (docked panel visible)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/sample-report');

    const nav = page.getByRole('navigation', { name: 'Report sections' });
    await expect(nav).toBeVisible();
    const tocItems = await nav.locator('a, button').allInnerTexts();
    console.log('RENDERED_TOC_ITEMS:', JSON.stringify(tocItems));
    expect(tocItems.some((t) => /ROI Simulator/i.test(t))).toBe(true);
    expect(tocItems.some((t) => /Ask Your AI Consultant/i.test(t))).toBe(true);

    await expect(page.getByRole('heading', { name: /Calculate Your Automation Potential/i })).toBeVisible();
    const dockedAside = page.locator('aside[aria-label="Ask Your AI Business Consultant"]');
    await expect(dockedAside).toBeVisible();
    await expect(dockedAside.getByText('Ask Your AI Business Consultant')).toBeVisible();

    // Move/change ROI input and assert output changes
    const hoursTextBefore = await page.locator('#roi').innerText();
    expect(hoursTextBefore).toContain('50.00 hrs');
    await page.locator('#roi-admin-tasks').fill('1000');
    await expect(page.locator('#roi')).toContainText('90.00 hrs');

    // Click a sample assistant chip and assert answer returns with live updated ROI
    await dockedAside.getByRole('button', { name: /Reclaimable admin time/i }).click();
    await expect(dockedAside).toContainText('80.00 hours/month');
    await expect(dockedAside).toContainText('90.00 hours/month');

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(desktopOverflow, 'Sample report overflow at 1440px').toBe(false);
    await page.screenshot({ path: path.join(VERIFICATION_DIR, 'sample-report-1440.png'), fullPage: false });

    // Sample report at 390px (floating button visible & bottom sheet opens)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/sample-report');
    const floatBtn = page.getByRole('button', { name: /Ask your audit/i });
    await expect(floatBtn).toBeVisible();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(mobileOverflow, 'Sample report overflow at 390px').toBe(false);
    await page.screenshot({ path: path.join(VERIFICATION_DIR, 'sample-report-390.png'), fullPage: false });

    await floatBtn.click();
    const mobileDialog = page.getByRole('dialog', { name: /Ask Your AI Business Consultant/i });
    await expect(mobileDialog).toBeVisible();
    await mobileDialog.getByRole('button', { name: /Biggest opportunity/i }).click();
    await expect(mobileDialog).toContainText('Instant Missed-Call Recovery');
    await page.screenshot({ path: path.join(VERIFICATION_DIR, 'sample-report-mobile-chat-390.png'), fullPage: false });

    expect(consoleErrors).toEqual([]);
  });
});
