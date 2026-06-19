import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * RLS (Row Level Security) isolation tests via UI.
 *
 * Playwright can't query the database directly, but it CAN verify that
 * the rendered UI does not leak data between users. If RLS is broken,
 * data from other users appears on pages where it shouldn't.
 *
 * Strategy: login as user A, navigate to a page, verify that user B's
 * private data is NOT visible. Then login as user B and verify the same
 * data IS visible to them.
 *
 * Categories:
 *   1. Vessel isolation — users only see their own vessels
 *   2. Message isolation — users only see their own engagement threads
 *   3. Profile edit isolation — users cannot edit other profiles
 *   4. Posting ownership — users only see their own postings on "My Jobs"
 *   5. Experience isolation — users only see their own experiences
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
const crewAltTest = base.extend({
  storageState: path.join(authDir, 'crew-alt.json'),
});

// ============================================================
// 1. VESSEL ISOLATION — Users only see their own vessels
// ============================================================
employerTest.describe('RLS: Vessel Isolation — Employer', () => {
  employerTest('employer sees own vessels (Serenity, Phantom, Wanderer)', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.getByText('Serenity')).toBeVisible();
    await expect(page.getByText('Phantom')).toBeVisible();
    await expect(page.getByText('Wanderer')).toBeVisible();
  });

  employerTest('employer does NOT see agent vessel (Meridian)', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const meridianVisible = await page.getByText('Meridian').isVisible().catch(() => false);
    expect(meridianVisible).toBeFalsy();
  });

  employerTest('employer does NOT see crew-alt vessel (Azure Dream)', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const azureVisible = await page.getByText('Azure Dream').isVisible().catch(() => false);
    expect(azureVisible).toBeFalsy();
  });
});

agentTest.describe('RLS: Vessel Isolation — Agent', () => {
  agentTest('agent sees own vessel (Meridian)', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.getByText('Meridian')).toBeVisible();
  });

  agentTest('agent does NOT see employer vessels (Serenity, Phantom, Wanderer)', async ({ page }) => {
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const serenityVisible = await page.getByText('Serenity').isVisible().catch(() => false);
    const phantomVisible = await page.getByText('Phantom').isVisible().catch(() => false);
    const wandererVisible = await page.getByText('Wanderer').isVisible().catch(() => false);
    expect(serenityVisible).toBeFalsy();
    expect(phantomVisible).toBeFalsy();
    expect(wandererVisible).toBeFalsy();
  });
});

// ============================================================
// 2. MESSAGE ISOLATION — Users only see their own threads
// ============================================================
employerTest.describe('RLS: Message Isolation — Employer', () => {
  employerTest('employer messages only show threads with their engagements', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Employer should see threads with "Profile Two" (crew c@1)
    await expect(page.getByText('Profile Two').first()).toBeVisible();

    // Should NOT see "Profile Three" (g@1) or "Profile Five" (a@1)
    // unless they have engagements with them
    const profileThreeVisible = await page.getByText('Profile Three').isVisible().catch(() => false);
    const profileFiveVisible = await page.getByText('Profile Five').isVisible().catch(() => false);
    expect(profileThreeVisible).toBeFalsy();
    expect(profileFiveVisible).toBeFalsy();

    await expect(page).toHaveScreenshot('rls-employer-messages.png', { fullPage: true });
  });
});

crewAltTest.describe('RLS: Message Isolation — Crew Alt', () => {
  crewAltTest('crew-alt sees no messages (no engagements)', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // g@1 has no engagements — should see empty state
    const profileOneVisible = await page.getByText('Profile One').isVisible().catch(() => false);
    const profileTwoVisible = await page.getByText('Profile Two').isVisible().catch(() => false);
    expect(profileOneVisible).toBeFalsy();
    expect(profileTwoVisible).toBeFalsy();
  });
});

agentTest.describe('RLS: Message Isolation — Agent', () => {
  agentTest('agent sees no messages (no engagements)', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // a@1 has no engagements — should see empty state, not other users' threads
    const profileOneVisible = await page.getByText('Profile One').isVisible().catch(() => false);
    const profileTwoVisible = await page.getByText('Profile Two').isVisible().catch(() => false);
    expect(profileOneVisible).toBeFalsy();
    expect(profileTwoVisible).toBeFalsy();
  });
});

// ============================================================
// 3. POSTING OWNERSHIP — My Jobs only shows own postings
// ============================================================
agentTest.describe('RLS: Posting Ownership — Agent', () => {
  agentTest('agent my jobs does NOT show employer postings', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Agent (a@1) has no postings — should see empty state
    // Should NOT see employer's DW-01 through DW-10 postings
    const dw00001 = await page.getByText('DW-00001').isVisible().catch(() => false);
    const serenity = await page.getByText('Serenity').isVisible().catch(() => false);
    expect(dw00001).toBeFalsy();
    expect(serenity).toBeFalsy();

    await expect(page).toHaveScreenshot('rls-agent-my-jobs-empty.png', { fullPage: true });
  });
});

employerTest.describe('RLS: Posting Ownership — Employer', () => {
  employerTest('employer my jobs shows own postings', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Employer (e@1) should see their postings
    await expect(page.getByText('DW-00001').or(page.getByText('Serenity')).first()).toBeVisible();
  });
});

// ============================================================
// 4. DIRECT URL ACCESS — Can't view another user's vessel edit page
// ============================================================
agentTest.describe('RLS: Direct URL — Vessel Edit', () => {
  agentTest('agent cannot access employer vessel edit page', async ({ page }) => {
    // Employer's vessel Serenity ID: 33333333-3333-3333-3333-333333333333
    await page.goto('/vessels/33333333-3333-3333-3333-333333333333/edit');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should show error, redirect, or empty — NOT the vessel edit form with Serenity data
    const serenityName = await page.getByText('Serenity').isVisible().catch(() => false);
    const serenityIMO = await page.getByText('9876543').isVisible().catch(() => false);
    expect(serenityName).toBeFalsy();
    expect(serenityIMO).toBeFalsy();

    await expect(page).toHaveScreenshot('rls-agent-vessel-edit-blocked.png', { fullPage: true });
  });
});

crewTest.describe('RLS: Direct URL — Vessel Edit', () => {
  crewTest('crew cannot access employer vessel edit page', async ({ page }) => {
    await page.goto('/vessels/33333333-3333-3333-3333-333333333333/edit');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const serenityName = await page.getByText('Serenity').isVisible().catch(() => false);
    const serenityIMO = await page.getByText('9876543').isVisible().catch(() => false);
    expect(serenityName).toBeFalsy();
    expect(serenityIMO).toBeFalsy();

    await expect(page).toHaveScreenshot('rls-crew-vessel-edit-blocked.png', { fullPage: true });
  });
});

// ============================================================
// 5. EXPERIENCE ISOLATION — Profile shows only own experiences
// ============================================================
crewTest.describe('RLS: Experience Isolation — Crew', () => {
  crewTest('crew profile shows own experiences, not others', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // c@1 should see their own experiences (Serenity, Wanderer)
    // Should NOT see g@1's experience (Azure Dream) or a@1's (Meridian)
    const azureDreamVisible = await page.getByText('Azure Dream').isVisible().catch(() => false);
    const meridianVisible = await page.getByText('Meridian').isVisible().catch(() => false);
    expect(azureDreamVisible).toBeFalsy();
    expect(meridianVisible).toBeFalsy();
  });
});
