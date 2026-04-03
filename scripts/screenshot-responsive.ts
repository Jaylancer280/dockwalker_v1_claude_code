/**
 * screenshot-responsive.ts
 *
 * One-shot Playwright script that captures screenshots of every route
 * at 375px (mobile), 768px (tablet), and 1440px (desktop) widths.
 *
 * Usage: npx tsx scripts/screenshot-responsive.ts
 *
 * Requires: playwright installed (npx playwright install chromium)
 * Output:   tmp/screenshots/{width}/{route-name}.png
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const WIDTHS = [375, 768, 1440] as const;
const HEIGHT = 900;

const PUBLIC_ROUTES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/auth/login' },
  { name: 'signup', path: '/auth/signup' },
  { name: 'forgot-password', path: '/auth/forgot-password' },
  { name: 'reset-password', path: '/auth/reset-password' },
];

const AUTH_ROUTES = [
  { name: 'discover', path: '/discover' },
  { name: 'messages', path: '/messages' },
  { name: 'profile', path: '/profile' },
  { name: 'settings', path: '/settings' },
  { name: 'notifications', path: '/notifications' },
  { name: 'billing', path: '/billing' },
  { name: 'vessels', path: '/vessels' },
  { name: 'docky', path: '/docky' },
  { name: 'daywork-post', path: '/daywork/post' },
  { name: 'daywork-mine', path: '/daywork/mine' },
];

// Seed crew credentials
const TEST_EMAIL = 'c@1.com';
const TEST_PASSWORD = 'password';

async function screenshot(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>,
  name: string,
  width: number,
) {
  const dir = join('tmp', 'screenshots', String(width));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  process.stdout.write(`  [${width}px] ${name}\n`);
}

async function main() {
  process.stdout.write(`Launching browser against ${BASE_URL}\n`);
  const browser = await chromium.launch({ headless: true });

  // Public routes
  process.stdout.write('\n--- Public routes ---');
  for (const route of PUBLIC_ROUTES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await screenshot(page, route.name, width);
      await page.close();
    }
  }

  // Authenticate
  process.stdout.write('\n--- Logging in ---');
  const authPage = await browser.newPage({ viewport: { width: 375, height: HEIGHT } });
  await authPage.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await authPage.waitForTimeout(1000);

  const emailInput = authPage.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = authPage.locator('input[type="password"], input[name="password"]').first();

  if (await emailInput.isVisible()) {
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    const submitBtn = authPage.locator('button[type="submit"]').first();
    await submitBtn.click();
    await authPage.waitForTimeout(3000);
    process.stdout.write('  Logged in\n');
  } else {
    process.stdout.write('  WARNING: Could not find login form\n');
  }

  // Save cookies for auth
  const storageState = await authPage.context().storageState();
  await authPage.close();

  // Authenticated routes
  process.stdout.write('\n--- Authenticated routes ---');
  for (const route of AUTH_ROUTES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: HEIGHT },
        storageState,
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await screenshot(page, route.name, width);
      await page.close();
      await ctx.close();
    }
  }

  await browser.close();
  process.stdout.write('\nDone! Screenshots saved to tmp/screenshots/');
}

main().catch((err) => {
  process.stderr.write(`Screenshot script failed: ${err}\n`);
  process.exit(1);
});
