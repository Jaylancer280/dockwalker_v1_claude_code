import { test, expect } from '@playwright/test';

/**
 * Onboarding tests — logged in as d@1 (unboarded user, no person/profile row)
 * Tests that unonboarded users are gated from the app.
 */

test.describe('Unboarded User — Onboarding Gate', () => {
  test('landing redirects to /onboarding', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
  });

  test('dashboard redirects to /onboarding', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
  });

  test('discover redirects to /onboarding', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
  });

  test('profile redirects to /onboarding', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
  });

  test('settings redirects to /onboarding', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
  });

  test('vessels redirects to /onboarding', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
  });
});

test.describe('Unboarded User — Onboarding Page', () => {
  test('onboarding page loads with form/steps', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — onboarding page', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('onboarding.png', { fullPage: true });
  });
});
