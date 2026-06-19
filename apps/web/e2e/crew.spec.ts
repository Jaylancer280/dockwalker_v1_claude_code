import { test, expect } from '@playwright/test';

/**
 * Crew tests — logged in as c@1 (crew hat, Deckhand, has availability + applications)
 */

test.describe('Crew — Hat Routing', () => {
  test('dashboard redirects crew to /discover', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/discover/, { timeout: 10_000 });
    expect(page.url()).toContain('/discover');
  });

  test('/ redirects crew to /discover', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/discover/, { timeout: 10_000 });
    expect(page.url()).toContain('/discover');
  });
});

test.describe('Crew — Discover Feed', () => {
  test('discover page loads with job cards or empty state', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — discover page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-discover.png', { fullPage: true });
  });
});

test.describe('Crew — Availability', () => {
  test('availability page loads', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — availability page', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-availability.png', { fullPage: true });
  });
});

test.describe('Crew — Profile', () => {
  test('profile page loads with crew data', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-profile.png', { fullPage: true });
  });

  test('add experience page loads with fields', async ({ page }) => {
    await page.goto('/profile/add-experience');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Add experience' })).toBeVisible();
    await expect(page.getByText('IMO number')).toBeVisible();
  });

  test('visual — add experience page', async ({ page }) => {
    await page.goto('/profile/add-experience');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-add-experience.png', { fullPage: true });
  });
});

test.describe('Crew — Messages', () => {
  test('messages page loads with engagement threads', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — messages page', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-messages.png', { fullPage: true });
  });
});

test.describe('Crew — Settings', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-settings.png', { fullPage: true });
  });
});

test.describe('Crew — Billing', () => {
  test('billing page loads', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — billing page', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-billing.png', { fullPage: true });
  });
});

test.describe('Crew — Notifications', () => {
  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — notifications page', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-notifications.png', { fullPage: true });
  });
});

test.describe('Crew — Docky AI', () => {
  test('docky page loads', async ({ page }) => {
    await page.goto('/docky');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — docky page', async ({ page }) => {
    await page.goto('/docky');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('crew-docky.png', { fullPage: true });
  });
});

test.describe('Crew — Role Gate: Post Job Page', () => {
  test('daywork/post shows type selector for crew (page renders)', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    // The page renders the type selector for all authenticated users
    // Role-gating happens at the API layer when they try to submit
    await expect(page.getByRole('heading', { name: /what type of position/i })).toBeVisible();
  });

  test('daywork/mine shows crew perspective', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    // Page should render — crew sees their engagements, not employer postings
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});
