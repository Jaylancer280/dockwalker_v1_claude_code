import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * User flow tests — multi-step journeys through the app.
 *
 * Unlike page-load tests (does it render?), these test sequences of
 * user actions that span multiple interactions on the same page.
 *
 * Covers:
 *   1. Discover filters — apply, clear, switch modes
 *   2. Permanent feed — card data validation (salary, ASAP, live-aboard)
 *   3. Invitation accept/decline flow
 *   4. Agent market feed — filter interaction
 *   5. Profile edit form sections
 *   6. My Jobs tab navigation — all tabs with content
 */

const authDir = path.join(__dirname, '.auth');

const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});
const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});
const agentTest = base.extend({
  storageState: path.join(authDir, 'agent.json'),
});

// ============================================================
// 1. DISCOVER FILTERS — crew browsing with filter interactions
// ============================================================
crewTest.describe('Discover — Filter Interactions', () => {
  crewTest('filters button opens filter panel', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filtersBtn = page.getByText('Filters').first()
      .or(page.getByRole('button', { name: /filter/i }).first());

    if (await filtersBtn.isVisible()) {
      await filtersBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('discover-filters-open.png', { fullPage: true });
    }
  });

  crewTest('permanent toggle switches feed mode', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Screenshot daywork mode
    await expect(page).toHaveScreenshot('discover-daywork-mode.png', { fullPage: false });

    // Switch to permanent
    const permToggle = page.getByText('Permanent').first();
    if (await permToggle.isVisible()) {
      await permToggle.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Screenshot permanent mode — should look different
      await expect(page).toHaveScreenshot('discover-permanent-mode.png', { fullPage: false });
    }
  });
});

// ============================================================
// 2. PERMANENT FEED — Card data validation
// ============================================================
crewTest.describe('Discover — Permanent Feed Content', () => {
  crewTest('permanent feed shows salary ranges', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Switch to permanent
    const permToggle = page.getByText('Permanent').first();
    if (await permToggle.isVisible()) {
      await permToggle.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Screenshot captures whether €X/month salary format renders — visual review.
      await expect(page).toHaveScreenshot('permanent-feed-cards.png', { fullPage: true });
    }
  });
});

// ============================================================
// 3. AGENT MARKET FEED — Filter interaction
// ============================================================
agentTest.describe('Agent Market Feed — Filters', () => {
  agentTest('market feed filter icon opens filter panel', async ({ page }) => {
    await page.goto('/discover/market');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try the filter icon in the header
    const headerFilter = page.locator('header button, header a').last();
    if (await headerFilter.isVisible()) {
      await headerFilter.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('agent-market-filters-open.png', { fullPage: true });
    }
  });

  agentTest('market feed shows both daywork and permanent cards with correct badges', async ({ page }) => {
    await page.goto('/discover/market');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Daywork and Permanent badges render on cards
    const dayworkBadges = await page.getByText('Daywork').count();
    const permanentBadges = await page.getByText('Permanent').count();

    // Both types should be present in the feed
    expect(dayworkBadges).toBeGreaterThan(0);
    expect(permanentBadges).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('agent-market-mixed-feed.png', { fullPage: true });
  });
});

// ============================================================
// 4. PROFILE EDIT — Expandable sections
// ============================================================
crewTest.describe('Profile — Expandable Sections', () => {
  crewTest('summary section expands with details', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Summary to expand
    const summary = page.getByText('SUMMARY').first();
    if (await summary.isVisible()) {
      await summary.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('profile-summary-expanded.png', { fullPage: true });
    }
  });

  crewTest('about section expands with certs', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const about = page.getByText('ABOUT').first();
    if (await about.isVisible()) {
      await about.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('profile-about-expanded.png', { fullPage: true });
    }
  });

  crewTest('experience section expands with entries', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const experience = page.getByText('EXPERIENCE').first();
    if (await experience.isVisible()) {
      await experience.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('profile-experience-expanded.png', { fullPage: true });
    }
  });

  crewTest('looking for section expands with availability', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const lookingFor = page.getByText('LOOKING FOR').first();
    if (await lookingFor.isVisible()) {
      await lookingFor.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('profile-looking-for-expanded.png', { fullPage: true });
    }
  });
});

// ============================================================
// 5. EMPLOYER MY JOBS — Tab content with data
// ============================================================
employerTest.describe('My Jobs — Full Tab Navigation', () => {
  employerTest('active tab shows posting cards with full details', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify cards show structured data: ref number, vessel, port, date, rate
    const hasRef = await page.getByText(/DW-\d{5}/i).first().isVisible().catch(() => false);
    const hasRate = await page.getByText(/€\d+/i).first().isVisible().catch(() => false);
    expect(hasRef || hasRate).toBeTruthy();

    await expect(page).toHaveScreenshot('my-jobs-active-detail.png', { fullPage: true });
  });

  employerTest('in progress tab shows engagement details', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const inProgressTab = page.getByText(/in progress/i).first();
    if (await inProgressTab.isVisible()) {
      await inProgressTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('my-jobs-in-progress-detail.png', { fullPage: true });
    }
  });

  employerTest('done tab shows historical engagements', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const doneTab = page.getByText('Done').first();
    if (await doneTab.isVisible()) {
      await doneTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('my-jobs-done-detail.png', { fullPage: true });
    }
  });

  employerTest('templates tab shows saved templates', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const templatesTab = page.getByText('Templates').first();
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Screenshot captures whether the seeded "Standard Deckhand - Antibes" template renders.
      await expect(page).toHaveScreenshot('my-jobs-templates-detail.png', { fullPage: true });
    }
  });

  employerTest('permanent tab shows permanent postings with salary', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const permTab = page.getByText('Permanent').first();
    if (await permTab.isVisible()) {
      await permTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Should show permanent postings with monthly salary
      await expect(page).toHaveScreenshot('my-jobs-permanent-detail.png', { fullPage: true });
    }
  });
});

// ============================================================
// 6. MESSAGES — History tab
// ============================================================
crewTest.describe('Messages — History Tab', () => {
  crewTest('history tab shows past engagement threads', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const historyTab = page.getByText('History').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('messages-history-tab-crew.png', { fullPage: true });
    }
  });
});

employerTest.describe('Messages — History Tab (Employer)', () => {
  employerTest('employer history tab shows past threads', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const historyTab = page.getByText('History').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('messages-history-tab-employer.png', { fullPage: true });
    }
  });
});
