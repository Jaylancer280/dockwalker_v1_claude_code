import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads and shows DockWalker branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DockWalker/i);
  });

  test('has sign-up and login links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /sign up/i }).or(page.getByRole('link', { name: /get started/i })).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();
  });

  test('landing page returns 2xx', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('visual — landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('landing.png', { fullPage: true });
  });
});

test.describe('Auth Pages', () => {
  test('login page loads with form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('visual — login page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
  });

  test('signup page loads with form', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('visual — signup page', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('signup.png', { fullPage: true });
  });

  test('forgot password page loads with form', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('visual — forgot password page', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('forgot-password.png', { fullPage: true });
  });
});

test.describe('Protected Routes Redirect', () => {
  test('dashboard redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/(auth\/login|auth\/signup|\?)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(auth\/login|auth\/signup)/);
  });

  test('discover redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForURL(/\/(auth\/login|auth\/signup|\?)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(auth\/login|auth\/signup)/);
  });

  test('profile redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/(auth\/login|auth\/signup|\?)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(auth\/login|auth\/signup)/);
  });

  test('messages redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForURL(/\/(auth\/login|auth\/signup|\?)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(auth\/login|auth\/signup)/);
  });
});
