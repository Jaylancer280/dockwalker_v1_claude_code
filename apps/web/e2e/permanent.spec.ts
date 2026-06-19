import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Permanent hiring flow tests — the other half of the app.
 *
 * Covers all 7 permanent posting states from seed data (PM-01 through PM-07):
 *   PM-01: 55555555-5555-5555-5555-555555555001 — Active, no applicants
 *   PM-02: 55555555-5555-5555-5555-555555555002 — Applied (pending)
 *   PM-03: 55555555-5555-5555-5555-555555555003 — Shortlisted (NDA vessel)
 *   PM-04: 55555555-5555-5555-5555-555555555004 — Selected, in negotiation + messages
 *   PM-05: 55555555-5555-5555-5555-555555555005 — Placement confirmed + engagement closed
 *   PM-06: 55555555-5555-5555-5555-555555555006 — Cancelled by employer (NDA vessel)
 *   PM-07: 55555555-5555-5555-5555-555555555007 — Active, cert-gated (crew missing cert)
 */

const authDir = path.join(__dirname, '.auth');

const PM = {
  ACTIVE_NO_APPLICANTS: '55555555-5555-5555-5555-555555555001',
  APPLIED_PENDING: '55555555-5555-5555-5555-555555555002',
  SHORTLISTED_NDA: '55555555-5555-5555-5555-555555555003',
  IN_NEGOTIATION: '55555555-5555-5555-5555-555555555004',
  PLACEMENT_CONFIRMED: '55555555-5555-5555-5555-555555555005',
  CANCELLED: '55555555-5555-5555-5555-555555555006',
  CERT_GATED: '55555555-5555-5555-5555-555555555007',
};

// ============================================================
// EMPLOYER — Permanent review pages
// ============================================================
const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});

employerTest.describe('Employer — Permanent Review Pages', () => {
  employerTest('PM-01: active posting, no applicants', async ({ page }) => {
    await page.goto(`/permanent/${PM.ACTIVE_NO_APPLICANTS}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm01-active-no-applicants.png', { fullPage: true });
  });

  employerTest('PM-02: has applicant pending review', async ({ page }) => {
    await page.goto(`/permanent/${PM.APPLIED_PENDING}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm02-applied-pending.png', { fullPage: true });
  });

  employerTest('PM-03: shortlisted applicant (NDA vessel)', async ({ page }) => {
    await page.goto(`/permanent/${PM.SHORTLISTED_NDA}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm03-shortlisted-nda.png', { fullPage: true });
  });

  employerTest('PM-04: selected, in negotiation with messages', async ({ page }) => {
    await page.goto(`/permanent/${PM.IN_NEGOTIATION}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm04-in-negotiation.png', { fullPage: true });
  });

  employerTest('PM-05: placement confirmed, engagement closed', async ({ page }) => {
    await page.goto(`/permanent/${PM.PLACEMENT_CONFIRMED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm05-placement-confirmed.png', { fullPage: true });
  });

  employerTest('PM-06: cancelled by employer (NDA vessel)', async ({ page }) => {
    await page.goto(`/permanent/${PM.CANCELLED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm06-cancelled.png', { fullPage: true });
  });

  employerTest('PM-07: active, cert-gated posting', async ({ page }) => {
    await page.goto(`/permanent/${PM.CERT_GATED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('employer-pm07-cert-gated.png', { fullPage: true });
  });
});

employerTest.describe('Employer — Permanent Tab on My Jobs', () => {
  employerTest('permanent tab shows all permanent postings', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const permTab = page.getByText('Permanent').first();
    await permTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('employer-my-jobs-permanent.png', { fullPage: true });
  });
});

// ============================================================
// CREW — Permanent review pages
// ============================================================
const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});

crewTest.describe('Crew — Permanent Review Pages', () => {
  crewTest('PM-02: pending application (crew perspective)', async ({ page }) => {
    await page.goto(`/permanent/${PM.APPLIED_PENDING}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-pm02-applied-pending.png', { fullPage: true });
  });

  crewTest('PM-03: shortlisted (NDA — crew should not see vessel name)', async ({ page }) => {
    await page.goto(`/permanent/${PM.SHORTLISTED_NDA}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-pm03-shortlisted-nda.png', { fullPage: true });
  });

  crewTest('PM-04: selected, in negotiation — crew sees message thread', async ({ page }) => {
    await page.goto(`/permanent/${PM.IN_NEGOTIATION}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-pm04-in-negotiation.png', { fullPage: true });
  });

  crewTest('PM-05: placement confirmed (crew perspective)', async ({ page }) => {
    await page.goto(`/permanent/${PM.PLACEMENT_CONFIRMED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('crew-pm05-placement-confirmed.png', { fullPage: true });
  });

  crewTest('PM-07: cert-gated — crew missing required cert', async ({ page }) => {
    await page.goto(`/permanent/${PM.CERT_GATED}/review`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    // Should show cert block message or prevent apply
    await expect(page).toHaveScreenshot('crew-pm07-cert-blocked.png', { fullPage: true });
  });
});

crewTest.describe('Crew — Permanent Discovery', () => {
  crewTest('permanent toggle on discover page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const permToggle = page.getByText('Permanent').first();
    if (await permToggle.isVisible()) {
      await permToggle.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('crew-discover-permanent-feed.png', { fullPage: true });
    }
  });
});
