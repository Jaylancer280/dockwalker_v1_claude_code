import { test as setup } from '@playwright/test';
import path from 'path';

/**
 * Auth setup — logs in each test user and saves session state.
 * Playwright reuses these stored sessions so we don't log in per test.
 */

const USERS = [
  { name: 'employer', email: 'e@1', password: '87654321' },
  { name: 'crew', email: 'c@1', password: '87654321' },
  { name: 'crew-alt', email: 'g@1', password: '87654321' },
  { name: 'agent', email: 'a@1', password: '87654321' },
  { name: 'unboarded', email: 'd@1', password: '87654321' },
] as const;

for (const user of USERS) {
  setup(`authenticate ${user.name} (${user.email})`, async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/^password$/i).fill(user.password);
    await page.locator('form button[type="submit"], form button:has-text("Log in"), form button:has-text("Sign in")').first().click();

    if (user.name === 'unboarded') {
      // Unboarded user redirects to onboarding
      await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    } else {
      // Onboarded users land on their hat-appropriate page
      await page.waitForURL(/\/(discover|daywork\/mine|discover\/market)/, { timeout: 15_000 });
    }

    const storagePath = path.join(__dirname, `.auth/${user.name}.json`);
    await page.context().storageState({ path: storagePath });
  });
}
