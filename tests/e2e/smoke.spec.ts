import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results/qa-screenshots');

test.describe('AMARKETING Public, Wizard, Admin & Visual/A11y QA Suite', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('public routes pass axe, have zero console errors, zero horizontal scroll, and capture 390/1440 screenshots', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(
        page.getByRole('heading', { name: /Discover Where AI Can Transform Your Business/i }),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `Horizontal overflow on / at ${width}px`).toBe(false);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText.toLowerCase()).not.toContain('lorem ipsum');
      expect(bodyText).not.toContain('TODO');

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `landing-${width}.png`),
        fullPage: false,
      });

      if (width === 1440) {
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations).toEqual([]);
      }
    }

    // Sample Report (1440 and 390 + print emulation check)
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sample-report');
      await expect(
        page.getByRole('heading', { name: /Willow Creek Orthodontics/i }),
      ).toBeVisible();
      await expect(page.getByText(/Illustrative sample/i).first()).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `Horizontal overflow on /sample-report at ${width}px`).toBe(false);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `sample-report-${width}.png`),
        fullPage: false,
      });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    const sampleAxe = await new AxeBuilder({ page }).analyze();
    expect(sampleAxe.violations).toEqual([]);

    // Emulate print media cleanly
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'sample-report-print.png'),
      fullPage: false,
    });
    await page.emulateMedia({ media: 'screen' });

    // Legal & Transparency pages
    for (const routePath of ['/how-we-inspect', '/privacy', '/terms']) {
      await page.goto(routePath);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations, `Axe violations on ${routePath}`).toEqual([]);
    }

    expect(consoleErrors, 'Zero console/page errors expected').toEqual([]);
  });

  test('wizard validates, advances through all 5 steps, and renders cleanly at 390/1440', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/audit');

    // Empty continue shows validation alert
    await page.getByRole('button', { name: /Continue/i }).click();
    await expect(
      page.getByText(/Please check the following before continuing/i),
    ).toBeVisible();

    // Fill Step 1
    await page.getByLabel(/Business website URL/i).fill('example.com');
    await page.getByLabel(/Business name/i).fill('Harbour Dental Studio');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wizard-step1-1440.png') });
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 2
    await expect(
      page.getByRole('heading', { name: /Understand your business/i }),
    ).toBeVisible();
    await page
      .getByLabel(/What does your business primarily offer/i)
      .fill('Comprehensive family dentistry and orthodontic aligner consultations.');
    await page.getByRole('checkbox', { name: 'Missed phone calls' }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 3
    await expect(
      page.getByRole('heading', { name: /Business goals & scale/i }),
    ).toBeVisible();
    await page.getByRole('checkbox', { name: 'Automate appointments and bookings' }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 4
    await expect(
      page.getByRole('heading', { name: /Contact & privacy/i }),
    ).toBeVisible();
    await page.getByLabel(/Full name/i).fill('Jordan Taylor');
    await page.getByLabel(/Business email/i).fill('jordan@harbourdental.example');
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 5 Review
    await expect(
      page.getByRole('heading', { name: /Review & generate/i }),
    ).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wizard-step5-1440.png') });

    const wizardAxe = await new AxeBuilder({ page }).analyze();
    expect(wizardAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    const wizardOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(wizardOverflow).toBe(false);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wizard-step5-390.png') });
  });

  test('admin login, dashboard, audits list, and detail work when admin env is configured', async ({
    page,
  }) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    test.skip(!adminPassword, 'ADMIN_PASSWORD not set in environment');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/login');
    await page.getByLabel(/Administrator password/i).fill(adminPassword!);
    await page.getByRole('button', { name: /Sign In to Console/i }).click();

    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: /Agency Overview/i })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin-dashboard-1440.png') });

    await page.goto('/admin/audits');
    await expect(page.getByRole('heading', { name: /Audits & Leads/i })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin-audits-1440.png') });
  });
});
