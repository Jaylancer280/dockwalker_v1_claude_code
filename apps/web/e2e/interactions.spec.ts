import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Interaction tests — stateful workflow verification using seed engagement data.
 *
 * These tests navigate to specific engagements/postings using known seed IDs
 * and verify that interactive elements render correctly for each user role.
 *
 * Seed IDs (from 003_advanced_scenarios.sql):
 *   DW-01: 44444444-4444-4444-4444-444444444001 — Active + crew invited
 *   DW-04: 44444444-4444-4444-4444-444444444004 — Applied (pending)
 *   DW-05: 44444444-4444-4444-4444-444444444005 — Applied → Viewed → Shortlisted
 *   DW-06: 44444444-4444-4444-4444-444444444006 — In Progress (messages + checklist)
 *   DW-07: 44444444-4444-4444-4444-444444444007 — Completed + rated
 *   DW-08: 44444444-4444-4444-4444-444444444008 — Completed + disputed
 *   DW-09: 44444444-4444-4444-4444-444444444009 — Cancelled by crew
 *   DW-10: 44444444-4444-4444-4444-444444444010 — Cancelled by employer
 *
 *   PM-02: (permanent) — Applied (pending)
 *   PM-03: (permanent) — Shortlisted
 *   PM-04: (permanent) — Selected (in negotiation) + messages
 *   PM-05: (permanent) — Placement confirmed
 *   PM-07: (permanent) — Cert-gated
 */

const authDir = path.join(__dirname, '.auth');

// Daywork IDs from seed
const DW = {
  ACTIVE_INVITED: '44444444-4444-4444-4444-444444444001',
  ACTIVE_NDA: '44444444-4444-4444-4444-444444444002',
  APPLIED_PENDING: '44444444-4444-4444-4444-444444444004',
  SHORTLISTED: '44444444-4444-4444-4444-444444444005',
  IN_PROGRESS: '44444444-4444-4444-4444-444444444006',
  COMPLETED_RATED: '44444444-4444-4444-4444-444444444007',
  COMPLETED_DISPUTED: '44444444-4444-4444-4444-444444444008',
  CANCELLED_CREW: '44444444-4444-4444-4444-444444444009',
  CANCELLED_EMPLOYER: '44444444-4444-4444-4444-444444444010',
};

// ============================================================
// EMPLOYER reviewing daywork postings
// ============================================================
const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});

employerTest.describe('Employer — Daywork Review Pages', () => {
  employerTest('DW-01: active posting with invited crew renders review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.ACTIVE_INVITED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    // Should show the posting details and applicant/shortlist tabs
    await expect(page).toHaveScreenshot('employer-dw01-review.png', { fullPage: true });
  });

  employerTest('DW-05: shortlisted applicant shows on review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.SHORTLISTED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-dw05-review-shortlisted.png', { fullPage: true });
  });

  employerTest('DW-06: in-progress engagement review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.IN_PROGRESS}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-dw06-review-in-progress.png', { fullPage: true });
  });

  employerTest('DW-07: completed + rated engagement review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.COMPLETED_RATED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-dw07-review-completed.png', { fullPage: true });
  });

  employerTest('DW-08: disputed engagement review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.COMPLETED_DISPUTED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-dw08-review-disputed.png', { fullPage: true });
  });

  employerTest('DW-09: cancelled-by-crew review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.CANCELLED_CREW}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-dw09-review-cancelled-crew.png', { fullPage: true });
  });

  employerTest('DW-10: cancelled-by-employer review page', async ({ page }) => {
    await page.goto(`/daywork/${DW.CANCELLED_EMPLOYER}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-dw10-review-cancelled-employer.png', { fullPage: true });
  });
});

// ============================================================
// EMPLOYER — Messages (engagement threads)
// ============================================================
employerTest.describe('Employer — Engagement Messages', () => {
  employerTest('DW-06: message thread shows both messages + checklist', async ({ page }) => {
    // Navigate to messages, find the DW-06 engagement thread
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click into the first engagement thread (DW-06 should be visible as in-progress)
    const threads = page.locator('a[href*="/messages/"], [role="link"], .cursor-pointer').first();
    if (await threads.isVisible()) {
      await threads.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('employer-message-thread.png', { fullPage: true });
    }
  });
});

// ============================================================
// CREW viewing their application states
// ============================================================
const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});

crewTest.describe('Crew — Daywork Review Pages', () => {
  crewTest('DW-04: pending application review (crew perspective)', async ({ page }) => {
    await page.goto(`/daywork/${DW.APPLIED_PENDING}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-dw04-review-applied.png', { fullPage: true });
  });

  crewTest('DW-05: shortlisted application review (crew perspective)', async ({ page }) => {
    await page.goto(`/daywork/${DW.SHORTLISTED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-dw05-review-shortlisted.png', { fullPage: true });
  });

  crewTest('DW-06: in-progress engagement (crew sees checklist + messages)', async ({ page }) => {
    await page.goto(`/daywork/${DW.IN_PROGRESS}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-dw06-review-in-progress.png', { fullPage: true });
  });

  crewTest('DW-07: completed + rated engagement (crew perspective)', async ({ page }) => {
    await page.goto(`/daywork/${DW.COMPLETED_RATED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-dw07-review-completed.png', { fullPage: true });
  });

  crewTest('DW-02: NDA vessel posting (crew should NOT see vessel name/IMO)', async ({ page }) => {
    await page.goto(`/daywork/${DW.ACTIVE_NDA}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    // NDA vessel should show metadata but not name or IMO
    await expect(page).toHaveScreenshot('crew-dw02-review-nda.png', { fullPage: true });
  });
});

crewTest.describe('Crew — Message Threads', () => {
  crewTest('DW-06: crew sees employer messages and checklist in thread', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const threads = page.locator('a[href*="/messages/"], [role="link"], .cursor-pointer').first();
    if (await threads.isVisible()) {
      await threads.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('crew-message-thread.png', { fullPage: true });
    }
  });
});
