import { test, expect } from '@playwright/test';

/**
 * Employer tests — logged in as e@1 (employer hat, Captain, has vessels + postings)
 */

test.describe('Employer — Hat Routing', () => {
  test('dashboard redirects employer to /daywork/mine', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/daywork\/mine/, { timeout: 10_000 });
    expect(page.url()).toContain('/daywork/mine');
  });

  test('/ redirects employer to /daywork/mine', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/daywork\/mine/, { timeout: 10_000 });
    expect(page.url()).toContain('/daywork/mine');
  });
});

test.describe('Employer — My Daywork', () => {
  test('daywork/mine loads and shows postings', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — daywork/mine page', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-daywork-mine.png', { fullPage: true });
  });
});

test.describe('Employer — Post Job', () => {
  test('daywork/post loads with position type selector', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('What type of position?')).toBeVisible();
    await expect(page.getByText('Daywork')).toBeVisible();
    await expect(page.getByText('Permanent')).toBeVisible();
  });

  test('visual — daywork/post type selector', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-daywork-post.png', { fullPage: true });
  });
});

test.describe('Employer — Vessels', () => {
  test('vessels page loads', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — vessels page', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-vessels.png', { fullPage: true });
  });
});

test.describe('Employer — Profile', () => {
  test('profile page loads', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-profile.png', { fullPage: true });
  });
});

test.describe('Employer — Settings', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-settings.png', { fullPage: true });
  });
});

test.describe('Employer — Billing', () => {
  test('billing page loads', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — billing page', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-billing.png', { fullPage: true });
  });
});

test.describe('Employer — Notifications', () => {
  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — notifications page', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-notifications.png', { fullPage: true });
  });
});

test.describe('Employer — Messages', () => {
  test('messages page loads', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — messages page', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-messages.png', { fullPage: true });
  });
});

test.describe('Employer — Docky AI', () => {
  test('docky page loads', async ({ page }) => {
    await page.goto('/docky');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — docky page', async ({ page }) => {
    await page.goto('/docky');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-docky.png', { fullPage: true });
  });
});
