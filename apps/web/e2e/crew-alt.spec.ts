import { test, expect } from '@playwright/test';

/**
 * Crew-alt tests — logged in as g@1 (crew hat, Stewardess, Palma/Ibiza, fewer certs)
 * Tests geographic differences, cert-gating, and reduced data scenarios.
 */

test.describe('Crew-Alt — Discover Feed (Different Location)', () => {
  test('discover page loads — may show different jobs than c@1', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — discover page (Palma user)', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-alt-discover.png', { fullPage: true });
  });
});

test.describe('Crew-Alt — Profile (Fewer Certs)', () => {
  test('profile page loads with minimal cert data', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — profile page (fewer certs)', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-alt-profile.png', { fullPage: true });
  });
});

test.describe('Crew-Alt — Availability (No Availability Set)', () => {
  test('availability page loads', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — availability page (empty state)', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-alt-availability.png', { fullPage: true });
  });
});

test.describe('Crew-Alt — Messages (No Engagements)', () => {
  test('messages page loads — should show empty state', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — messages empty state', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-alt-messages.png', { fullPage: true });
  });
});
