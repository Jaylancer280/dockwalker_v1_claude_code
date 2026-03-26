import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Cross-route consistency tests.
 *
 * These tests compare UI patterns between sibling routes that serve the same
 * purpose in different contexts. The goal is to catch visual divergence where
 * the same data/interaction should use the same component.
 *
 * Categories:
 *   1. Form consistency — daywork vs permanent post forms
 *   2. Profile consistency — crew vs employer vs agent profile sections
 *   3. Empty state consistency — same empty states across roles
 *   4. Navigation consistency — bottom nav across roles
 *   5. Page layout consistency — common pages across roles (settings, billing, etc.)
 */

const authDir = path.join(__dirname, '.auth');

// ============================================================
// 1. FORM CONSISTENCY — Daywork vs Permanent post forms
//    Both accessed by employer, same route entry (/daywork/post)
// ============================================================
const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});

employerTest.describe('Form Consistency — Daywork vs Permanent', () => {
  employerTest('daywork form — cert and language section', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');

    // Select "Daywork" to enter daywork form
    await page.getByText('Daywork').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Scroll to the cert/language section and screenshot
    const certLabel = page.getByText('Required certifications').first();
    if (await certLabel.isVisible()) {
      await certLabel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await expect(page).toHaveScreenshot('form-daywork-certs-langs.png', { fullPage: true });
  });

  employerTest('permanent form — cert and language section', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');

    // Select "Permanent" to enter permanent form
    await page.getByText('Permanent').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Scroll to the cert/language section and screenshot
    const certLabel = page.getByText('Required certifications').first();
    if (await certLabel.isVisible()) {
      await certLabel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await expect(page).toHaveScreenshot('form-permanent-certs-langs.png', { fullPage: true });
  });

  employerTest('daywork form — role and location selectors', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.getByText('Daywork').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('form-daywork-top.png', { fullPage: false });
  });

  employerTest('permanent form — role and location selectors', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.getByText('Permanent').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('form-permanent-top.png', { fullPage: false });
  });
});

// ============================================================
// 2. PROFILE CONSISTENCY — Same sections across roles
// ============================================================
const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});
const crewAltTest = base.extend({
  storageState: path.join(authDir, 'crew-alt.json'),
});
const agentTest = base.extend({
  storageState: path.join(authDir, 'agent.json'),
});

employerTest.describe('Profile Consistency — Employer', () => {
  employerTest('employer profile layout', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('profile-employer.png', { fullPage: true });
  });
});

crewTest.describe('Profile Consistency — Crew', () => {
  crewTest('crew profile layout', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('profile-crew.png', { fullPage: true });
  });
});

crewAltTest.describe('Profile Consistency — Crew Alt (green)', () => {
  crewAltTest('crew-alt profile layout', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('profile-crew-alt.png', { fullPage: true });
  });
});

agentTest.describe('Profile Consistency — Agent', () => {
  agentTest('agent profile layout', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('profile-agent.png', { fullPage: true });
  });
});

// ============================================================
// 3. EMPTY STATE CONSISTENCY — Same empty states across roles
// ============================================================
employerTest.describe('Empty State Consistency — Employer', () => {
  employerTest('employer notifications empty state', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('empty-notifications-employer.png', { fullPage: true });
  });
});

crewTest.describe('Empty State Consistency — Crew', () => {
  crewTest('crew notifications empty state', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('empty-notifications-crew.png', { fullPage: true });
  });
});

crewAltTest.describe('Empty State Consistency — Crew Alt', () => {
  crewAltTest('crew-alt messages empty state', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('empty-messages-crew-alt.png', { fullPage: true });
  });
});

agentTest.describe('Empty State Consistency — Agent', () => {
  agentTest('agent messages empty state', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('empty-messages-agent.png', { fullPage: true });
  });

  agentTest('agent notifications empty state', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('empty-notifications-agent.png', { fullPage: true });
  });
});

// ============================================================
// 4. NAVIGATION CONSISTENCY — Bottom nav across roles
//    Screenshot just the bottom nav area for each role
// ============================================================
employerTest.describe('Bottom Nav Consistency — Employer', () => {
  employerTest('employer bottom nav', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const nav = page.locator('nav').last();
    await expect(nav).toHaveScreenshot('nav-employer.png');
  });
});

crewTest.describe('Bottom Nav Consistency — Crew', () => {
  crewTest('crew bottom nav', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const nav = page.locator('nav').last();
    await expect(nav).toHaveScreenshot('nav-crew.png');
  });
});

agentTest.describe('Bottom Nav Consistency — Agent', () => {
  agentTest('agent bottom nav', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const nav = page.locator('nav').last();
    await expect(nav).toHaveScreenshot('nav-agent.png');
  });
});

// ============================================================
// 5. SHARED PAGES CONSISTENCY — Settings, Billing across roles
//    These pages should look identical regardless of role
// ============================================================
employerTest.describe('Settings Page — Employer', () => {
  employerTest('employer settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('settings-employer.png', { fullPage: true });
  });
});

crewTest.describe('Settings Page — Crew', () => {
  crewTest('crew settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('settings-crew.png', { fullPage: true });
  });
});

agentTest.describe('Settings Page — Agent', () => {
  agentTest('agent settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('settings-agent.png', { fullPage: true });
  });
});

employerTest.describe('Billing Page — Employer', () => {
  employerTest('employer billing', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('billing-employer.png', { fullPage: true });
  });
});

crewTest.describe('Billing Page — Crew', () => {
  crewTest('crew billing', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('billing-crew.png', { fullPage: true });
  });
});

agentTest.describe('Billing Page — Agent', () => {
  agentTest('agent billing', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('billing-agent.png', { fullPage: true });
  });
});
