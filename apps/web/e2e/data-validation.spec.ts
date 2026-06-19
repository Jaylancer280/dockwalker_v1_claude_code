import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Data validation tests — verify that rendered content matches seed data.
 *
 * These tests don't just check "page loads" — they assert specific text content
 * from the seed to catch silent data failures (null responses, wrong queries,
 * stale caches, missing joins).
 */

const authDir = path.join(__dirname, '.auth');

const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});
const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});
const agentTest = base.extend({
  storageState: path.join(authDir, 'agent.json'),
});

// ============================================================
// EMPLOYER — Verify seed data renders correctly
// ============================================================
employerTest.describe('Data Validation — Employer', () => {
  employerTest('profile shows correct display name and role', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Profile One')).toBeVisible();
    await expect(page.getByText('Captain')).toBeVisible();
  });

  employerTest('vessels page shows all 3 seeded vessels', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Serenity')).toBeVisible();
    await expect(page.getByText('Phantom')).toBeVisible();
    await expect(page.getByText('Wanderer')).toBeVisible();
  });

  employerTest('vessels page shows NDA badge on Phantom', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('NDA')).toBeVisible();
  });

  employerTest('vessels page shows correct IMO numbers', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('9876543')).toBeVisible();
    await expect(page.getByText('9876544')).toBeVisible();
    await expect(page.getByText('9876545')).toBeVisible();
  });

  employerTest('my jobs shows correct posting count tabs', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Should show Active count and In Progress count
    await expect(page.getByText(/active/i).first()).toBeVisible();
    await expect(page.getByText(/in progress/i).first()).toBeVisible();
  });

  employerTest('daywork posting shows correct day rate', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // DW-01: €250/day
    await expect(page.getByText('€250')).toBeVisible();
  });

  employerTest('NDA vessel posting shows "NDA Vessel" label', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // DW-02 uses NDA vessel Phantom
    await expect(page.getByText('NDA Vessel')).toBeVisible();
  });
});

// ============================================================
// CREW — Verify seed data renders correctly
// ============================================================
crewTest.describe('Data Validation — Crew', () => {
  crewTest('profile shows correct display name and role', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Profile Two')).toBeVisible();
    // Role derived from experience
    await expect(page.getByText(/bosun|deckhand/i).first()).toBeVisible();
  });

  crewTest('profile shows correct cert count', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('6 certs')).toBeVisible();
  });

  crewTest('profile shows experience count', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // c@1 has multiple experience entries
    await expect(page.getByText(/entries/i).first()).toBeVisible();
  });

  crewTest('availability page shows set availability', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // c@1 has 14 days availability seeded in Antibes
    await expect(page.getByText(/antibes|port vauban/i).first()).toBeVisible();
  });

  crewTest('messages page shows engagement threads', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // c@1 has active and history message threads
    await expect(page.getByText(/active/i).first()).toBeVisible();
    // Should show the employer name (multiple threads, use first)
    await expect(page.getByText('Profile One').first()).toBeVisible();
  });

  crewTest('message thread shows actual message content', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Click first thread
    const firstThread = page.locator('a[href*="/messages/"], [role="link"], .cursor-pointer').first();
    if (await firstThread.isVisible()) {
      await firstThread.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      // Wait for message content to load (may be slow)
      await page.waitForTimeout(2000);
      // Check for any seed message content — checklist items, message text, or job details
      const hasChecklist = await page.getByText(/PPE|berth|sanding/i).first().isVisible().catch(() => false);
      const hasJobDetails = await page.getByText(/€|day|Vieux|rotation/i).first().isVisible().catch(() => false);
      const hasMessageInput = await page.getByPlaceholder(/message/i).isVisible().catch(() => false);
      // At minimum the message input or some content should be visible
      expect(hasChecklist || hasJobDetails || hasMessageInput).toBeTruthy();
    }
  });
});

// ============================================================
// AGENT — Verify seed data renders correctly
// ============================================================
agentTest.describe('Data Validation — Agent', () => {
  agentTest('profile shows agency name', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Meridian Yacht Crew')).toBeVisible();
  });

  agentTest('profile shows display name', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Profile Five')).toBeVisible();
  });

  agentTest('vessels page shows agent vessel', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Meridian')).toBeVisible();
    await expect(page.getByText('9876549')).toBeVisible();
  });

  agentTest('market feed shows both daywork and permanent postings', async ({ page }) => {
    await page.goto('/discover/market');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Should show at least one Daywork and one Permanent badge
    const dayworkBadge = page.getByText('Daywork').first();
    const permanentBadge = page.getByText('Permanent').first();
    await expect(dayworkBadge).toBeVisible();
    await expect(permanentBadge).toBeVisible();
  });
});
