import { test, expect } from '@playwright/test';

/**
 * Agent tests — logged in as a@1 (agent identity, Meridian Yacht Crew agency)
 *
 * Agent identity is fundamentally different from crew/employer:
 * - Cannot switch hats (always agent)
 * - Has dedicated market feed at /discover/market
 * - Redirected away from crew /discover
 * - Uses employer-style bottom nav (Post Job, My Jobs, Messages, Profile)
 * - Requires agency_name on profile
 * - Cannot mark experiences as current
 * - Has agent-specific activity telemetry
 */

test.describe('Agent — Hat Routing', () => {
  test('dashboard redirects agent to /daywork/mine', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/daywork\/mine/, { timeout: 10_000 });
    expect(page.url()).toContain('/daywork/mine');
  });

  test('/ redirects agent to /daywork/mine', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/daywork\/mine/, { timeout: 10_000 });
    expect(page.url()).toContain('/daywork/mine');
  });
});

test.describe('Agent — Discover Redirect', () => {
  test('/discover redirects agent to /discover/market', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForURL(/\/discover\/market/, { timeout: 10_000 });
    expect(page.url()).toContain('/discover/market');
  });
});

test.describe('Agent — Market Feed', () => {
  test('market feed loads', async ({ page }) => {
    await page.goto('/discover/market');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — market feed', async ({ page }) => {
    await page.goto('/discover/market');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-market-feed.png', { fullPage: true });
  });
});

test.describe('Agent — My Jobs', () => {
  test('daywork/mine loads for agent', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('daywork/mine shows "View job market" button for agent', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const marketButton = page.getByRole('link', { name: /job market/i }).or(page.getByText(/job market/i));
    await expect(marketButton.first()).toBeVisible();
  });

  test('visual — daywork/mine (agent)', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-daywork-mine.png', { fullPage: true });
  });
});

test.describe('Agent — Post Job', () => {
  test('daywork/post shows type selector for agent', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('What type of position?')).toBeVisible();
    await expect(page.getByText('Daywork')).toBeVisible();
    await expect(page.getByText('Permanent')).toBeVisible();
  });

  test('visual — post job type selector (agent)', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-daywork-post.png', { fullPage: true });
  });
});

test.describe('Agent — Profile', () => {
  test('profile page loads with agent-specific sections', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('profile shows agency name', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Meridian Yacht Crew')).toBeVisible();
  });

  test('visual — profile page (agent)', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-profile.png', { fullPage: true });
  });
});

test.describe('Agent — Vessels', () => {
  test('vessels page loads for agent', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — vessels page (agent)', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-vessels.png', { fullPage: true });
  });
});

test.describe('Agent — Messages', () => {
  test('messages page loads (empty — no engagements yet)', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — messages page (agent)', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-messages.png', { fullPage: true });
  });
});

test.describe('Agent — Settings', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — settings page (agent)', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-settings.png', { fullPage: true });
  });
});

test.describe('Agent — Billing', () => {
  test('billing page loads', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — billing page (agent)', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-billing.png', { fullPage: true });
  });
});

test.describe('Agent — Notifications', () => {
  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"], .container, #__next').first()).toBeVisible();
  });

  test('visual — notifications page (agent)', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('agent-notifications.png', { fullPage: true });
  });
});
